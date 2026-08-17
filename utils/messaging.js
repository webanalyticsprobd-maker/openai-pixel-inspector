/**
 * OpenAI Ads Pixel Inspector - Messaging Utilities
 */

export const MESSAGE_SOURCES = {
  PAGE_BRIDGE: 'OPENAI_PIXEL_PAGE_BRIDGE',
  CONTENT_SCRIPT: 'OPENAI_PIXEL_CONTENT_SCRIPT',
  BACKGROUND: 'OPENAI_PIXEL_BACKGROUND',
  POPUP: 'OPENAI_PIXEL_POPUP'
};

export const MESSAGE_ACTIONS = {
  // Bridge <-> Content Script
  BRIDGE_READY: 'BRIDGE_READY',
  PAGE_STATE_UPDATE: 'PAGE_STATE_UPDATE',
  PIXEL_INIT_DETECTED: 'PIXEL_INIT_DETECTED',
  PIXEL_EVENT_CAPTURED: 'PIXEL_EVENT_CAPTURED',
  NETWORK_REQUEST_CAPTURED: 'NETWORK_REQUEST_CAPTURED',
  PING: 'PING',
  PONG: 'PONG',

  // Content Script <-> Background
  CONTENT_SCRIPT_INITIALIZED: 'CONTENT_SCRIPT_INITIALIZED',
  BRIDGE_STATUS_UPDATE: 'BRIDGE_STATUS_UPDATE',
  DISPATCH_EVENT: 'DISPATCH_EVENT',
  DISPATCH_NETWORK_REQUEST: 'DISPATCH_NETWORK_REQUEST',
  FULL_PAGE_SCAN_RESULT: 'FULL_PAGE_SCAN_RESULT',

  // Popup <-> Background
  GET_ACTIVE_TAB_STATE: 'GET_ACTIVE_TAB_STATE',
  PING_BACKGROUND: 'PING_BACKGROUND',
  CLEAR_TAB_STATE: 'CLEAR_TAB_STATE',
  TRIGGER_RESCAN: 'TRIGGER_RESCAN',
  GET_AUDIT_REPORT: 'GET_AUDIT_REPORT'
};

/**
 * Validates message structure and source origin
 */
export function isValidMessage(message, expectedSource = null) {
  if (!message || typeof message !== 'object') return false;
  if (expectedSource && message.source !== expectedSource) return false;
  return Boolean(message.type || message.action);
}
