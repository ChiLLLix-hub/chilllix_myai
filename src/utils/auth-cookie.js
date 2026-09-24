const env = require('../config/env');

const AUTH_COOKIE_NAME = 'chilllix_session';

const parseCookies = (header = '') => header.split(';').reduce((acc, part) => {
  const [rawName, ...rawValue] = part.trim().split('=');
  if (!rawName) return acc;
  const value = rawValue.join('=');
  try {
    acc[rawName] = decodeURIComponent(value);
  } catch (_error) {
    acc[rawName] = value;
  }
  return acc;
}, {});

const getAuthCookieOptions = () => ({
  httpOnly: true,
  sameSite: env.isProduction ? 'none' : 'lax',
  secure: env.isProduction,
  maxAge: 12 * 60 * 60 * 1000,
  path: '/',
});

const setAuthCookie = (res, token) => {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
};

const clearAuthCookie = (res) => {
  const { path, sameSite, secure } = getAuthCookieOptions();
  res.clearCookie(AUTH_COOKIE_NAME, { path, sameSite, secure });
};

const getAuthTokenFromRequest = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[AUTH_COOKIE_NAME] || null;
};

module.exports = {
  AUTH_COOKIE_NAME,
  parseCookies,
  getAuthCookieOptions,
  setAuthCookie,
  clearAuthCookie,
  getAuthTokenFromRequest,
};
