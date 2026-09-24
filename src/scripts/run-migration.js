const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const migrationPath = path.resolve(__dirname, '../../database/migrations/001_init.sql');

const buildSslConfig = (connectionString, nodeEnv = process.env.NODE_ENV || 'development') => {
  try {
    const parsedUrl = new URL(connectionString);
    const sslMode = parsedUrl.searchParams.get('sslmode');

    if (sslMode === 'disable') return false;
    if (sslMode === 'require') {
      return { rejectUnauthorized: false };
    }
    if (['verify-ca', 'verify-full'].includes(sslMode)) {
      return {};
    }

    if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
      return false;
    }
  } catch (error) {
    return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
  }

  return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
};

const runMigration = async ({
  databaseUrl = process.env.DATABASE_URL || '',
  nodeEnv = process.env.NODE_ENV || 'development',
  clientFactory = (config) => new Client(config),
  readFile = fs.readFile,
  log = console.log,
  errorLog = console.error,
} = {}) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before running the migration');
  }

  const sql = await readFile(migrationPath, 'utf8');
  let client = null;
  let connected = false;
  let migrationError = null;

  try {
    client = clientFactory({
      connectionString: databaseUrl,
      ssl: buildSslConfig(databaseUrl, nodeEnv),
    });
    await client.connect();
    connected = true;
    log('Connected to PostgreSQL');
    await client.query(sql);
    log('Migration applied successfully');
  } catch (error) {
    migrationError = error;
    throw error;
  } finally {
    if (connected) {
      try {
        await client.end();
      } catch (error) {
        if (migrationError) {
          errorLog('Migration cleanup failed', error.message);
        } else {
          throw error;
        }
      }
    }
  }
};

if (require.main === module) {
  runMigration().catch((error) => {
    console.error('Migration failed', error.message);
    process.exit(1);
  });
}

module.exports = { buildSslConfig, runMigration };
