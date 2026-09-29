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

export function extractPixelIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('pid') || null;
  } catch {
    const match = url.match(/[?&]pid=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

export function classifyNetworkEvent(eventItem) {
  if (!eventItem) return 'MEASUREMENT_EVENT';
  const type = eventItem.type || eventItem.name || '';
  if (type === 'openai::sdk_init' || type.startsWith('openai::')) {
    return 'SDK_INTERNAL';
  }
  if (type === 'oai::diagnostic' || type.startsWith('oai::')) {
    return 'DIAGNOSTIC';
  }
  return 'MEASUREMENT_EVENT';
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

  // Sanitize sensitive tokens
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

export function parseOpenAINetworkBatch(rawBatch) {
  const url = rawBatch.url || '';
  const payload = rawBatch.rawPayload || rawBatch.payload || {};
  const query = {};
  try {
    const u = new URL(url);
    for (const [k, v] of u.searchParams.entries()) {
      query[k] = v;
    }
  } catch {}

  const events = Array.isArray(payload.events) ? payload.events : [];
  const measurementEvents = [];
  const internalEvents = [];
  let diagnostics = {
    droppedEventCount: 0,
    automaticAdvancedMatching: 'none'
  };

  events.forEach((evt) => {
    const category = classifyNetworkEvent(evt);
    if (category === 'SDK_INTERNAL' || category === 'DIAGNOSTIC') {
      internalEvents.push(evt);
      if (category === 'DIAGNOSTIC' && evt.data) {
        if (evt.data.dropped_event_count !== undefined) {
          diagnostics.droppedEventCount = evt.data.dropped_event_count;
        }
        if (evt.data.config?.automatic_advanced_matching) {
          diagnostics.automaticAdvancedMatching = evt.data.config.automatic_advanced_matching;
        }
      }
    } else {
      measurementEvents.push(evt);
    }
  });

  return {
    parentRequest: {
      totalEventsCount: events.length || (payload ? 1 : 0),
      obref: payload.obref || null
    },
    openAIRequest: {
      query: query,
      transport: {
        obref: payload.obref || null
      }
    },
    measurementEvents: measurementEvents,
    internalEvents: internalEvents,
    diagnostics: diagnostics
  };
}

export function extractUserMatchingEnvelope(userObj) {
  if (!userObj || typeof userObj !== 'object') {
    return { detected: false, count: 0, hasHashedData: false, fields: [] };
  }

  const fm = userObj.in || userObj.fm || userObj;
  const fields = [];
  let count = 0;
  let hasHashedData = false;

  const keyToType = {
    eid: 'external_id',
    em: 'email',
    ph: 'phone',
    fn: 'first_name',
    ln: 'last_name',
    co: 'country',
    ct: 'city',
    rg: 'region',
    pc: 'postal_code',
    db: 'dob',
    ge: 'gender'
  };

  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null || v === '') continue;
    count++;
    const typeName = keyToType[k] || k;
    const rawVal = Array.isArray(v) ? v[0] : String(v);
    const isSha256 = typeof rawVal === 'string' && /^[a-f0-9]{64}$/i.test(rawVal);

    if (isSha256) {
      hasHashedData = true;
      const masked = `SHA-256 (${rawVal.slice(0, 6)}...${rawVal.slice(-4)})`;
      fields.push({
        key: k,
        type: typeName,
        isHashed: true,
        masked: masked,
        value: rawVal
      });
    } else {
      fields.push({
        key: k,
        type: typeName,
        isHashed: false,
        masked: String(rawVal),
        value: rawVal
      });
    }
  }

  return {
    detected: count > 0,
    count: count,
    hasHashedData: hasHashedData,
    fields: fields
  };
}
