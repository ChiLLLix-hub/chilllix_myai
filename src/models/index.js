const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const models = {};

if (sequelize) {
  models.User = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
    role: { type: DataTypes.ENUM('user', 'admin'), allowNull: false, defaultValue: 'user' },
    avatarUrl: { type: DataTypes.TEXT, field: 'avatar_url' },
    creditsBalance: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'credits_balance' },
    isSuspended: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_suspended' },
    failedLoginAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'failed_login_attempts' },
    lockedUntil: { type: DataTypes.DATE, field: 'locked_until' },
    lastLoginAt: { type: DataTypes.DATE, field: 'last_login_at' },
    lastLoginIp: { type: DataTypes.STRING, field: 'last_login_ip' },
    lastLoginLatitude: { type: DataTypes.DECIMAL(9, 6), field: 'last_login_latitude' },
    lastLoginLongitude: { type: DataTypes.DECIMAL(9, 6), field: 'last_login_longitude' },
  }, { tableName: 'users', underscored: true });

  models.SavedPrompt = sequelize.define('SavedPrompt', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    title: { type: DataTypes.STRING, allowNull: false },
    promptText: { type: DataTypes.TEXT, allowNull: false, field: 'prompt_text' },
    category: { type: DataTypes.ENUM('image', 'video', 'chat'), allowNull: false },
    tags: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  }, { tableName: 'saved_prompts', underscored: true });

  models.UserLog = sequelize.define('UserLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, field: 'user_id' },
    action: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    ipAddress: { type: DataTypes.STRING, field: 'ip_address' },
    userAgent: { type: DataTypes.TEXT, field: 'user_agent' },
  }, { tableName: 'user_logs', underscored: true });

  models.Generation = sequelize.define('Generation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    type: { type: DataTypes.ENUM('image', 'video', 'chat'), allowNull: false },
    prompt: { type: DataTypes.TEXT, allowNull: false },
    outputUrl: { type: DataTypes.TEXT, field: 'output_url' },
    storageKey: { type: DataTypes.TEXT, field: 'storage_key' },
    modelUsed: { type: DataTypes.STRING, field: 'model_used' },
    status: { type: DataTypes.ENUM('queued', 'processing', 'completed', 'failed'), allowNull: false, defaultValue: 'queued' },
    costCredits: { type: DataTypes.INTEGER, allowNull: false, field: 'cost_credits' },
    expiresAt: { type: DataTypes.DATE, field: 'expires_at' },
    isDeleted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_deleted' },
  }, { tableName: 'generations', underscored: true });

  models.Transaction = sequelize.define('Transaction', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
    amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING(8), allowNull: false, defaultValue: 'USD' },
    creditsAdded: { type: DataTypes.INTEGER, allowNull: false, field: 'credits_added' },
    paymentStatus: { type: DataTypes.STRING, allowNull: false, field: 'payment_status' },
    paymentIntentId: { type: DataTypes.STRING, field: 'payment_intent_id' },
    gateway: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: 'transactions', underscored: true });

  models.SystemSetting = sequelize.define('SystemSetting', {
    key: { type: DataTypes.STRING, primaryKey: true },
    value: { type: DataTypes.JSONB, allowNull: false },
  }, { tableName: 'system_settings', underscored: true, updatedAt: 'updated_at', createdAt: false });

  const userForeignKey = () => ({ name: 'userId', field: 'user_id' });

  models.User.hasMany(models.SavedPrompt, { foreignKey: userForeignKey() });
  models.SavedPrompt.belongsTo(models.User, { foreignKey: userForeignKey() });
  models.User.hasMany(models.UserLog, { foreignKey: userForeignKey() });
  models.UserLog.belongsTo(models.User, { foreignKey: userForeignKey() });
  models.User.hasMany(models.Generation, { foreignKey: userForeignKey() });
  models.Generation.belongsTo(models.User, { foreignKey: userForeignKey() });
  models.User.hasMany(models.Transaction, { foreignKey: userForeignKey() });
  models.Transaction.belongsTo(models.User, { foreignKey: userForeignKey() });
}

module.exports = models;
