const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanString, cleanStringArray, cleanJson } = require('../src/utils/sanitize');
const { resolveGenerationCosts, calculateExpiryDate, persistCompletedGeneration, refundFailedGeneration } = require('../src/services/generation.service');
const { shouldCleanupGeneration } = require('../src/jobs/cleanup.job');
const { buildSslConfig, runMigration } = require('../src/scripts/run-migration');

test('cleanString strips HTML and normalizes whitespace', () => {
  assert.equal(cleanString(' <script>alert(1)</script> hi   there '), 'hi there');
});

test('cleanStringArray keeps only cleaned non-empty tags', () => {
  assert.deepEqual(cleanStringArray([' neon ', '', '<b>dream</b>']), ['neon', 'dream']);
});

test('cleanJson recursively sanitizes nested values', () => {
  assert.deepEqual(cleanJson({ prompt: '<img src=x onerror=1>sky', nested: [' a ', '<b>b</b>'] }), { prompt: 'sky', nested: ['a', 'b'] });
});

test('resolveGenerationCosts respects configured settings', () => {
  assert.deepEqual(resolveGenerationCosts({ credit_cost_image: 1, credit_cost_video: 2, credit_cost_chat: 3 }), { image: 1, video: 2, chat: 3 });
});

test('calculateExpiryDate defaults into the future', () => {
  const expiresAt = calculateExpiryDate(7);
  assert.ok(expiresAt > new Date());
});

test('shouldCleanupGeneration only returns true for expired active assets', () => {
  const now = new Date('2026-01-08T00:00:00.000Z');
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-07T00:00:00.000Z', isDeleted: false }, now), true);
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-09T00:00:00.000Z', isDeleted: false }, now), false);
  assert.equal(shouldCleanupGeneration({ expiresAt: '2026-01-07T00:00:00.000Z', isDeleted: true }, now), false);
});

test('persistCompletedGeneration saves completed output fields and emits update', async () => {
  const generation = {
    status: 'processing',
    outputUrl: '',
    storageKey: '',
    async save() {
      this.saved = true;
    },
  };
  const emissions = [];
  const generationModel = { findByPk: async () => generation };

  const result = await persistCompletedGeneration(
    { generationModel, emitUpdate: (...args) => emissions.push(args) },
    { generationId: 'gen-1', userId: 'user-1', outputUrl: 'https://cdn/x.png', storageKey: 'image/x.png' },
  );

  assert.equal(result.status, 'completed');
  assert.equal(result.outputUrl, 'https://cdn/x.png');
  assert.equal(result.storageKey, 'image/x.png');
  assert.equal(result.saved, true);
  assert.deepEqual(emissions[0], ['user-1', { id: 'gen-1', status: 'completed', progress: 100, outputUrl: 'https://cdn/x.png', storageKey: 'image/x.png' }]);
});

test('refundFailedGeneration refunds once and emits failure update', async () => {
  const generation = {
    status: 'processing',
    costCredits: 12,
    async save() {
      this.saved = true;
    },
  };
  const updates = [];
  const emissions = [];
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {
      this.committed = true;
    },
    async rollback() {
      this.rolledBack = true;
    },
  };
  const generationModel = { findByPk: async () => generation };
  const userModel = { update: async (...args) => updates.push(args) };
  const sequelizeInstance = { transaction: async () => transaction };

  const result = await refundFailedGeneration(
    { generationModel, userModel, sequelizeInstance, emitUpdate: (...args) => emissions.push(args) },
    { generationId: 'gen-2', userId: 'user-2', reason: 'boom' },
  );

  assert.equal(result.status, 'failed');
  assert.equal(result.saved, true);
  assert.equal(transaction.committed, true);
  assert.equal(updates.length, 1);
  assert.deepEqual(emissions[0], ['user-2', { id: 'gen-2', status: 'failed', progress: 100, reason: 'boom' }]);
});

test('refundFailedGeneration returns null when generation is missing', async () => {
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {},
    async rollback() {
      this.rolledBack = true;
    },
  };

  const result = await refundFailedGeneration(
    {
      generationModel: { findByPk: async () => null },
      userModel: { update: async () => assert.fail('should not refund') },
      sequelizeInstance: { transaction: async () => transaction },
      emitUpdate: () => assert.fail('should not emit'),
    },
    { generationId: 'missing', userId: 'user-3', reason: 'missing' },
  );

  assert.equal(result, null);
  assert.equal(transaction.rolledBack, true);
});

test('refundFailedGeneration does not refund again for already failed generations', async () => {
  const generation = {
    status: 'failed',
    costCredits: 12,
    async save() {
      assert.fail('should not save already failed generation');
    },
  };
  const transaction = {
    LOCK: { UPDATE: 'UPDATE' },
    async commit() {
      assert.fail('should not commit');
    },
    async rollback() {
      this.rolledBack = true;
    },
  };

  const result = await refundFailedGeneration(
    {
      generationModel: { findByPk: async () => generation },
      userModel: { update: async () => assert.fail('should not refund') },
      sequelizeInstance: { transaction: async () => transaction },
      emitUpdate: () => assert.fail('should not emit'),
    },
    { generationId: 'failed', userId: 'user-4', reason: 'duplicate' },
  );

  assert.equal(result, generation);
  assert.equal(transaction.rolledBack, true);
});

test('buildSslConfig keeps SSL disabled for localhost and configures remote production databases safely', () => {
  assert.equal(buildSslConfig('postgres://localhost:5432/app?sslmode=disable', 'production'), false);
  assert.deepEqual(buildSslConfig('postgres://db.example.com:5432/app?sslmode=require', 'production'), { rejectUnauthorized: false });
  assert.deepEqual(buildSslConfig('postgres://db.example.com:5432/app', 'production'), { rejectUnauthorized: false });
  assert.throws(
    () => buildSslConfig('postgres://db.example.com:5432/app?sslmode=verify-full', 'production'),
    /Unsupported sslmode "verify-full"/,
  );
});

test('runMigration rejects when DATABASE_URL is missing', async () => {
  await assert.rejects(() => runMigration({ databaseUrl: '' }), /DATABASE_URL must be set/);
});

test('runMigration reads the SQL file and executes it with the configured client', async () => {
  const events = [];
  let clientConfig;

  await runMigration({
    databaseUrl: 'postgres://db.example.com:5432/app?sslmode=require',
    nodeEnv: 'production',
    readFile: async () => 'SELECT 1;',
    clientFactory: (config) => {
      clientConfig = config;

      return {
        connect: async () => events.push('connect'),
        query: async (sql) => events.push(['query', sql]),
        end: async () => events.push('end'),
      };
    },
    log: (message) => events.push(['log', message]),
  });

  assert.equal(clientConfig.connectionString, 'postgres://db.example.com:5432/app?sslmode=require');
  assert.deepEqual(clientConfig.ssl, { rejectUnauthorized: false });
  assert.deepEqual(events, [
    'connect',
    ['log', 'Connected to PostgreSQL'],
    ['query', 'SELECT 1;'],
    ['log', 'Migration applied successfully'],
    'end',
  ]);
});

test('runMigration preserves the original migration error if cleanup also fails', async () => {
  const events = [];

  await assert.rejects(
    () => runMigration({
      databaseUrl: 'postgres://db.example.com:5432/app?sslmode=require',
      nodeEnv: 'production',
      readFile: async () => 'SELECT 1;',
      clientFactory: () => ({
        connect: async () => events.push('connect'),
        query: async () => {
          throw new Error('query failed');
        },
        end: async () => {
          throw new Error('end failed');
        },
      }),
      log: (message) => events.push(['log', message]),
      errorLog: (...args) => events.push(['error', ...args]),
    }),
    /query failed/,
  );

  assert.deepEqual(events, [
    'connect',
    ['log', 'Connected to PostgreSQL'],
    ['error', 'Migration cleanup failed', 'end failed'],
  ]);
});
