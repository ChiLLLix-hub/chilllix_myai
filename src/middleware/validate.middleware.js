const { HttpError } = require('../utils/http-error');

const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse({ body: req.body, query: req.query, params: req.params });
  if (!result.success) {
    return next(new HttpError(400, 'Validation failed', result.error.flatten()));
  }
  req.validated = result.data;
  req.body = result.data.body;
  req.query = result.data.query;
  req.params = result.data.params;
  return next();
};

module.exports = { validate };
