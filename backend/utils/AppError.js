// A predictable, operational error class. Anything thrown as an AppError
// is safe to show to the client; anything else gets masked as a generic
// "something went wrong" message by the global error handler.
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
