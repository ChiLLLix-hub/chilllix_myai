const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: toInt(process.env.PORT, 3000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:8080',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',
  jwtSecret: process.env.JWT_SECRET || '',
  wiroApiBaseUrl: process.env.WIRO_API_BASE_URL || 'https://api.wiro.ai/v1',
  wiroApiKey: process.env.WIRO_API_KEY || '',
  s3Endpoint: process.env.S3_ENDPOINT || '',
  s3Region: process.env.S3_REGION || 'auto',
  s3Bucket: process.env.S3_BUCKET || '',
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  assetBaseUrl: process.env.ASSET_BASE_URL || 'https://cdn.example.com/assets',
  autoCleanupEnabled: toBool(process.env.AUTO_CLEANUP_ENABLED, true),
  assetRetentionDays: toInt(process.env.ASSET_RETENTION_DAYS, 7),
  creditCostImage: toInt(process.env.CREDIT_COST_IMAGE, 10),
  creditCostVideo: toInt(process.env.CREDIT_COST_VIDEO, 35),
  creditCostChat: toInt(process.env.CREDIT_COST_CHAT, 3),
  starterCredits: toInt(process.env.STARTER_CREDITS, 100),
};

env.isProduction = env.nodeEnv === 'production';
env.databaseEnabled = Boolean(env.databaseUrl);
env.redisEnabled = Boolean(env.redisUrl);
env.s3Enabled = Boolean(env.s3Endpoint && env.s3Bucket && env.s3AccessKeyId && env.s3SecretAccessKey);

if (!env.jwtSecret) {
  if (env.nodeEnv === 'development' || env.nodeEnv === 'test') {
    env.jwtSecret = 'development-only-secret-change-me';
  } else {
    throw new Error('JWT_SECRET must be configured outside local development and test environments');
  }
}

module.exports = env;
