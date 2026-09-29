/**
 * OpenAI Ads Pixel Inspector - Event Normalizer & Lifecycle Engine
 * 
 * Strict Rule: Never generate, assume, infer, or invent an event_id!
 * eventId must ONLY be set when explicitly provided by the website in options or parameters.
 * 
 * Computes distinct, non-collapsed 5-stage lifecycle states:
 * 1. Pixel Call (Fired)
 * 2. Network Request (Sent)
 * 3. Server Response (HTTP Status)
 * 4. Parameters (Health)
 * 5. Validation (Compliance)
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

  // Extract actual Event ID if and only if explicitly sent (Never synthetic!)
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
      headers: {},
      payload: null,
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

  // Run schema validation
  normalized.validation = validateEvent(normalized);

  return normalized;
}

/**
 * Computes separate 5-stage lifecycle state for an event
 */
export function computeEventLifecycle(event) {
  // 1. Pixel Call
  const pixelCall = {
    status: 'fired',
    label: '✅ Fired',
    detail: 'Executed in browser JS runtime via oaiq()'
  };

  // 2. Network Request
  let networkRequest = {
    status: 'pending',
    label: '⏳ Pending',
    detail: 'Awaiting network transmission...'
  };

  if (event.network && event.network.detected) {
    networkRequest = {
      status: 'sent',
      label: '✅ Sent',
      detail: `${event.network.method || 'POST'} to ${event.network.url || 'bzr.openai.com'}`
    };
  } else {
    networkRequest = {
      status: 'not_observed',
      label: '⚠️ Not Observed',
      detail: 'Network POST not yet recorded'
    };
  }

  // 3. Server Response
  let serverResponse = {
    status: 'pending',
    label: '⏳ Awaiting',
    detail: 'No server response recorded yet'
  };

  if (event.network && event.network.status) {
    if (event.network.status >= 200 && event.network.status < 300) {
      serverResponse = {
        status: 'success',
        label: `✅ Successful (HTTP ${event.network.status})`,
        detail: 'Endpoint accepted payload'
      };
    } else {
      serverResponse = {
        status: 'error',
        label: `❌ HTTP ${event.network.status} Error`,
        detail: 'Endpoint returned failure response'
      };
    }
  }

  // 4. Parameters
  let parametersStatus = {
    status: 'valid',
    label: '✅ Valid',
    detail: 'All parameters match schema'
  };

  if (event.validation) {
    if (event.validation.errorsCount > 0) {
      parametersStatus = {
        status: 'error',
        label: `❌ ${event.validation.errorsCount} Error(s)`,
        detail: 'Missing required fields or invalid types'
      };
    } else if (event.validation.warningsCount > 0) {
      parametersStatus = {
        status: 'warning',
        label: `⚠️ ${event.validation.warningsCount} Warning(s)`,
        detail: 'Formatting or minor units recommendations'
      };
    }
  }

  // 5. Overall Validation
  let validationStatus = {
    status: 'passed',
    label: '✅ Passed',
    detail: 'Compliant with OpenAI specifications'
  };

  if (event.isDuplicate) {
    validationStatus = {
      status: 'failed',
      label: '❌ Failed (Duplicate / Double Fired)',
      detail: event.duplicateReason || 'Multiple identical tracking calls fired'
    };
  } else if (event.validation && event.validation.status === 'error') {
    validationStatus = {
      status: 'failed',
      label: '❌ Failed',
      detail: 'Critical validation errors found'
    };
  } else if (event.validation && event.validation.status === 'warning') {
    validationStatus = {
      status: 'warning',
      label: '⚠️ Warning',
      detail: 'Minor formatting issues detected'
    };
  }

  return {
    pixelCall,
    networkRequest,
    serverResponse,
    parametersStatus,
    validationStatus
  };
}
