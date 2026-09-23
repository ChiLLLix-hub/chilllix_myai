const env = require('../config/env');

const requiredProductionVars = ['FRONTEND_ORIGIN', 'JWT_SECRET', 'DATABASE_URL', 'REDIS_URL'];
const missing = env.isProduction ? requiredProductionVars.filter((key) => !process.env[key]) : [];

if (missing.length) {
  console.error(`Missing required production variables: ${missing.join(', ')}`);
  process.exit(1);
}

console.log('Configuration verified');
