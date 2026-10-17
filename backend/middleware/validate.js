const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

// Runs after express-validator chains; collects errors into one
// friendly AppError instead of leaking raw validator internals.
module.exports = function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array().map((e) => e.msg).join(' ');
    return next(new AppError(message, 400));
  }
  next();
};
