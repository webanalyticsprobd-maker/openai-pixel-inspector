/**
 * OpenAI Ads Pixel Inspector - Network Request & Batch Event Parser
 * 
 * Primary Source of Truth Engine:
 * 1. Identifies OpenAI browser network requests (bzr.openai.com, /events?pid=...)
 * 2. Extracts Pixel ID from URL query parameters (pid=...), headers, or payload
 * 3. Parses multi-event batch payloads (events[])
 * 4. Classifies events: MEASUREMENT_EVENT vs SDK_INTERNAL vs DIAGNOSTIC
 * 5. Extracts SDK transport metadata (sdkEventId, sourceUrl, referrerUrl, optOut)
 * 6. Decodes User Matching envelope (user.fm) safely without parameter contamination
 * 7. Extracts SDK Diagnostics (dropped events, automatic advanced matching)
 */

import { STANDARD_EVENT_NAMES } from '../validators/schemas.js';

export const OPENAI_NETWORK_ENDPOINTS = [
  'bzr.openai.com/v1/sdk/events',
  'bzr.openai.com/events',
  'bzr.openai.com',
  'bzrcdn.openai.com',
  '/events?pid=',
  'st=oaiq-web'
];

/**
 * Checks if a request URL belongs to OpenAI Ads Pixel ingestion
 */
export function isOpenAINetworkRequest(url) {
  if (!url || typeof url !== 'string') return false;
  const cleanUrl = url.toLowerCase();
  return (
    cleanUrl.includes('bzr.openai.com') ||
    cleanUrl.includes('bzrcdn.openai.com') ||
    cleanUrl.includes('/v1/sdk/events') ||
    (cleanUrl.includes('/events') && (cleanUrl.includes('pid=') || cleanUrl.includes('oaiq')))
  );
}

/**
 * Extracts Pixel ID from request URL query parameters
 */
export function extractPixelIdFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const urlObj = new URL(url, 'https://bzr.openai.com');
    const pid = urlObj.searchParams.get('pid') || urlObj.searchParams.get('pixel_id') || urlObj.searchParams.get('pixelId');
    if (pid && pid.trim() !== '') return pid.trim();
  } catch {
    const match = url.match(/[?&](?:pid|pixel_id|pixelId)=([^&#]+)/i);
    if (match && match[1]) return decodeURIComponent(match[1]).trim();
  }
  return null;
}

/**
 * Safely parses raw request payload (JSON string or object)
 */
export function parseNetworkPayload(rawPayload) {
  if (!rawPayload) return null;
  let parsed = rawPayload;

  if (typeof rawPayload === 'string') {
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
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
 * Classifies an event in the events[] batch array
 * 
 * Categories:
 * - 'MEASUREMENT_EVENT': Standard or custom advertiser event (validated against schema)
 * - 'SDK_INTERNAL': Internal SDK lifecycle event (e.g. openai::sdk_init, sdk_lifecycle)
 * - 'DIAGNOSTIC': SDK diagnostic & telemetry event (e.g. oai::diagnostic)
 * - 'UNKNOWN_INTERNAL': Other internal telemetry
 */
export function classifyNetworkEvent(eventObj) {
  if (!eventObj || typeof eventObj !== 'object') return 'UNKNOWN_INTERNAL';
  const type = (eventObj.type || '').toLowerCase().trim();

  if (type.startsWith('openai::') || type === 'sdk_lifecycle' || type === 'sdk_init') {
    return 'SDK_INTERNAL';
  }

  if (type === 'oai::diagnostic' || type === 'diagnostic') {
    return 'DIAGNOSTIC';
  }

  if (STANDARD_EVENT_NAMES.includes(type) || type === 'custom') {
    return 'MEASUREMENT_EVENT';
  }

  // If event object contains data.type in standard shapes (contents, customer_action, plan_enrollment, custom)
  if (eventObj.data && typeof eventObj.data === 'object' && eventObj.data.type) {
    return 'MEASUREMENT_EVENT';
  }

  // Custom or non-standard advertiser measurement event
  return 'MEASUREMENT_EVENT';
}

/**
 * Parses complete OpenAI Network Request Batch into structured Parent & Child Records
 * 
 * @param {object} netReq - { requestId, url, method, status, timestamp, rawPayload }
 * @returns {object} { parentRequest, measurementEvents, internalEvents, diagnostics, userMatching }
 */
export function parseOpenAINetworkBatch(netReq) {
  const url = netReq.url || '';
  const payload = parseNetworkPayload(netReq.payload || netReq.rawPayload) || {};
  const pixelId = extractPixelIdFromUrl(url) || payload.pixelId || payload.pixel_id || null;

  let sdkType = null;
  let sdkVersion = null;
  try {
    const urlObj = new URL(url, 'https://bzr.openai.com');
    sdkType = urlObj.searchParams.get('st');
    sdkVersion = urlObj.searchParams.get('sv');
  } catch {}

  const obref = payload.obref || null;
  const rawEvents = Array.isArray(payload.events) ? payload.events : [];

  const parentRequest = {
    requestId: netReq.requestId || `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    requestUrl: url,
    method: netReq.method || 'POST',
    status: netReq.status || 200,
    timestamp: netReq.timestamp || Date.now(),
    pixelId: pixelId,
    sdkType: sdkType,
    sdkVersion: sdkVersion,
    obref: obref,
    totalEventsCount: rawEvents.length,
    rawPayload: payload
  };

  const measurementEvents = [];
  const internalEvents = [];
  let diagnostics = null;

  rawEvents.forEach((subEvt, idx) => {
    const category = classifyNetworkEvent(subEvt);

    if (category === 'MEASUREMENT_EVENT') {
      const eventName = subEvt.type || 'unknown';
      const eventData = (subEvt.data && typeof subEvt.data === 'object') ? subEvt.data : {};
      const sdkEventId = subEvt.id || null;
      const timestampMs = subEvt.timestamp_ms || netReq.timestamp || Date.now();
      const sourceUrl = subEvt.source_url || null;
      const referrerUrl = subEvt.referrer_url || null;
      const optOut = subEvt.opt_out !== undefined ? subEvt.opt_out : null;

      measurementEvents.push({
        parentRequestId: parentRequest.requestId,
        batchIndex: idx,
        category: 'MEASUREMENT_EVENT',
        name: eventName,
        eventName: eventName,
        data: eventData,
        parameters: eventData, // Actual transmitted event parameters (data object)
        options: {
          opt_out: optOut
        },
        pixelId: pixelId,
        sdkEventId: sdkEventId,
        timestamp: timestampMs,
        sourceUrl: sourceUrl,
        referrerUrl: referrerUrl,
        optOut: optOut,
        rawEvent: subEvt,
        source: {
          type: 'network',
          location: 'browser_network_request',
          caller: 'Browser Network Request (bzr.openai.com)',
          method: 'network'
        }
      });
    } else if (category === 'DIAGNOSTIC') {
      const diagData = subEvt.data || {};
      diagnostics = {
        schemaVersion: diagData.schema_version || 1,
        droppedEventCount: diagData.dropped_event_count || 0,
        droppedEventReasonCounts: diagData.dropped_event_reason_counts || {},
        droppedEventNameCounts: diagData.dropped_event_name_counts || {},
        droppedEventPhaseCounts: diagData.dropped_event_phase_counts || {},
        automaticAdvancedMatching: diagData.config?.automatic_advanced_matching || 'disabled',
        timestamp: subEvt.timestamp_ms || Date.now()
      };
      internalEvents.push({
        type: 'DIAGNOSTIC',
        name: subEvt.type,
        id: subEvt.id,
        timestamp: subEvt.timestamp_ms,
        data: diagData
      });
    } else {
      // SDK_INTERNAL (e.g. openai::sdk_init)
      internalEvents.push({
        type: 'SDK_INTERNAL',
        name: subEvt.type,
        id: subEvt.id,
        timestamp: subEvt.timestamp_ms,
        data: subEvt.data || {}
      });
    }
  });

  // Extract User Matching Envelope from top-level payload.user
  const userMatching = extractUserMatchingEnvelope(payload.user);

  return {
    parentRequest: parentRequest,
    measurementEvents: measurementEvents,
    internalEvents: internalEvents,
    diagnostics: diagnostics,
    userMatching: userMatching
  };
}

/**
 * Extracts and safely formats Advanced Matching user data from payload.user
 */
export function extractUserMatchingEnvelope(userObj) {
  if (!userObj || typeof userObj !== 'object') return null;

  const fm = userObj.fm || userObj;
  const fields = [];

  function maskSha(hash) {
    if (!hash || typeof hash !== 'string') return '';
    return hash.slice(0, 6) + '...' + hash.slice(-4);
  }

  function isSha256(str) {
    return typeof str === 'string' && /^[a-f0-9]{64}$/i.test(str.trim());
  }

  // 1. Email
  if (fm.em) {
    const emArr = Array.isArray(fm.em) ? fm.em : [fm.em];
    emArr.forEach((emVal, idx) => {
      const isHash = isSha256(emVal);
      fields.push({
        type: 'email',
        label: emArr.length > 1 ? `Email [${idx + 1}]` : 'Email',
        value: emVal,
        masked: isHash ? `SHA-256 (${maskSha(emVal)})` : emVal,
        isHashed: isHash
      });
    });
  }

  // 2. Phone
  if (fm.ph) {
    const phArr = Array.isArray(fm.ph) ? fm.ph : [fm.ph];
    phArr.forEach((phVal, idx) => {
      const isHash = isSha256(phVal);
      fields.push({
        type: 'phone',
        label: phArr.length > 1 ? `Phone [${idx + 1}]` : 'Phone',
        value: phVal,
        masked: isHash ? `SHA-256 (${maskSha(phVal)})` : phVal,
        isHashed: isHash
      });
    });
  }

  // 3. First Name & Last Name
  if (fm.fn) {
    const isHash = isSha256(fm.fn);
    fields.push({
      type: 'first_name',
      label: 'First Name',
      value: fm.fn,
      masked: isHash ? `SHA-256 (${maskSha(fm.fn)})` : fm.fn,
      isHashed: isHash
    });
  }
  if (fm.ln) {
    const isHash = isSha256(fm.ln);
    fields.push({
      type: 'last_name',
      label: 'Last Name',
      value: fm.ln,
      masked: isHash ? `SHA-256 (${maskSha(fm.ln)})` : fm.ln,
      isHashed: isHash
    });
  }

  // 4. Address & Location fields
  if (fm.co) {
    fields.push({ type: 'country', label: 'Country', value: fm.co, masked: String(fm.co).toUpperCase(), isHashed: false });
  }
  if (fm.ct) {
    fields.push({ type: 'city', label: 'City', value: fm.ct, masked: String(fm.ct), isHashed: false });
  }
  if (fm.rg) {
    fields.push({ type: 'region', label: 'Region / State', value: fm.rg, masked: String(fm.rg), isHashed: false });
  }
  if (fm.pc) {
    fields.push({ type: 'postal_code', label: 'Postal Code', value: fm.pc, masked: String(fm.pc), isHashed: false });
  }

  if (fields.length === 0) return null;

  return {
    detected: true,
    count: fields.length,
    fields: fields,
    hasHashedData: fields.some(f => f.isHashed),
    rawUser: userObj
  };
}

/**
 * Extracts and classifies customer / user info from a network or parameter payload (fallback)
 */
export function extractUserInfoFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.user && typeof payload.user === 'object') {
    return extractUserMatchingEnvelope(payload.user);
  }
  return extractUserMatchingEnvelope(payload);
}
