/**
 * OpenAI Ads Pixel Inspector - Event Normalizer
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

  // Deduce event_id from options, properties, or generate one
  const eventId = options.event_id || properties.event_id || rawEvent.event_id || generateUUID();

  // Combine parameters for normalized view
  const combinedParams = Object.assign({}, properties);
  if (options.event_id && !combinedParams.event_id) {
    combinedParams.event_id = options.event_id;
  }

  const normalized = {
    id: generateUUID(),
    eventId: eventId,
    name: eventName,
    timestamp: timestamp,
    source: {
      type: 'pixel',
      location: 'browser',
      caller: rawEvent.caller || 'oaiq("measure")'
    },
    pixelId: rawEvent.pixelId || tabContext.pixelId || null,
    parameters: combinedParams,
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
    validation: null,
    raw: rawEvent
  };

  // Run validation
  normalized.validation = validateEvent(normalized);

  return normalized;
}
