const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const migrationsDirectory = path.resolve(__dirname, '../../database/migrations');

const buildSslConfig = (connectionString, nodeEnv = process.env.NODE_ENV || 'development') => {
  try {
    const parsedUrl = new URL(connectionString);
    const sslMode = parsedUrl.searchParams.get('sslmode');

    if (sslMode === 'disable') return false;
    if (sslMode === 'require') {
      return { rejectUnauthorized: false };
    }
    if (['verify-ca', 'verify-full'].includes(sslMode)) {
      throw new Error(`Unsupported sslmode "${sslMode}" for db:migrate; use sslmode=require or provide a connection string without strict certificate verification modes`);
    }

    if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
      return false;
    }
  } catch (error) {
    if (error.message.startsWith('Unsupported sslmode')) {
      throw error;
    }
    return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
  }

  return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
};

const runMigration = async ({
  databaseUrl = process.env.DATABASE_URL || '',
  nodeEnv = process.env.NODE_ENV || 'development',
  clientFactory = (config) => new Client(config),
  readFile = fs.readFile,
  readdir = fs.readdir,
  log = console.log,
  errorLog = console.error,
} = {}) => {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before running the migration');
  }

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort((left, right) => left.localeCompare(right));
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
    for (const fileName of migrationFiles) {
      const sql = await readFile(path.join(migrationsDirectory, fileName), 'utf8');
      await client.query(sql);
    }
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
