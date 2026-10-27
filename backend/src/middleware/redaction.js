// NFR-SEC-07 & SAD 4.4: Log Redaction Utility & Middleware
// Passwords, phone numbers, email addresses and personal addresses
// are redacted and never written to application logs or audit logs.

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'currentpassword',
  'newpassword',
  'confirmpassword',
  'token',
  'token_hash',
  'phone',
  'phonenumber',
  'contact_number',
  'contactnumber',
  'email',
  'address',
]);

const SENSITIVE_PATTERNS = [
  /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g, // email
  /(\b\d{10}\b)/g, // 10-digit phone
];

function redact(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    let result = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (typeof value === 'object') {
    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redact(val);
      }
    }
    return sanitized;
  }
  return value;
}

function redactionMiddleware(req, res, next) {
  // Protect req.body from accidental logging
  if (req.body && typeof req.body === 'object') {
    req.sanitizedBody = redact(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.sanitizedQuery = redact(req.query);
  }
  next();
}

module.exports = {
  redact,
  redactionMiddleware,
  SENSITIVE_KEYS,
};
