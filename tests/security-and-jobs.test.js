process.env.WIRO_API_KEY = 'test-wiro-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { cleanString, cleanStringArray, cleanJson } = require('../src/utils/sanitize');
const { resolveGenerationCosts, calculateExpiryDate, resolveRequestedModel, persistCompletedGeneration, refundFailedGeneration } = require('../src/services/generation.service');
const { buildImageFields, ensureSupportedSize, extractOutputUrl, pollTaskDetail, submitAsyncRun, submitImageGeneration } = require('../src/services/wiro.service');
const { shouldCleanupGeneration } = require('../src/jobs/cleanup.job');
const { buildSslConfig, runMigration } = require('../src/scripts/run-migration');
const { parseCookies, getAuthTokenFromRequest } = require('../src/utils/auth-cookie');
const { parseLocation } = require('../src/utils/request-context');

test('cleanString strips HTML and normalizes whitespace', () => {
  assert.equal(cleanString(' <script>alert(1)</script> hi   there '), 'hi there');
});

test('cleanStringArray keeps only cleaned non-empty tags', () => {
  assert.deepEqual(cleanStringArray([' neon ', '', '<b>dream</b>']), ['neon', 'dream']);
});

test('cleanJson recursively sanitizes nested values', () => {
  assert.deepEqual(cleanJson({ prompt: '<img src=x onerror=1>sky', nested: [' a ', '<b>b</b>'] }), { prompt: 'sky', nested: ['a', 'b'] });
});

test('auth cookie helpers parse cookies and prefer bearer tokens', () => {
  assert.deepEqual(parseCookies('a=1; chilllix_session=test-token'), { a: '1', chilllix_session: 'test-token' });
  assert.equal(parseCookies('chilllix_session=%E0%A4%A').chilllix_session, '%E0%A4%A');
  assert.equal(getAuthTokenFromRequest({ headers: { cookie: 'chilllix_session=test-token' } }), 'test-token');
  assert.equal(getAuthTokenFromRequest({ headers: { authorization: 'Bearer'.concat(' api-token'), cookie: 'chilllix_session=test-token' } }), 'api-token');
});

test('parseLocation only accepts finite coordinates', () => {
  assert.deepEqual(parseLocation({ latitude: 1.234567, longitude: 2.345678 }), { latitude: 1.234567, longitude: 2.345678 });
  assert.deepEqual(parseLocation({ latitude: 'bad', longitude: null }), { latitude: null, longitude: null });
});

test('resolveGenerationCosts respects configured settings', () => {
  assert.deepEqual(resolveGenerationCosts({ credit_cost_image: 1, credit_cost_video: 2, credit_cost_chat: 3 }), { image: 1, video: 2, chat: 3 });
});

test('calculateExpiryDate defaults into the future', () => {
  const expiresAt = calculateExpiryDate(7);
  assert.ok(expiresAt > new Date());
});

test('resolveRequestedModel only allows configured image models', () => {
  assert.equal(resolveRequestedModel({ type: 'image', model: 'openai/gpt-image-2' }), 'openai/gpt-image-2');
  assert.equal(resolveRequestedModel({ type: 'image', model: undefined }), 'openai/gpt-image-2-5-flare');
  assert.equal(resolveRequestedModel({ type: 'video', model: undefined }), null);
  assert.throws(() => resolveRequestedModel({ type: 'image', model: 'bad/model' }), /Unsupported image model/);
});

test('sequelize models map userId attributes onto user_id columns', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const script = `
    const assert = require('node:assert/strict');
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = ['postgres', '://user:pass@localhost:5432/testdb'].join('');
    const models = require('./src/models');
    const check = (modelName) => {
      const attribute = models[modelName].getAttributes().userId;
      assert.ok(attribute, modelName + ' is missing userId');
      assert.equal(attribute.field, 'user_id');
    };
    check('SavedPrompt');
    check('UserLog');
    check('Generation');
    check('Transaction');
  `;

  execFileSync(process.execPath, ['-e', script], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
});

test('buildImageFields maps prompt and requested size', () => {
  assert.deepEqual(buildImageFields({ prompt: 'sunset skyline', aspectRatio: '3:2' }), {
    prompt: 'sunset skyline',
    size: '3:2',
  });
});

test('ensureSupportedSize rejects undeclared image sizes', () => {
  const modelConfig = {
    id: 'openai/gpt-image-2',
    fields: { sizeOptions: ['auto', '1:1', '3:2', '2:3'] },
  };
  assert.equal(ensureSupportedSize(modelConfig, '1:1'), '1:1');
  assert.throws(() => ensureSupportedSize(modelConfig, '16:9'), /Unsupported image size/);
});

test('extractOutputUrl returns the first output url', () => {
  assert.equal(extractOutputUrl({ outputs: [{ url: 'https://cdn.example.com/file.png' }] }), 'https://cdn.example.com/file.png');
  assert.throws(() => extractOutputUrl({ outputs: [] }), /without an output URL/);
});

test('submitAsyncRun posts multipart form data to the model run endpoint', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async text() {
        return JSON.stringify({ errors: [], taskid: 'task-1', result: true });
      },
    };
  };

  const result = await submitAsyncRun({
    model: 'openai/gpt-image-2',
    fields: { prompt: 'cat', size: '1:1' },
    fetchImpl,
  });

  assert.equal(result.taskid, 'task-1');
  assert.equal(calls[0].url.endsWith('/Run/openai/gpt-image-2'), true);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['x-api-key'], 'test-wiro-key');
  assert.ok(calls[0].options.body instanceof FormData);
});

test('submitAsyncRun surfaces Wiro error payloads and missing task ids', async () => {
  await assert.rejects(
    () => submitAsyncRun({
      model: 'openai/gpt-image-2',
      fields: { prompt: 'cat' },
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({ errors: ['rate limited'], result: false });
        },
      }),
    }),
    /rate limited/,
  );

  await assert.rejects(
    () => submitAsyncRun({
      model: 'openai/gpt-image-2',
      fields: { prompt: 'cat' },
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({ errors: [], result: true });
        },
      }),
    }),
    /did not return a task id/,
  );
});


test('submitImageGeneration resolves a configured image model end to end', async () => {
  const calls = [];
  const responses = [
    { errors: [], taskid: 'task-42', result: true },
    { tasklist: [{ status: 'task_postprocess_end', outputs: [{ url: 'https://cdn.example.com/image.png' }] }], errors: [], result: true },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async text() {
        return JSON.stringify(responses.shift());
      },
    };
  };

  const result = await submitImageGeneration({
    model: 'openai/gpt-image-2',
    prompt: 'cat portrait',
    aspectRatio: '1:1',
  }, {
    fetchImpl,
    pollIntervalMs: 0,
    maxAttempts: 2,
  });

  assert.equal(result.outputUrl, 'https://cdn.example.com/image.png');
  assert.equal(result.taskId, 'task-42');
  assert.equal(calls[0].url.endsWith('/Run/openai/gpt-image-2'), true);
  assert.equal(calls[1].url.endsWith('/Task/Detail'), true);
});


test('submitImageGeneration falls back to the default image model when omitted', async () => {
  const calls = [];
  const responses = [
    { errors: [], taskid: 'task-default', result: true },
    { tasklist: [{ status: 'task_postprocess_end', outputs: [{ url: 'https://cdn.example.com/default.png' }] }], errors: [], result: true },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async text() {
        return JSON.stringify(responses.shift());
      },
    };
  };

  const result = await submitImageGeneration({
    prompt: 'default model portrait',
    aspectRatio: '1:1',
  }, {
    fetchImpl,
    pollIntervalMs: 0,
    maxAttempts: 2,
  });

  assert.equal(result.outputUrl, 'https://cdn.example.com/default.png');
  assert.equal(calls[0].url.endsWith('/Run/openai/gpt-image-2-5-flare'), true);
});

test('submitImageGeneration rejects unsupported image models before calling Wiro', async () => {
  let called = false;
  await assert.rejects(
    () => submitImageGeneration({
      model: 'openai/not-real',
      prompt: 'invalid',
      aspectRatio: '1:1',
    }, {
      fetchImpl: async () => {
        called = true;
        throw new Error('should not be called');
      },
    }),
    /Unsupported image model/,
  );
  assert.equal(called, false);
});

test('pollTaskDetail keeps polling until the task completes', async () => {
  const calls = [];
  const responses = [
    { tasklist: [{ status: 'task_start', outputs: [] }], errors: [], result: true },
    { tasklist: [{ status: 'task_postprocess_end', outputs: [{ url: 'https://cdn.example.com/done.png' }] }], errors: [], result: true },
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async text() {
        return JSON.stringify(responses.shift());
      },
    };
  };

  const task = await pollTaskDetail({ taskId: 'task-9', fetchImpl, pollIntervalMs: 0, maxAttempts: 3 });

  assert.equal(task.status, 'task_postprocess_end');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.endsWith('/Task/Detail'), true);
  assert.equal(JSON.parse(calls[0].options.body).taskid, 'task-9');
});

test('pollTaskDetail rejects failed, unknown, and timed out tasks', async () => {
  await assert.rejects(
    () => pollTaskDetail({
      taskId: 'task-fail',
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({ tasklist: [{ status: 'task_error', debugerror: 'upstream failed', outputs: [] }], errors: [], result: true });
        },
      }),
      pollIntervalMs: 0,
      maxAttempts: 1,
    }),
    /upstream failed/,
  );

  await assert.rejects(
    () => pollTaskDetail({
      taskId: 'task-weird',
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({ tasklist: [{ status: 'task_weird', outputs: [] }], errors: [], result: true });
        },
      }),
      pollIntervalMs: 0,
      maxAttempts: 1,
    }),
    /unknown status/,
  );

  await assert.rejects(
    () => pollTaskDetail({
      taskId: 'task-timeout',
      fetchImpl: async () => ({
        ok: true,
        async text() {
          return JSON.stringify({ tasklist: [{ status: 'task_start', outputs: [] }], errors: [], result: true });
        },
      }),
      pollIntervalMs: 0,
      maxAttempts: 1,
    }),
    /timed out/,
  );
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
  const reads = [];

  await runMigration({
    databaseUrl: 'postgres://db.example.com:5432/app?sslmode=require',
    nodeEnv: 'production',
    readdir: async () => ['001_init.sql', '002_auth_sessions_and_dashboards.sql'],
    readFile: async (filePath) => {
      reads.push(filePath.split('/').pop());
      return 'SELECT 1;';
    },
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
  assert.deepEqual(reads, ['001_init.sql', '002_auth_sessions_and_dashboards.sql']);
  assert.deepEqual(events, [
    'connect',
    ['log', 'Connected to PostgreSQL'],
    ['query', 'BEGIN'],
    ['query', 'SELECT 1;'],
    ['query', 'SELECT 1;'],
    ['query', 'COMMIT'],
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
      readdir: async () => ['001_init.sql'],
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

test('runMigration rolls back when a later migration fails', async () => {
  const events = [];

  await assert.rejects(
    () => runMigration({
      databaseUrl: 'postgres://db.example.com:5432/app?sslmode=require',
      nodeEnv: 'production',
      readdir: async () => ['001_init.sql', '002_auth_sessions_and_dashboards.sql'],
      readFile: async (_filePath) => 'SELECT 1;',
      clientFactory: () => ({
        connect: async () => events.push('connect'),
        query: async (sql) => {
          events.push(['query', sql]);
          if (sql === 'SELECT 1;' && events.filter((event) => Array.isArray(event) && event[0] === 'query' && event[1] === 'SELECT 1;').length > 1) {
            throw new Error('migration failed');
          }
        },
        end: async () => events.push('end'),
      }),
      log: (message) => events.push(['log', message]),
    }),
    /migration failed/,
  );

  assert.deepEqual(events, [
    'connect',
    ['log', 'Connected to PostgreSQL'],
    ['query', 'BEGIN'],
    ['query', 'SELECT 1;'],
    ['query', 'SELECT 1;'],
    ['query', 'ROLLBACK'],
    'end',
  ]);
});
