const { verifyAccessToken } = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');
const { getAuthTokenFromRequest } = require('../utils/auth-cookie');

const requireAuth = (req, _res, next) => {
  const token = getAuthTokenFromRequest(req);
  if (!token) return next(new HttpError(401, 'Authentication required'));

  try {
    req.user = verifyAccessToken(token);
    return next();
  } catch (_error) {
    return next(new HttpError(401, 'Invalid token'));
  }
};

const requireRole = (role) => (req, _res, next) => {
  if (!req.user || req.user.role !== role) {
    return next(new HttpError(403, 'Forbidden'));
  }
  return next();
};

module.exports = { requireAuth, requireRole };
