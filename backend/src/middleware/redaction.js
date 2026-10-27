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
  'phone_number',
  'phonenumber',
  'contact_number',
  'contactnumber',
  'email',
  'address',
  'pin_code',
  'pincode',
  'authorization',
  'cookie',
]);

const SENSITIVE_PATTERNS = [
  /(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b)/g, // email
  /(?:\+91[\s-]?)?[6789]\d{9}\b/g, // Indian mobile formats (+91 9876543210, 9876543210)
  /\b\d{5}[-\s]\d{5}\b/g, // 5-5 grouped mobile (98765-43210)
  /\b\d{10}\b/g, // standard 10-digit number
];

function redact(value, seen = new WeakSet()) {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    let result = value;
    for (const pattern of SENSITIVE_PATTERNS) {
      result = result.replace(pattern, '[REDACTED]');
    }
    return result;
  }

  // Preserve Date instances without turning into empty objects
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    // Circular reference guard
    if (seen.has(value)) {
      return '[CIRCULAR]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => redact(item, seen));
    }

    const sanitized = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = redact(val, seen);
      }
    }
    return sanitized;
  }

  return value;
}

function redactionMiddleware(req, res, next) {
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
