const env = require('../config/env');
const { HttpError } = require('../utils/http-error');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const enforceCsrf = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin') || '';
  const referer = req.get('referer') || '';
  if (!origin && !referer) {
    return next(new HttpError(403, 'CSRF protection blocked the request'));
  }
  if (origin && origin === env.frontendOrigin) return next();
  if (referer && referer.startsWith(env.frontendOrigin)) return next();
  return next(new HttpError(403, 'CSRF protection blocked the request'));
};

module.exports = { enforceCsrf };
