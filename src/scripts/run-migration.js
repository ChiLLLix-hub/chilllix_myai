const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const migrationPath = path.resolve(__dirname, '../../database/migrations/001_init.sql');

const buildSslConfig = (connectionString, nodeEnv = process.env.NODE_ENV || 'development') => {
  try {
    const parsedUrl = new URL(connectionString);
    const sslMode = parsedUrl.searchParams.get('sslmode');

    if (sslMode === 'disable') return false;
    if (['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      return true;
    }

    if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
      return false;
    }
  } catch (error) {
    return nodeEnv === 'production';
  }

  return nodeEnv === 'production';
};

const runMigration = async ({
  databaseUrl = process.env.DATABASE_URL || '',
  nodeEnv = process.env.NODE_ENV || 'development',
  clientFactory = (config) => new Client(config),
  readFile = fs.readFile,
  log = console.log,
} = {}) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before running the migration');
  }

  const sql = await readFile(migrationPath, 'utf8');
  const client = clientFactory({
    connectionString: databaseUrl,
    ssl: buildSslConfig(databaseUrl, nodeEnv),
  });

  try {
    await client.connect();
    log('Connected to PostgreSQL');
    await client.query(sql);
    log('Migration applied successfully');
  } finally {
    await client.end();
  }
};

if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Migration failed', error.message);
    process.exit(1);
  });
}

module.exports = { buildSslConfig, runMigration };
