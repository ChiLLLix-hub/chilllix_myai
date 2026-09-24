const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';
const nodeEnv = process.env.NODE_ENV || 'development';
const migrationPath = path.resolve(__dirname, '../../database/migrations/001_init.sql');

const buildSslConfig = (connectionString) => {
  try {
    const parsedUrl = new URL(connectionString);
    const sslMode = parsedUrl.searchParams.get('sslmode');

    if (sslMode === 'disable') return false;
    if (['require', 'verify-ca', 'verify-full'].includes(sslMode)) {
      return { rejectUnauthorized: false };
    }

    if (['localhost', '127.0.0.1'].includes(parsedUrl.hostname)) {
      return false;
    }
  } catch (error) {
    return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
  }

  return nodeEnv === 'production' ? { rejectUnauthorized: false } : false;
};

const run = async () => {
  if (!databaseUrl) {
    console.error('DATABASE_URL must be set before running the migration');
    process.exit(1);
  }

  const sql = await fs.readFile(migrationPath, 'utf8');
  const client = new Client({
    connectionString: databaseUrl,
    ssl: buildSslConfig(databaseUrl),
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');
    await client.query(sql);
    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Migration failed', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
};

run();
