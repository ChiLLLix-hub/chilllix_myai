const { HttpError } = require('../utils/http-error');

const notFoundHandler = (_req, _res, next) => next(new HttpError(404, 'Not found'));

const errorHandler = (error, _req, res, _next) => {
  const status = error.status || 500;
  const payload = {
    error: error.message || 'Internal server error',
  };

  if (error.details) payload.details = error.details;
  if (!(error instanceof HttpError)) console.error(error);

  res.status(status).json(payload);
};

module.exports = { notFoundHandler, errorHandler };
