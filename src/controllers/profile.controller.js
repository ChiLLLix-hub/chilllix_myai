const { Op } = require('sequelize');
const { User, UserLog, SavedPrompt, Generation, Transaction } = require('../models');
const { getSettingsMap } = require('../services/settings.service');
const { HttpError } = require('../utils/http-error');

const serializeProfile = (user, settings) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl,
  creditsBalance: user.creditsBalance,
  creditCosts: {
    image: Number(settings.credit_cost_image),
    video: Number(settings.credit_cost_video),
    chat: Number(settings.credit_cost_chat),
  },
  isSuspended: user.isSuspended,
  createdAt: user.createdAt,
});

const getProfile = async (req, res) => {
  if (!User) throw new HttpError(503, 'Database is not configured');
  const [user, settings] = await Promise.all([
    User.findByPk(req.user.sub),
    getSettingsMap(),
  ]);
  if (!user) throw new HttpError(404, 'User not found');
  res.json(serializeProfile(user, settings));
};

const getDashboard = async (req, res) => {
  if (!User || !SavedPrompt || !Generation || !Transaction || !UserLog) {
    throw new HttpError(503, 'Database is not configured');
  }

  const [user, settings, recentGenerations, recentPrompts, recentTransactions, recentLogins, totalGenerations, successfulGenerations, totalSavedPrompts] = await Promise.all([
    User.findByPk(req.user.sub),
    getSettingsMap(),
    Generation.findAll({ where: { userId: req.user.sub, isDeleted: false }, order: [['createdAt', 'DESC']], limit: 10 }),
    SavedPrompt.findAll({ where: { userId: req.user.sub }, order: [['createdAt', 'DESC']], limit: 10 }),
    Transaction.findAll({ where: { userId: req.user.sub }, order: [['createdAt', 'DESC']], limit: 10 }),
    UserLog.findAll({
      where: {
        userId: req.user.sub,
        action: { [Op.in]: ['auth.login.success', 'auth.register.success', 'auth.login.failed', 'auth.login.locked', 'auth.login.denied'] },
      },
      order: [['createdAt', 'DESC']],
      limit: 10,
    }),
    Generation.count({ where: { userId: req.user.sub, isDeleted: false } }),
    Generation.count({ where: { userId: req.user.sub, isDeleted: false, status: 'completed' } }),
    SavedPrompt.count({ where: { userId: req.user.sub } }),
  ]);

  if (!user) throw new HttpError(404, 'User not found');

  res.json({
    profile: serializeProfile(user, settings),
    security: {
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      lastLoginLatitude: user.lastLoginLatitude,
      lastLoginLongitude: user.lastLoginLongitude,
    },
    stats: {
      totalGenerations,
      successfulGenerations,
      savedPrompts: totalSavedPrompts,
      availableCredits: user.creditsBalance,
    },
    recentGenerations,
    recentPrompts,
    recentTransactions,
    recentLogins,
  });
};

const updateProfile = async (req, res) => {
  if (!User) throw new HttpError(503, 'Database is not configured');
  const user = await User.findByPk(req.user.sub);
  if (!user) throw new HttpError(404, 'User not found');
  const { avatarUrl } = req.validated.body;
  if (Object.prototype.hasOwnProperty.call(req.validated.body, 'avatarUrl')) {
    user.avatarUrl = avatarUrl || null;
  }
  await user.save();
  res.json({ success: true, avatarUrl: user.avatarUrl });
};

module.exports = { getProfile, getDashboard, updateProfile };
