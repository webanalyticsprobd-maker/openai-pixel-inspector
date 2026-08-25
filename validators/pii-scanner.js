/**
 * OpenAI Ads Pixel Inspector - PII & Privacy Compliance Scanner
 * 
 * Inspects event parameters, URLs, and custom payloads for unhashed
 * Personally Identifiable Information (PII) to ensure GDPR, CCPA,
 * and OpenAI advertising data privacy compliance.
 */

// Regular expressions for sensitive data detection
const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
const URL_ENCODED_EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+%40[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

// Phone: International (+1..., +44..., +880...) or standard 10-14 digit formats
const PHONE_REGEX = /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}\b/;

// Credit Card / PAN (Luhn Candidate detection: 13-19 digits with optional spaces/hyphens)
const CREDIT_CARD_CANDIDATE_REGEX = /\b(?:\d[ -]*?){13,19}\b/;

// Social Security / National ID patterns
const US_SSN_REGEX = /\b(?!000|666|9\d{2})\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/;

// High-entropy token / Auth secret patterns
const AUTH_TOKEN_REGEX = /(?:bearer\s+[A-Za-z0-9\-._~+/]+=*|ey[A-Za-z0-9-_=]+\.ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_.+/=]*)/i;

/**
 * Validates credit card number with Luhn algorithm
 */
function isLuhnValid(digitsStr) {
  const sanitized = digitsStr.replace(/\D/g, '');
  if (sanitized.length < 13 || sanitized.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = sanitized.length - 1; i >= 0; i--) {
    let digit = parseInt(sanitized.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

/**
 * Masks a sensitive string for safe UI presentation
 */
export function maskPii(val, type) {
  if (typeof val !== 'string') val = String(val || '');
  if (type === 'email') {
    const parts = val.split('@');
    if (parts.length === 2) {
      const name = parts[0];
      const domain = parts[1];
      const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`;
      return `${maskedName}@${domain}`;
    }
    return '***@***.***';
  } else if (type === 'credit_card') {
    const digits = val.replace(/\D/g, '');
    return `****-****-****-${digits.slice(-4)}`;
  } else if (type === 'phone') {
    const digits = val.replace(/\D/g, '');
    return `+***-***-${digits.slice(-4)}`;
  } else if (type === 'ssn') {
    return '***-**-****';
  } else if (type === 'token_secret') {
    return `${val.substring(0, 4)}****************`;
  }
  return '*** [CONFIDENTIAL PII] ***';
}

/**
 * Recursively scans an object, array, or string for PII violations
 */
export function scanForPii(data, currentPath = '') {
  const issues = [];

  if (data === null || data === undefined) return issues;

  if (typeof data === 'string') {
    // 1. Plaintext Email
    if (EMAIL_REGEX.test(data) || URL_ENCODED_EMAIL_REGEX.test(data)) {
      if (!SHA256_HEX_REGEX.test(data.trim())) {
        const match = data.match(EMAIL_REGEX) || data.match(URL_ENCODED_EMAIL_REGEX);
        const raw = match ? match[0] : data;
        issues.push({
          path: currentPath || 'value',
          type: 'email',
          severity: 'error',
          raw: raw,
          masked: maskPii(raw, 'email'),
          message: `Unhashed plaintext email detected in '${currentPath || 'payload'}'.`,
          recommendation: 'OpenAI Ads require emails in user_data to be normalized (trimmed, lowercased) and hashed with SHA-256.'
        });
      }
    }

    // 2. Credit Card / PAN
    if (CREDIT_CARD_CANDIDATE_REGEX.test(data)) {
      const cardMatch = data.match(CREDIT_CARD_CANDIDATE_REGEX);
      if (cardMatch && isLuhnValid(cardMatch[0])) {
        issues.push({
          path: currentPath || 'value',
          type: 'credit_card',
          severity: 'critical',
          raw: cardMatch[0],
          masked: maskPii(cardMatch[0], 'credit_card'),
          message: `Potential Payment Card (PAN) detected in '${currentPath || 'payload'}'.`,
          recommendation: 'CRITICAL: Never transmit raw payment card numbers through advertising measurement pixels. Remove immediately.'
        });
      }
    }

    // 3. Social Security / National ID
    if (US_SSN_REGEX.test(data) && currentPath.toLowerCase().includes('ssn')) {
      const ssnMatch = data.match(US_SSN_REGEX);
      issues.push({
        path: currentPath || 'value',
        type: 'ssn',
        severity: 'critical',
        raw: ssnMatch ? ssnMatch[0] : data,
        masked: maskPii(data, 'ssn'),
        message: `Government/National ID number pattern detected in '${currentPath || 'payload'}'.`,
        recommendation: 'Do not send Social Security Numbers or government ID numbers to OpenAI Ads pixels.'
      });
    }

    // 4. Auth Tokens / Secret Keys
    if (AUTH_TOKEN_REGEX.test(data) || (currentPath.toLowerCase().includes('token') && data.length > 30)) {
      issues.push({
        path: currentPath || 'value',
        type: 'token_secret',
        severity: 'warning',
        raw: data,
        masked: maskPii(data, 'token_secret'),
        message: `Authentication secret or JWT token pattern detected in '${currentPath || 'payload'}'.`,
        recommendation: 'Ensure internal authentication headers and private user session tokens are not leaked into analytics.'
      });
    }

    // 5. Phone Numbers (when field name indicates phone or string matches international format)
    const lowerKey = currentPath.toLowerCase();
    if (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('tel')) {
      if (!SHA256_HEX_REGEX.test(data.trim()) && PHONE_REGEX.test(data)) {
        issues.push({
          path: currentPath,
          type: 'phone',
          severity: 'error',
          raw: data,
          masked: maskPii(data, 'phone'),
          message: `Unhashed phone number detected in '${currentPath || 'payload'}'.`,
          recommendation: 'Normalize phone numbers into E.164 format and hash with SHA-256 before sending in user_data.'
        });
      }
    }
  } else if (typeof data === 'number') {
    const numStr = String(data);
    const lowerKey = currentPath.toLowerCase();
    if ((lowerKey.includes('phone') || lowerKey.includes('mobile')) && numStr.length >= 10) {
      issues.push({
        path: currentPath,
        type: 'phone',
        severity: 'error',
        raw: numStr,
        masked: maskPii(numStr, 'phone'),
        message: `Raw numeric phone number detected in '${currentPath || 'payload'}'.`,
        recommendation: 'Format phone numbers with E.164 standard and hash with SHA-256.'
      });
    }
  } else if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      const subPath = currentPath ? `${currentPath}[${idx}]` : `[${idx}]`;
      issues.push(...scanForPii(item, subPath));
    });
  } else if (typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      const subPath = currentPath ? `${currentPath}.${k}` : k;
      issues.push(...scanForPii(v, subPath));
    }
  }

  return issues;
}
