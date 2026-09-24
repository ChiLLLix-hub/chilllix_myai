const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const env = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');

const GUEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const guestUsersBySessionId = new Map();

const registerUser = async ({ email, password }) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, creditsBalance: env.starterCredits, role: 'user' });
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

const createGuestUser = async ({ guestSessionId } = {}) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const sessionId = guestSessionId || crypto.randomUUID();
  const cachedGuest = guestUsersBySessionId.get(sessionId);
  if (cachedGuest && cachedGuest.expiresAt > Date.now()) {
    const existingUser = await User.findByPk(cachedGuest.userId);
    if (existingUser && !existingUser.isSuspended) {
      return { guestSessionId: sessionId, user: existingUser, token: signAccessToken(existingUser) };
    }
    guestUsersBySessionId.delete(sessionId);
  }

  const guestId = crypto.randomUUID();
  const email = `guest-${guestId}@demo.chilllix.local`;
  const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12);
  const user = await User.create({ email, passwordHash, creditsBalance: env.starterCredits, role: 'user' });
  guestUsersBySessionId.set(sessionId, { userId: user.id, expiresAt: Date.now() + GUEST_SESSION_TTL_MS });
  return { guestSessionId: sessionId, user, token: signAccessToken(user) };
};

module.exports = { registerUser, loginUser, createGuestUser };
