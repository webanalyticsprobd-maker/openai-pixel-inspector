/**
 * OpenAI Ads Pixel Inspector - Network Request Parser
 */

export const OPENAI_NETWORK_ENDPOINTS = [
  'bzr.openai.com/v1/sdk/events',
  'bzr.openai.com',
  'bzrcdn.openai.com'
];

export function isOpenAINetworkRequest(url) {
  if (!url || typeof url !== 'string') return false;
  return OPENAI_NETWORK_ENDPOINTS.some((ep) => url.includes(ep));
}

export function parseNetworkPayload(rawPayload) {
  if (!rawPayload) return null;
  let parsed = rawPayload;

  if (typeof rawPayload === 'string') {
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      // Try URL form encoded
      try {
        const params = new URLSearchParams(rawPayload);
        const obj = {};
        for (const [k, v] of params.entries()) {
          obj[k] = v;
        }
        parsed = obj;
      } catch {
        parsed = { rawText: rawPayload };
      }
    }
  }

  return parsed;
}

/**
 * Extracts and classifies customer / user info from a network or parameter payload
 */
export function extractUserInfoFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;

  const userFields = [];
  const visited = new Set();

  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
    return maskedName + '@' + domain;
  }

  function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const clean = phone.trim();
    if (clean.length <= 4) return '***' + clean;
    return clean.slice(0, Math.min(3, clean.length - 4)) + '***' + clean.slice(-4);
  }

  function maskSha(hash) {
    if (!hash || typeof hash !== 'string') return '';
    return hash.slice(0, 6) + '...' + hash.slice(-4);
  }

  function isSha256(str) {
    return typeof str === 'string' && /^[a-f0-9]{64}$/i.test(str.trim());
  }

  function processValue(key, val, fullKey) {
    if (val === undefined || val === null || val === '') return;
    const strVal = String(val).trim();

    // 1. Email detection
    if (
      key === 'email' || key === 'em' || key === 'user_email' || key === 'customer_email' ||
      key === 'email_address' || key === 'mail' || key.endsWith('_email') ||
      (!isSha256(strVal) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal))
    ) {
      const hashed = isSha256(strVal);
      userFields.push({
        type: 'email',
        label: 'Email',
        key: fullKey,
        value: strVal,
        masked: hashed ? `SHA-256 (${maskSha(strVal)})` : maskEmail(strVal),
        isHashed: hashed
      });
      return;
    }

    // 2. Phone detection
    if (
      key === 'phone' || key === 'ph' || key === 'phone_number' || key === 'mobile' ||
      key === 'tel' || key === 'telephone' || key.endsWith('_phone')
    ) {
      const hashed = isSha256(strVal);
      userFields.push({
        type: 'phone',
        label: 'Phone Number',
        key: fullKey,
        value: strVal,
        masked: hashed ? `SHA-256 (${maskSha(strVal)})` : maskPhone(strVal),
        isHashed: hashed
      });
      return;
    }

    // 3. User / Customer ID detection
    if (
      key === 'external_id' || key === 'user_id' || key === 'customer_id' ||
      key === 'client_id' || key === 'lead_id' || key === 'account_id' || key === 'uid'
    ) {
      const hashed = isSha256(strVal);
      userFields.push({
        type: 'user_id',
        label: 'Customer / User ID',
        key: fullKey,
        value: strVal,
        masked: hashed ? `SHA-256 (${maskSha(strVal)})` : strVal,
        isHashed: hashed
      });
      return;
    }

    // 4. Name detection
    if (key === 'first_name' || key === 'fn' || key === 'fname') {
      const hashed = isSha256(strVal);
      userFields.push({
        type: 'first_name',
        label: 'First Name',
        key: fullKey,
        value: strVal,
        masked: hashed ? `SHA-256 (${maskSha(strVal)})` : strVal,
        isHashed: hashed
      });
      return;
    }

    if (key === 'last_name' || key === 'ln' || key === 'lname') {
      const hashed = isSha256(strVal);
      userFields.push({
        type: 'last_name',
        label: 'Last Name',
        key: fullKey,
        value: strVal,
        masked: hashed ? `SHA-256 (${maskSha(strVal)})` : strVal,
        isHashed: hashed
      });
      return;
    }

    // 5. Address / Location
    if (key === 'city' || key === 'ct') {
      userFields.push({ type: 'city', label: 'City', key: fullKey, value: strVal, masked: strVal, isHashed: isSha256(strVal) });
    } else if (key === 'state' || key === 'st' || key === 'province' || key === 'region') {
      userFields.push({ type: 'state', label: 'State / Region', key: fullKey, value: strVal, masked: strVal, isHashed: isSha256(strVal) });
    } else if (key === 'zip' || key === 'zp' || key === 'postal_code' || key === 'postcode' || key === 'zip_code') {
      userFields.push({ type: 'zip', label: 'Postal Code', key: fullKey, value: strVal, masked: strVal, isHashed: isSha256(strVal) });
    } else if (key === 'country' || key === 'country_code') {
      userFields.push({ type: 'country', label: 'Country', key: fullKey, value: strVal, masked: strVal, isHashed: false });
    } else if (key === 'ip_address' || key === 'client_ip' || key === 'ip') {
      userFields.push({ type: 'ip', label: 'IP Address', key: fullKey, value: strVal, masked: strVal.replace(/\d+$/, '***'), isHashed: false });
    }
  }

  function traverse(obj, prefix = '') {
    if (!obj || typeof obj !== 'object' || visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const item = obj[i];
        if (typeof item === 'object' && item !== null) {
          traverse(item, `${prefix}[${i}]`);
        } else {
          const lastKey = prefix.split('.').pop() || '';
          processValue(lastKey.toLowerCase(), item, `${prefix}[${i}]`);
        }
      }
      return;
    }

    for (const [rawKey, val] of Object.entries(obj)) {
      if (val === undefined || val === null || val === '') continue;
      const key = rawKey.toLowerCase().trim();
      const fullKey = prefix ? `${prefix}.${rawKey}` : rawKey;

      if (Array.isArray(val)) {
        for (let i = 0; i < val.length; i++) {
          const item = val[i];
          if (typeof item === 'object' && item !== null) {
            traverse(item, `${fullKey}[${i}]`);
          } else {
            processValue(key, item, `${fullKey}[${i}]`);
          }
        }
        continue;
      }

      if (typeof val === 'object') {
        traverse(val, fullKey);
        continue;
      }

      processValue(key, val, fullKey);
    }
  }

  traverse(payload);

  if (userFields.length === 0) return null;

  return {
    detected: true,
    count: userFields.length,
    fields: userFields,
    hasRawPii: userFields.some((f) => (f.type === 'email' || f.type === 'phone' || f.type === 'first_name' || f.type === 'last_name') && !f.isHashed),
    hasHashedData: userFields.some((f) => f.isHashed)
  };
}
