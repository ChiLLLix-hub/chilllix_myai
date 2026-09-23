const { Sequelize } = require('sequelize');
const env = require('./env');

let sequelize = null;

if (env.databaseEnabled) {
  sequelize = new Sequelize(env.databaseUrl, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: env.isProduction ? { ssl: { require: true, rejectUnauthorized: false } } : {},
  });
}

module.exports = { sequelize };
