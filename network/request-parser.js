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

  // Sanitize any sensitive tokens if encountered
  if (parsed && typeof parsed === 'object') {
    const sanitized = Object.assign({}, parsed);
    const SENSITIVE_KEYS = ['password', 'secret', 'token', 'auth', 'bearer', 'credit_card'];
    for (const key of Object.keys(sanitized)) {
      if (SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    return sanitized;
  }

  return parsed;
}
