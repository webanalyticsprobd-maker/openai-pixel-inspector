/**
 * OpenAI Ads Pixel Inspector - Modular Logger
 */

let isDebugEnabled = true; // Enabled for testing/development

export function setDebug(enabled) {
  isDebugEnabled = Boolean(enabled);
}

export function log(module, message, data = null) {
  if (!isDebugEnabled) return;
  const prefix = `[OpenAI Pixel Inspector][${module}]`;
  if (data !== null && data !== undefined) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

export function warn(module, message, data = null) {
  const prefix = `[OpenAI Pixel Inspector][${module}]`;
  if (data !== null && data !== undefined) {
    console.warn(prefix, message, data);
  } else {
    console.warn(prefix, message);
  }
}

export function error(module, message, data = null) {
  const prefix = `[OpenAI Pixel Inspector][${module}]`;
  if (data !== null && data !== undefined) {
    console.error(prefix, message, data);
  } else {
    console.error(prefix, message);
  }
}
