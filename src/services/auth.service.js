const bcrypt = require('bcryptjs');
const { User } = require('../models');
const env = require('../config/env');
const { signAccessToken } = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');
const { writeAuditLog } = require('./audit.service');

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_WINDOW_MS = 5 * 60 * 1000;

const buildLocationDetails = (location = {}) => ({
  latitude: location.latitude,
  longitude: location.longitude,
});

const registerUser = async ({ email, password, context }) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) throw new HttpError(409, 'Email already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    email,
    passwordHash,
    creditsBalance: env.starterCredits,
    role: 'user',
  });
  await writeAuditLog({
    userId: user.id,
    action: 'auth.register.success',
    details: { email: user.email, ...buildLocationDetails(context.location) },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  return { user, token: signAccessToken(user) };
};

const loginUser = async ({ email, password, context }) => {
  if (!User) {
    throw new HttpError(503, 'Database is not configured');
  }

  const user = await User.findOne({ where: { email } });
  if (!user) {
    await writeAuditLog({
      action: 'auth.login.failed',
      details: { email, reason: 'not_found', ...buildLocationDetails(context.location) },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new HttpError(401, 'Invalid credentials');
  }

  if (user.isSuspended) {
    await writeAuditLog({
      userId: user.id,
      action: 'auth.login.denied',
      details: { email, reason: 'suspended', ...buildLocationDetails(context.location) },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new HttpError(403, 'Account is locked by admin');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await writeAuditLog({
      userId: user.id,
      action: 'auth.login.denied',
      details: { email, reason: 'temporary_lock', lockedUntil: user.lockedUntil.toISOString(), ...buildLocationDetails(context.location) },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new HttpError(423, 'Account is temporarily locked. Try again later.');
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const failedLoginAttempts = Number(user.failedLoginAttempts || 0) + 1;
    const shouldLock = failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    user.failedLoginAttempts = shouldLock ? 0 : failedLoginAttempts;
    user.lockedUntil = shouldLock ? new Date(Date.now() + LOGIN_LOCK_WINDOW_MS) : null;
    await user.save();
    await writeAuditLog({
      userId: user.id,
      action: shouldLock ? 'auth.login.locked' : 'auth.login.failed',
      details: {
        email,
        reason: shouldLock ? 'too_many_attempts' : 'bad_password',
        failedLoginAttempts,
        lockedUntil: user.lockedUntil ? user.lockedUntil.toISOString() : null,
        ...buildLocationDetails(context.location),
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    throw new HttpError(shouldLock ? 423 : 401, shouldLock ? 'Account locked for 5 minutes after repeated failed sign-ins' : 'Invalid credentials');
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  user.lastLoginIp = context.ipAddress;
  user.lastLoginLatitude = context.location.latitude;
  user.lastLoginLongitude = context.location.longitude;
  await user.save();
  await writeAuditLog({
    userId: user.id,
    action: 'auth.login.success',
    details: { email, ...buildLocationDetails(context.location) },
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });
  return { user, token: signAccessToken(user) };
};

module.exports = {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOGIN_LOCK_WINDOW_MS,
  registerUser,
  loginUser,
};
