/**
 * OpenAI Ads Pixel Inspector - Event Validator Engine
 */

import { EVENT_SCHEMAS, CUSTOM_EVENT_RULES } from './schemas.js';
import { validateParameter } from './parameter-validator.js';

export function validateEvent(event) {
  const eventName = event.name || event.eventName;
  const parameters = event.parameters || {};
  const isCustom = !EVENT_SCHEMAS[eventName];

  const validation = {
    status: 'valid', // 'valid' | 'warning' | 'error'
    isCustom: isCustom,
    category: isCustom ? 'custom' : (EVENT_SCHEMAS[eventName].category || 'general'),
    parameterResults: {},
    issues: [],
    errorsCount: 0,
    warningsCount: 0
  };

  // 1. Custom Event Name Validation
  if (isCustom) {
    if (eventName.length > CUSTOM_EVENT_RULES.maxNameLength) {
      validation.issues.push({
        code: 'CUSTOM_EVENT_NAME_TOO_LONG',
        severity: 'warning',
        event: eventName,
        message: `Custom event name exceeds ${CUSTOM_EVENT_RULES.maxNameLength} characters.`,
        recommendation: 'Use concise, descriptive action names (e.g., "video_completed").'
      });
      validation.warningsCount++;
    }

    if (!CUSTOM_EVENT_RULES.validNamePattern.test(eventName)) {
      validation.issues.push({
        code: 'CUSTOM_EVENT_NAME_INVALID_CHARS',
        severity: 'warning',
        event: eventName,
        message: 'Custom event name contains non-standard characters or spaces.',
        recommendation: 'Use alphanumeric characters with underscores or dashes (e.g. "newsletter_signup").'
      });
      validation.warningsCount++;
    }

    if (CUSTOM_EVENT_RULES.reservedWords.includes(eventName.toLowerCase())) {
      validation.issues.push({
        code: 'RESERVED_KEYWORD_AS_EVENT_NAME',
        severity: 'error',
        event: eventName,
        message: `"${eventName}" is a reserved oaiq SDK method and cannot be used as an event name.`,
        recommendation: 'Use a unique event name instead of SDK reserved words.'
      });
      validation.errorsCount++;
    }

    // Generic parameter check for custom events
    for (const [key, val] of Object.entries(parameters)) {
      const res = validateParameter(key, val, {});
      validation.parameterResults[key] = res;
      if (!res.valid) {
        validation.issues.push({
          code: 'INVALID_CUSTOM_PARAMETER',
          severity: res.severity,
          event: eventName,
          parameter: key,
          message: res.message
        });
        if (res.severity === 'error') validation.errorsCount++;
        if (res.severity === 'warning') validation.warningsCount++;
      }
    }
  } else {
    // 2. Standard Event Validation
    const schema = EVENT_SCHEMAS[eventName];

    // Check required parameters
    for (const reqParam of schema.required) {
      if (!(reqParam in parameters) || parameters[reqParam] === null || parameters[reqParam] === undefined || parameters[reqParam] === '') {
        validation.issues.push({
          code: 'MISSING_REQUIRED_PARAMETER',
          severity: 'error',
          event: eventName,
          parameter: reqParam,
          message: `Required parameter "${reqParam}" is missing from "${eventName}".`,
          recommendation: `Ensure you pass { ${reqParam}: ... } in the oaiq("measure", "${eventName}", { ... }) call.`
        });
        validation.errorsCount++;
        validation.parameterResults[reqParam] = {
          valid: false,
          severity: 'error',
          message: `Missing required parameter "${reqParam}".`
        };
      }
    }

    // Validate all provided parameters against schema
    for (const [key, val] of Object.entries(parameters)) {
      const rule = (schema.parameters && schema.parameters[key]) || {};
      const res = validateParameter(key, val, rule);
      validation.parameterResults[key] = res;

      if (!res.valid || res.severity === 'warning') {
        validation.issues.push({
          code: res.severity === 'error' ? 'INVALID_PARAMETER_VALUE' : 'PARAMETER_VALUE_WARNING',
          severity: res.severity,
          event: eventName,
          parameter: key,
          message: res.message
        });
        if (res.severity === 'error') validation.errorsCount++;
        if (res.severity === 'warning') validation.warningsCount++;
      }
    }

    // Check recommended deduplication event_id for conversion events
    if (schema.category === 'conversion' && !parameters.event_id && !event.event_id) {
      validation.issues.push({
        code: 'RECOMMENDED_EVENT_ID_MISSING',
        severity: 'info',
        event: eventName,
        parameter: 'event_id',
        message: `Conversion event "${eventName}" does not include an "event_id".`,
        recommendation: 'Passing an event_id is strongly recommended to enable seamless deduplication with OpenAI Conversions API (CAPI).'
      });
    }
  }

  // Derive final status
  if (validation.errorsCount > 0) {
    validation.status = 'error';
  } else if (validation.warningsCount > 0) {
    validation.status = 'warning';
  } else {
    validation.status = 'valid';
  }

  return validation;
}
