/**
 * OpenAI Ads Pixel Inspector - Event Normalizer
 * 
 * Strict Rule: Never generate, assume, infer, or invent an event_id!
 * eventId must ONLY be set when explicitly provided by the website in options or parameters.
 */

import { generateUUID } from '../utils/formatting.js';
import { validateEvent } from '../validators/event-validator.js';

export function normalizeEvent(rawEvent, tabContext = {}) {
  const timestamp = rawEvent.timestamp || Date.now();
  const rawArgs = rawEvent.args || [];
  
  let eventName = rawEvent.name || '';
  let properties = {};
  let options = {};

  // Extract from oaiq("measure", eventName, properties, options)
  if (rawArgs.length >= 1) {
    if (typeof rawArgs[0] === 'string') {
      eventName = rawArgs[0];
    }
    if (rawArgs.length >= 2 && typeof rawArgs[1] === 'object' && rawArgs[1] !== null) {
      properties = Object.assign({}, rawArgs[1]);
    }
    if (rawArgs.length >= 3 && typeof rawArgs[2] === 'object' && rawArgs[2] !== null) {
      options = Object.assign({}, rawArgs[2]);
    }
  } else if (rawEvent.parameters) {
    properties = Object.assign({}, rawEvent.parameters);
  }

  if (rawEvent.options && typeof rawEvent.options === 'object') {
    options = Object.assign({}, rawEvent.options, options);
  }

  // Extract actual Event ID if and only if explicitly sent
  let explicitEventId = null;
  if (options.event_id && typeof options.event_id === 'string' && options.event_id.trim() !== '') {
    explicitEventId = options.event_id.trim();
  } else if (properties.event_id && typeof properties.event_id === 'string' && properties.event_id.trim() !== '') {
    explicitEventId = properties.event_id.trim();
  } else if (rawEvent.event_id && typeof rawEvent.event_id === 'string' && rawEvent.event_id.trim() !== '') {
    explicitEventId = rawEvent.event_id.trim();
  }

  // Determine URL and Path
  const pageUrl = rawEvent.url || tabContext.url || '';
  let pathname = rawEvent.pathname || '';
  let hostname = '';

  if (pageUrl) {
    try {
      const u = new URL(pageUrl);
      pathname = pathname || u.pathname;
      hostname = u.hostname;
    } catch {}
  }

  const displayName = (eventName === 'custom' && options.custom_event_name) ? options.custom_event_name : eventName;

  const normalized = {
    _id: generateUUID(), // Internal React/DOM render key only
    eventId: explicitEventId, // Real Event ID or null (NEVER generated!)
    hasEventId: Boolean(explicitEventId),
    name: eventName,
    displayName: displayName,
    timestamp: timestamp,
    url: pageUrl,
    pathname: pathname || '/',
    hostname: hostname,
    source: {
      type: 'pixel',
      location: 'browser',
      caller: rawEvent.caller || 'oaiq("measure")'
    },
    pixelId: rawEvent.pixelId || tabContext.pixelId || null,
    parameters: properties,
    options: options,
    attribution: {
      oppref: tabContext.oppref || null
    },
    network: {
      detected: false,
      status: null,
      method: null,
      url: null,
      responseTimestamp: null
    },
    // Journey & Duplicate Audit Fields
    isDuplicate: false,
    duplicateReason: null,
    requestCount: 1,
    duplicateStatus: '✅ Correct',
    validation: null,
    raw: rawEvent
  };

  // Run validation
  normalized.validation = validateEvent(normalized);

  return normalized;
}
