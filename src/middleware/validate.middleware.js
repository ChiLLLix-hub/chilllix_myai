const { HttpError } = require('../utils/http-error');

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    return next(new HttpError(400, 'Validation failed', result.error.flatten()));
  }
  req.validated = result.data;
  return next();
};

module.exports = { validate };
