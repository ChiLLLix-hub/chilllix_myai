const { verifyAccessToken } = require('../utils/jwt');
const { HttpError } = require('../utils/http-error');

const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
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
