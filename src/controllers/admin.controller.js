const { Op, fn, col } = require('sequelize');
const { User, Generation, Transaction, UserLog, SavedPrompt } = require('../models');
const { getSettingsMap, upsertSettings } = require('../services/settings.service');
const { HttpError } = require('../utils/http-error');
const { escapeLikePattern } = require('../utils/sanitize');

const requireDatabase = () => {
  if (!User || !Generation || !Transaction || !UserLog || !SavedPrompt) {
    throw new HttpError(503, 'Database is not configured');
  }
};

const startOfToday = () => {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
};

const getOverview = async (_req, res) => {
  requireDatabase();
  const today = startOfToday();
  const [
    activeUsers,
    totalGenerations,
    revenue,
    generationStatus,
    todaysLogins,
    recentPromptActivity,
    recentQueries,
    recentTransactions,
    lockedAccounts,
    securityEvents,
  ] = await Promise.all([
    User.count({ where: { isSuspended: false } }),
    Generation.count(),
    Transaction.sum('amount'),
    Generation.findAll({ attributes: ['status', [fn('COUNT', col('Generation.id')), 'count']], group: ['status'] }),
    UserLog.findAll({
      where: { action: 'auth.login.success', createdAt: { [Op.gte]: today } },
      include: [{ model: User, attributes: ['email'] }],
      order: [['createdAt', 'DESC']],
      limit: 20,
    }),
    Generation.findAll({
      include: [{ model: User, attributes: ['email'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    SavedPrompt.findAll({
      include: [{ model: User, attributes: ['email'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    Transaction.findAll({
      include: [{ model: User, attributes: ['email'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    User.findAll({
      where: {
        [Op.or]: [
          { isSuspended: true },
          { lockedUntil: { [Op.gt]: new Date() } },
        ],
      },
      order: [['updatedAt', 'DESC']],
      limit: 20,
    }),
    UserLog.findAll({
      where: { action: { [Op.in]: ['auth.login.failed', 'auth.login.locked', 'auth.login.denied'] } },
      include: [{ model: User, attributes: ['email'] }],
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
  ]);

  res.json({
    activeUsers,
    totalGenerations,
    revenue: Number(revenue || 0),
    generationStatus,
    todaysLogins,
    recentPromptActivity,
    recentQueries,
    recentTransactions,
    lockedAccounts,
    securityEvents,
  });
};

const getSettings = async (_req, res) => {
  res.json(await getSettingsMap());
};

const updateSettings = async (req, res) => {
  const settings = await upsertSettings(req.validated.body);
  res.json(settings);
};

const listUsers = async (req, res) => {
  requireDatabase();
  const search = req.query.search?.trim();
  const escapedSearch = search ? escapeLikePattern(search) : '';
  const where = escapedSearch ? { email: { [Op.iLike]: `%${escapedSearch}%` } } : {};
  const users = await User.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  res.json(users);
};

const updateUser = async (req, res) => {
  requireDatabase();
  const user = await User.findByPk(req.validated.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  const { creditsBalance, role, isSuspended, clearLoginLock } = req.validated.body;
  if (typeof creditsBalance === 'number') user.creditsBalance = creditsBalance;
  if (role) user.role = role;
  if (typeof isSuspended === 'boolean') user.isSuspended = isSuspended;
  if (clearLoginLock) {
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
  }
  await user.save();
  res.json(user);
};

module.exports = { getOverview, getSettings, updateSettings, listUsers, updateUser };
