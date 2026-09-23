const { fn, col } = require('sequelize');
const { User, Generation, Transaction, UserLog } = require('../models');
const { getSettingsMap, upsertSettings } = require('../services/settings.service');
const { HttpError } = require('../utils/http-error');

const requireDatabase = () => {
  if (!User || !Generation || !Transaction || !UserLog) {
    throw new HttpError(503, 'Database is not configured');
  }
};

const getOverview = async (_req, res) => {
  requireDatabase();
  const [activeUsers, totalGenerations, revenue, apiUsage, logs] = await Promise.all([
    User.count({ where: { isSuspended: false } }),
    Generation.count(),
    Transaction.sum('amount'),
    Generation.findAll({ attributes: ['type', [fn('COUNT', col('id')), 'count']], group: ['type'] }),
    UserLog.findAll({ limit: 50, order: [['createdAt', 'DESC']] }),
  ]);

  res.json({ activeUsers, totalGenerations, revenue: Number(revenue || 0), apiUsage, logs });
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
  const where = search ? { email: { [require('sequelize').Op.iLike]: `%${search}%` } } : {};
  const users = await User.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
  res.json(users);
};

const updateUser = async (req, res) => {
  requireDatabase();
  const user = await User.findByPk(req.params.id);
  if (!user) throw new HttpError(404, 'User not found');
  const { creditsBalance, role, isSuspended } = req.validated.body;
  if (typeof creditsBalance === 'number') user.creditsBalance = creditsBalance;
  if (role) user.role = role;
  if (typeof isSuspended === 'boolean') user.isSuspended = isSuspended;
  await user.save();
  res.json(user);
};

module.exports = { getOverview, getSettings, updateSettings, listUsers, updateUser };
