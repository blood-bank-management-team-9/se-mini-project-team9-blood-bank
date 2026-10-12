// Error with the HTTP status and code from SAD 4.4.
class AppError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}
module.exports = AppError;
