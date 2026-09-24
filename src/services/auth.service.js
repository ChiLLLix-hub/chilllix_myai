const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { signAccessToken } = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');

const registerUser = async ({ email, password }) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, creditsBalance: 0, role: 'user' });
  return { user, token: signAccessToken(user) };
};

const loginUser = async ({ email, password }) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) throw new HttpError(401, 'Invalid credentials');
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) throw new HttpError(401, 'Invalid credentials');
  if (user.isSuspended) throw new HttpError(403, 'Account is suspended');
  return { user, token: signAccessToken(user) };
};

module.exports = { registerUser, loginUser };
