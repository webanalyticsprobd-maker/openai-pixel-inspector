/**
 * OpenAI Ads Pixel Inspector - Network Request & Batch Event Parser
 * 
 * Core Architectural Rule: 1 Network Request ≠ 1 OpenAI Event.
 * 
 * OpenAI batches closely grouped Pixel events into a single POST call.
 * This module normalizes every network request into the standard OpenAIRequest container:
 * 
 * OpenAIRequest
 * │
 * ├── id, tabId, requestId, capturedAt
 * ├── request (fullUrl, endpoint, host, method, protocol, statusCode, statusText, startTime, completedTime)
 * ├── query (pid, st, sv, t, ec, unknown[])
 * ├── sdk (pixelId, sdkType, sdkVersion, eventCount)
 * ├── transport (obref, unknownFields[])
 * ├── events[] (raw, type, friendlyName, category, eventId, timestamp, sourceUrl, referrerUrl, optOut, dataType, data)
 * ├── matching (supports user.in, user.fm, rawPaths, normalizedFields)
 * ├── matchingConfig (automaticAdvancedMatching)
 * ├── diagnostics (schemaVersion, droppedEventCount, droppedReasons, droppedNames, droppedPhases)
 * ├── derived (decodedRequestTime, batchDelay, hostname, pagePath, pageType, decodedAmount, journeyContext)
 * ├── validation (Level 1 Network + Level 2-4 validation passes, warnings, errors, info)
 * └── raw (headers, url, rawBody, parsedBody)
 */

import { STANDARD_EVENT_NAMES, EVENT_REGISTRY, decodeMoney } from '../validators/schemas.js';

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
 * Classifies an event in the events[] batch array into system, diagnostic, or business categories.
 */
export function classifyNetworkEvent(eventObj) {
  if (!eventObj || typeof eventObj !== 'object') return 'UNKNOWN_INTERNAL';
  const type = (eventObj.type || '').toLowerCase().trim();

  if (type === 'openai::sdk_init' || type.startsWith('openai::') || type === 'sdk_lifecycle' || type === 'sdk_init') {
    return 'SDK_INTERNAL';
  }

  if (type === 'oai::diagnostic' || type === 'diagnostic') {
    return 'DIAGNOSTIC';
  }

  const reg = EVENT_REGISTRY[type];
  if (reg) {
    if (reg.category === 'system') return 'SDK_INTERNAL';
    if (reg.category === 'diagnostic') return 'DIAGNOSTIC';
    return 'MEASUREMENT_EVENT';
  }

  if (STANDARD_EVENT_NAMES.includes(type) || type === 'custom') {
    return 'MEASUREMENT_EVENT';
  }

  return 'MEASUREMENT_EVENT';
}

/**
 * Derives human-friendly page context from URL pathname
 */
export function decodePageType(url) {
  if (!url || typeof url !== 'string') return 'Unknown Page';
  try {
    const u = new URL(url, 'https://example.com');
    const path = u.pathname.toLowerCase();
    if (path === '' || path === '/') return 'Homepage';
    if (path.includes('finish') || path.includes('thank-you') || path.includes('order-received') || path.includes('success')) return 'Checkout Finish';
    if (path.includes('checkout')) return 'Checkout';
    if (path.includes('cart') || path.includes('basket')) return 'Cart';
    if (path.includes('account/order') || path.includes('my-account')) return 'Account / Order';
    if (path.includes('product') || path.includes('item') || path.includes('-lizenz-') || path.includes('-server-')) return 'Product Page';
    if (path.includes('quote') || path.includes('lead') || path.includes('contact')) return 'Lead / Contact Page';
    if (path.includes('pricing') || path.includes('plans') || path.includes('subscribe')) return 'Pricing Page';
    return 'Page (' + (path.length > 25 ? path.slice(0, 22) + '...' : path) + ')';
  } catch {
    return 'Page';
  }
}

/**
 * Derives customer navigation journey flow from source and referrer URLs
 */
export function decodeJourneyContext(sourceUrl, referrerUrl) {
  const from = referrerUrl ? decodePageType(referrerUrl) : 'Direct Navigation';
  const to = sourceUrl ? decodePageType(sourceUrl) : 'Unknown Destination';
  return `${from} → ${to}`;
}

/**
 * Checks if a string is a 64-character lowercase hexadecimal SHA-256 hash
 */
export function isSha256Hex(str) {
  return typeof str === 'string' && /^[a-f0-9]{64}$/.test(str.trim());
}

/**
 * Masks a 64-character hash: SHA-256 (21e179...cead) or 21e179aa...cead
 */
export function maskHash(hash) {
  if (!hash || typeof hash !== 'string') return '';
  const clean = hash.trim();
  if (clean.length < 12) return clean;
  return `SHA-256 (${clean.slice(0, 6)}...${clean.slice(-4)})`;
}

/**
 * Flexible User Matching Normalizer supporting both user.in (eid, em) and user.fm (em, ph, fn, ln, co, ct, rg, pc)
 */
export function extractUserMatchingEnvelope(userObj) {
  if (!userObj || typeof userObj !== 'object') return null;

  const rawPaths = {};
  const normalizedFields = [];
  let rawPiiDetected = false;

  function processField(path, type, label, val) {
    if (val === undefined || val === null) return;
    const items = Array.isArray(val) ? val : [val];
    rawPaths[path] = val;

    items.forEach((item, idx) => {
      const itemStr = String(item).trim();
      const isHash = isSha256Hex(itemStr);
      const isRawEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(itemStr);

      if (isRawEmail) {
        rawPiiDetected = true;
      }

      normalizedFields.push({
        type: type,
        label: items.length > 1 ? `${label} [${idx + 1}]` : label,
        rawPath: items.length > 1 ? `${path}[${idx}]` : path,
        value: itemStr,
        masked: isHash ? maskHash(itemStr) : itemStr,
        isHashed: isHash,
        isRawEmail: isRawEmail,
        validHash: isHash
      });
    });
  }

  // Structure A: user.in (e.g. eid, em)
  if (userObj.in && typeof userObj.in === 'object') {
    if (userObj.in.eid) processField('user.in.eid', 'external_id', 'External Identity (eid)', userObj.in.eid);
    if (userObj.in.em) processField('user.in.em', 'email', 'Email Hash (em)', userObj.in.em);
    for (const [k, v] of Object.entries(userObj.in)) {
      if (k !== 'eid' && k !== 'em') {
        processField(`user.in.${k}`, k, `Identity Signal (${k})`, v);
      }
    }
  }

  // Structure B: user.fm (e.g. em, ph, fn, ln, co, ct, rg, pc)
  if (userObj.fm && typeof userObj.fm === 'object') {
    if (userObj.fm.em) processField('user.fm.em', 'email', 'Email', userObj.fm.em);
    if (userObj.fm.ph) processField('user.fm.ph', 'phone', 'Phone Number', userObj.fm.ph);
    if (userObj.fm.fn) processField('user.fm.fn', 'first_name', 'First Name', userObj.fm.fn);
    if (userObj.fm.ln) processField('user.fm.ln', 'last_name', 'Last Name', userObj.fm.ln);
    if (userObj.fm.co) processField('user.fm.co', 'country', 'Country', userObj.fm.co);
    if (userObj.fm.ct) processField('user.fm.ct', 'city', 'City', userObj.fm.ct);
    if (userObj.fm.rg) processField('user.fm.rg', 'region', 'Region / State', userObj.fm.rg);
    if (userObj.fm.pc) processField('user.fm.pc', 'postal_code', 'Postal Code', userObj.fm.pc);
    for (const [k, v] of Object.entries(userObj.fm)) {
      if (!['em', 'ph', 'fn', 'ln', 'co', 'ct', 'rg', 'pc'].includes(k)) {
        processField(`user.fm.${k}`, k, `Form Matching (${k})`, v);
      }
    }
  }

  // Fallback: direct properties on user (e.g. user.eid or user.email)
  for (const [k, v] of Object.entries(userObj)) {
    if (k !== 'in' && k !== 'fm' && typeof v !== 'object') {
      processField(`user.${k}`, k, `User (${k})`, v);
    }
  }

  if (normalizedFields.length === 0) return null;

  return {
    detected: true,
    count: normalizedFields.length,
    fields: normalizedFields,
    rawPaths: rawPaths,
    rawUser: userObj,
    hasHashedData: normalizedFields.some(f => f.isHashed),
    rawPiiDetected: rawPiiDetected
  };
}

/**
 * Extracts user info from event payload or top-level request user object
 */
export function extractUserInfoFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.user && typeof payload.user === 'object') {
    return extractUserMatchingEnvelope(payload.user);
  }
  return extractUserMatchingEnvelope(payload);
}

/**
 * Normalizes an intercepted browser network request into the full OpenAIRequest container.
 * 
 * @param {object} netReq - Intercepted network data: { requestId, url, method, status, timestamp, rawPayload, headers }
 * @returns {object} Full normalized OpenAIRequest container
 */
export function normalizeOpenAIRequest(netReq) {
  const url = netReq.url || '';
  const parsedBody = parseNetworkPayload(netReq.payload || netReq.rawPayload) || {};
  const rawBodyText = typeof netReq.rawPayload === 'string' ? netReq.rawPayload : JSON.stringify(parsedBody, null, 2);

  let urlObj = null;
  try {
    urlObj = new URL(url, 'https://bzr.openai.com');
  } catch {}

  // 1. Query parameters
  const queryParams = {
    pid: urlObj?.searchParams.get('pid') || parsedBody.pixelId || parsedBody.pixel_id || null,
    st: urlObj?.searchParams.get('st') || 'oaiq-web',
    sv: urlObj?.searchParams.get('sv') || null,
    t: urlObj?.searchParams.get('t') ? Number(urlObj.searchParams.get('t')) : null,
    ec: urlObj?.searchParams.get('ec') ? Number(urlObj.searchParams.get('ec')) : null,
    unknown: []
  };

  if (urlObj) {
    for (const [k, v] of urlObj.searchParams.entries()) {
      if (!['pid', 'pixel_id', 'pixelId', 'st', 'sv', 't', 'ec'].includes(k)) {
        queryParams.unknown.push({ key: k, value: v });
      }
    }
  }

  // 2. Transport & Request-Level Data
  const obref = parsedBody.obref || null;
  const rawEvents = Array.isArray(parsedBody.events) ? parsedBody.events : [];
  const unknownTransportFields = [];
  for (const [k, v] of Object.entries(parsedBody)) {
    if (!['obref', 'events', 'user', 'pixelId', 'pixel_id'].includes(k)) {
      unknownTransportFields.push({ key: k, value: v, path: k });
    }
  }

  // 3. User Matching
  const userMatching = extractUserMatchingEnvelope(parsedBody.user);

  // 4. Events Normalization
  let sdkDiagnostics = null;
  let automaticAdvancedMatching = 'disabled';
  const events = [];
  let earliestEventTime = null;
  let latestEventTime = null;

  rawEvents.forEach((rawEvt, idx) => {
    const rawType = rawEvt.type || 'unknown';
    const reg = EVENT_REGISTRY[rawType] || { friendlyName: rawType, category: 'custom', dataType: 'custom', icon: '•' };
    const eventId = rawEvt.id || null;
    const timestampMs = rawEvt.timestamp_ms || netReq.timestamp || Date.now();
    const sourceUrl = rawEvt.source_url || null;
    const referrerUrl = rawEvt.referrer_url || null;
    const optOut = rawEvt.opt_out !== undefined ? rawEvt.opt_out : null;
    const evtData = (rawEvt.data && typeof rawEvt.data === 'object') ? rawEvt.data : {};
    const dataType = evtData.type || null;

    if (earliestEventTime === null || timestampMs < earliestEventTime) earliestEventTime = timestampMs;
    if (latestEventTime === null || timestampMs > latestEventTime) latestEventTime = timestampMs;

    if (rawType === 'oai::diagnostic' || rawType === 'diagnostic') {
      automaticAdvancedMatching = evtData.config?.automatic_advanced_matching || 'disabled';
      sdkDiagnostics = {
        schemaVersion: evtData.schema_version || 1,
        droppedEventCount: evtData.dropped_event_count || 0,
        droppedReasons: evtData.dropped_event_reason_counts || {},
        droppedNames: evtData.dropped_event_name_counts || {},
        droppedPhases: evtData.dropped_event_phase_counts || {},
        automaticAdvancedMatching: automaticAdvancedMatching,
        timestamp: timestampMs
      };
    }

    const classifiedCategory = classifyNetworkEvent(rawEvt);
    events.push({
      raw: rawEvt,
      type: rawType,
      friendlyName: reg.friendlyName || rawType,
      category: classifiedCategory,
      icon: reg.icon || '•',
      eventId: eventId,
      timestamp: timestampMs,
      sourceUrl: sourceUrl,
      referrerUrl: referrerUrl,
      optOut: optOut,
      dataType: dataType,
      data: evtData,
      batchIndex: idx
    });
  });

  // 5. Derived Information
  const requestTimestamp = queryParams.t || netReq.timestamp || Date.now();
  const batchDelayMs = earliestEventTime ? Math.max(0, requestTimestamp - earliestEventTime) : null;
  const primarySourceUrl = events.find(e => e.sourceUrl)?.sourceUrl || url;
  const primaryReferrerUrl = events.find(e => e.referrerUrl)?.referrerUrl || null;
  let hostname = '';
  let pagePath = '';
  try {
    const pU = new URL(primarySourceUrl);
    hostname = pU.hostname;
    pagePath = pU.pathname;
  } catch {}

  const pageType = decodePageType(primarySourceUrl);
  const journeyContext = decodeJourneyContext(primarySourceUrl, primaryReferrerUrl);

  // 6. Level 1 Network Validation Checks
  const networkPasses = [];
  const networkWarnings = [];
  const networkErrors = [];
  const networkInfo = [];

  if (url.startsWith('https://')) {
    networkPasses.push('Request uses secure HTTPS protocol');
  } else {
    networkErrors.push('Request does not use HTTPS');
  }

  if (url.includes('bzr.openai.com')) {
    networkPasses.push('Destination is official OpenAI ingestion host (bzr.openai.com)');
  } else {
    networkWarnings.push(`Unusual request destination host: ${urlObj?.hostname || 'unknown'}`);
  }

  if (netReq.method === 'POST') {
    networkPasses.push('Request method is POST');
  } else {
    networkErrors.push(`Expected POST request method, got ${netReq.method || 'GET'}`);
  }

  const statusCode = netReq.status || 202;
  if (statusCode >= 200 && statusCode < 300) {
    if (statusCode === 202) {
      networkPasses.push('HTTP 202 Accepted — OpenAI accepted the batch for processing');
    } else {
      networkPasses.push(`HTTP ${statusCode} Accepted`);
    }
  } else if (statusCode >= 400 && statusCode < 500) {
    networkErrors.push(`HTTP ${statusCode} — Request rejected by OpenAI client error`);
  } else if (statusCode >= 500) {
    networkErrors.push(`HTTP ${statusCode} — OpenAI server-side error`);
  }

  if (queryParams.pid) {
    networkPasses.push(`Pixel ID query parameter present (${queryParams.pid})`);
  } else {
    networkErrors.push('Missing required Pixel ID parameter (pid=)');
  }

  if (queryParams.ec !== null) {
    if (queryParams.ec === rawEvents.length) {
      networkPasses.push(`Event count query parameter (ec=${queryParams.ec}) matches payload events array (${rawEvents.length})`);
    } else {
      networkWarnings.push(`Event count mismatch: query param ec=${queryParams.ec} but payload contains ${rawEvents.length} events`);
    }
  }

  if (obref) {
    networkInfo.push(`Internal SDK browser reference (obref): ${obref}`);
  }

  return {
    id: `REQ_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    tabId: netReq.tabId || null,
    requestId: netReq.requestId || `REQ_${Date.now()}`,
    capturedAt: netReq.timestamp || Date.now(),
    request: {
      fullUrl: url,
      endpoint: urlObj?.pathname || '/v1/sdk/events',
      host: urlObj?.hostname || 'bzr.openai.com',
      method: netReq.method || 'POST',
      protocol: urlObj?.protocol?.replace(':', '').toUpperCase() || 'HTTPS',
      statusCode: statusCode,
      statusText: statusCode === 202 ? 'Accepted' : (statusCode === 200 ? 'OK' : 'Response'),
      startTime: earliestEventTime || netReq.timestamp || Date.now(),
      completedTime: netReq.responseTimestamp || netReq.timestamp || Date.now()
    },
    query: queryParams,
    sdk: {
      pixelId: queryParams.pid,
      sdkType: queryParams.st,
      sdkVersion: queryParams.sv,
      eventCount: rawEvents.length
    },
    transport: {
      obref: obref,
      unknownFields: unknownTransportFields
    },
    events: events,
    matching: userMatching,
    matchingConfig: {
      automaticAdvancedMatching: automaticAdvancedMatching
    },
    diagnostics: sdkDiagnostics,
    derived: {
      decodedRequestTime: new Date(requestTimestamp).toLocaleString(),
      batchDelay: batchDelayMs !== null ? `${(batchDelayMs / 1000).toFixed(2)}s` : '0.00s',
      batchDelayMs: batchDelayMs || 0,
      hostname: hostname,
      pagePath: pagePath,
      pageType: pageType,
      journeyContext: journeyContext
    },
    validation: {
      passes: networkPasses,
      warnings: networkWarnings,
      errors: networkErrors,
      info: networkInfo,
      status: networkErrors.length > 0 ? 'error' : (networkWarnings.length > 0 ? 'warning' : 'valid')
    },
    raw: {
      headers: netReq.headers || [],
      url: url,
      rawBody: rawBodyText,
      parsedBody: parsedBody
    }
  };
}

/**
 * Parses complete OpenAI Network Request Batch into structured Parent & Child Records
 * for EventStore and UI rendering.
 */
export function parseOpenAINetworkBatch(netReq) {
  const normalizedReq = normalizeOpenAIRequest(netReq);
  const parentRequest = {
    requestId: normalizedReq.requestId,
    requestUrl: normalizedReq.request.fullUrl,
    method: normalizedReq.request.method,
    status: normalizedReq.request.statusCode,
    timestamp: normalizedReq.capturedAt,
    pixelId: normalizedReq.sdk.pixelId,
    sdkType: normalizedReq.sdk.sdkType,
    sdkVersion: normalizedReq.sdk.sdkVersion,
    obref: normalizedReq.transport.obref,
    totalEventsCount: normalizedReq.events.length,
    rawPayload: normalizedReq.raw.parsedBody,
    normalizedRequest: normalizedReq
  };

  const measurementEvents = [];
  const internalEvents = [];

  normalizedReq.events.forEach((evt, idx) => {
    if (evt.category === 'SDK_INTERNAL' || evt.category === 'SYSTEM') {
      internalEvents.push({
        type: 'SDK_INTERNAL',
        name: evt.type,
        id: evt.eventId,
        timestamp: evt.timestamp,
        data: evt.data
      });
    } else if (evt.category === 'DIAGNOSTIC') {
      internalEvents.push({
        type: 'DIAGNOSTIC',
        name: evt.type,
        id: evt.eventId,
        timestamp: evt.timestamp,
        data: evt.data
      });
    } else {
      // Measurement / Business Event
      measurementEvents.push({
        parentRequestId: parentRequest.requestId,
        userInfo: normalizedReq.matching,
        batchIndex: idx,
        category: 'MEASUREMENT_EVENT',
        name: evt.type,
        eventName: evt.type,
        data: evt.data,
        parameters: evt.data,
        options: {
          opt_out: evt.optOut,
          event_id: evt.eventId
        },
        pixelId: normalizedReq.sdk.pixelId,
        sdkEventId: evt.eventId,
        timestamp: evt.timestamp,
        sourceUrl: evt.sourceUrl,
        referrerUrl: evt.referrerUrl,
        optOut: evt.optOut,
        rawEvent: evt.raw,
        source: {
          type: 'network',
          location: 'browser_network_request',
          caller: 'Browser Network Request (bzr.openai.com)',
          method: 'network'
        }
      });
    }
  });

  return {
    parentRequest: parentRequest,
    measurementEvents: measurementEvents,
    internalEvents: internalEvents,
    diagnostics: normalizedReq.diagnostics,
    userMatching: normalizedReq.matching,
    openAIRequest: normalizedReq
  };
}
