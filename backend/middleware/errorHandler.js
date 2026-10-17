const AppError = require('../utils/AppError');

// Central error handler. Operational (AppError) errors are shown to the
// client as-is; anything unexpected is logged server-side and masked
// with a generic message so we never leak stack traces or internals.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let error = err;

  if (err.name === 'CastError') {
    error = new AppError('Resource not found.', 404);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    error = new AppError(`A record with this ${field} already exists.`, 409);
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(' ');
    error = new AppError(message || 'Please check your information and try again.', 400);
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = new AppError('Invalid or expired session. Please log in again.', 401);
  }

  const statusCode = error.statusCode || 500;
  const isOperational = error.isOperational;

  if (!isOperational) {
    console.error('UNEXPECTED ERROR:', err);
  }

  res.status(statusCode).json({
    success: false,
    message: isOperational ? error.message : 'Something went wrong. Please try again later.'
  });
}

function notFoundHandler(req, res, next) {
  next(new AppError(`Route ${req.originalUrl} not found.`, 404));
}

module.exports = { errorHandler, notFoundHandler };
