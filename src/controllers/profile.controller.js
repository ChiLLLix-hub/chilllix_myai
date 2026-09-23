const { User } = require('../models');
const { HttpError } = require('../utils/http-error');

const getProfile = async (req, res) => {
  if (!User) throw new HttpError(503, 'Database is not configured');
  const user = await User.findByPk(req.user.sub);
  if (!user) throw new HttpError(404, 'User not found');
  res.json({
    id: user.id,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    creditsBalance: user.creditsBalance,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
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

module.exports = { getProfile, updateProfile };
