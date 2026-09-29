/**
 * OpenAI Ads Pixel Inspector - Event Validation Engine
 * 
 * Executes schema-driven validation for OpenAI Ads Pixel events.
 * Fully decoupled from UI layer.
 */

import {
  STANDARD_EVENT_NAMES,
  STANDARD_EVENT_ALIASES,
  EVENT_SCHEMAS,
  CUSTOM_EVENT_RULES
} from './schemas.js';
import { validateParameter } from './parameter-validator.js';
import { scanForPii } from './pii-scanner.js';

export function validateEvent(event) {
  let eventName = event.name || event.eventName || '';
  const options = event.options || {};
  const parameters = event.parameters || {};

  // Resolve alias if applicable (e.g. Purchase -> order_created)
  let canonicalName = eventName;
  if (STANDARD_EVENT_ALIASES[eventName]) {
    canonicalName = STANDARD_EVENT_ALIASES[eventName];
  }

  const isBuiltin = STANDARD_EVENT_NAMES.includes(canonicalName);
  const isCustomEvent = canonicalName === 'custom' || !isBuiltin;
  const customEventName = options.custom_event_name || (isCustomEvent && canonicalName !== 'custom' ? canonicalName : null);

  // Retrieve declarative schema
  const schema = EVENT_SCHEMAS[canonicalName] || EVENT_SCHEMAS['custom'] || {
    dataShape: 'custom',
    required: ['type'],
    optional: [],
    parameters: { type: { type: 'string', expected: 'custom', required: true } }
  };

  const validation = {
    status: 'valid', // 'valid' | 'warning' | 'error'
    isCustom: isCustomEvent,
    canonicalName: canonicalName,
    dataShape: schema.dataShape || 'contents',
    parameterResults: {},
    issues: [],
    piiIssues: [],
    errorsCount: 0,
    warningsCount: 0,
    infoCount: 0
  };

  // 1. Check Required Parameters from Schema
  if (schema.required && Array.isArray(schema.required)) {
    schema.required.forEach((reqField) => {
      if (parameters[reqField] === undefined || parameters[reqField] === null) {
        validation.errorsCount++;
        validation.issues.push({
          code: `MISSING_REQUIRED_${reqField.toUpperCase()}`,
          severity: 'error',
          event: eventName,
          parameter: reqField,
          message: `Missing required parameter "${reqField}" for event "${eventName}".`,
          recommendation: `Include "${reqField}" with expected value (e.g., { ${reqField}: "${schema.parameters[reqField]?.expected || 'value'}" }).`
        });
        validation.parameterResults[reqField] = {
          valid: false,
          severity: 'error',
          code: 'PARAM_MISSING_REQUIRED',
          message: `Required parameter "${reqField}" is missing.`
        };
      }
    });
  }

  // 2. Check Conditional Requirements (e.g., currency required when amount is present)
  if (schema.conditionalRequired && Array.isArray(schema.conditionalRequired)) {
    schema.conditionalRequired.forEach((cond) => {
      if (parameters[cond.when] !== undefined && parameters[cond.when] !== null) {
        cond.require.forEach((reqField) => {
          if (parameters[reqField] === undefined || parameters[reqField] === null || parameters[reqField] === '') {
            validation.errorsCount++;
            validation.issues.push({
              code: `MISSING_CONDITIONAL_${reqField.toUpperCase()}`,
              severity: 'error',
              event: eventName,
              parameter: reqField,
              message: cond.message || `Parameter "${reqField}" is required when "${cond.when}" is provided.`,
              recommendation: `Provide "${reqField}" whenever "${cond.when}" is sent.`
            });
            validation.parameterResults[reqField] = {
              valid: false,
              severity: 'error',
              code: 'PARAM_MISSING_CONDITIONAL',
              message: `Required when "${cond.when}" is present.`
            };
          }
        });
      }
    });
  }

  // 3. Validate All Provided Parameters Against Schema Rules
  for (const [paramKey, paramVal] of Object.entries(parameters)) {
    const paramRule = schema.parameters ? schema.parameters[paramKey] : null;
    const res = validateParameter(paramKey, paramVal, paramRule, parameters);
    
    validation.parameterResults[paramKey] = res;

    if (res.severity === 'error') {
      validation.errorsCount++;
      validation.issues.push({
        code: res.code || 'PARAM_VALIDATION_ERROR',
        severity: 'error',
        event: eventName,
        parameter: res.parameter || paramKey,
        received: res.received !== undefined ? res.received : paramVal,
        expected: res.expected !== undefined ? res.expected : null,
        message: res.message,
        recommendation: res.recommendation || `Fix "${paramKey}" to match OpenAI Ads Pixel specification.`
      });
    } else if (res.severity === 'warning') {
      validation.warningsCount++;
      validation.issues.push({
        code: res.code || 'PARAM_VALIDATION_WARNING',
        severity: 'warning',
        event: eventName,
        parameter: res.parameter || paramKey,
        received: res.received !== undefined ? res.received : paramVal,
        expected: res.expected !== undefined ? res.expected : null,
        message: res.message,
        recommendation: res.recommendation || `Review "${paramKey}" formatting.`
      });
    } else if (res.severity === 'info') {
      validation.infoCount++;
    }
  }

  // 4. Custom Event Validations
  if (isCustomEvent) {
    if (canonicalName === 'custom' && !options.custom_event_name) {
      validation.errorsCount++;
      validation.issues.push({
        code: 'MISSING_CUSTOM_EVENT_NAME',
        severity: 'error',
        event: eventName,
        parameter: 'custom_event_name',
        message: 'When measuring "custom", custom_event_name is required in the options parameter.',
        recommendation: 'Pass { custom_event_name: "your_event_name" } in options parameter.'
      });
    }

    if (customEventName) {
      if (customEventName.length > CUSTOM_EVENT_RULES.maxLength) {
        validation.warningsCount++;
        validation.issues.push({
          code: 'CUSTOM_NAME_TOO_LONG',
          severity: 'warning',
          event: eventName,
          parameter: 'custom_event_name',
          message: `Custom event name exceeds ${CUSTOM_EVENT_RULES.maxLength} characters.`,
          recommendation: 'Keep custom event names under 64 characters.'
        });
      }
      if (!CUSTOM_EVENT_RULES.validPattern.test(customEventName)) {
        validation.warningsCount++;
        validation.issues.push({
          code: 'CUSTOM_NAME_INVALID_FORMAT',
          severity: 'warning',
          event: eventName,
          parameter: 'custom_event_name',
          message: 'Custom event name must start/end with an alphanumeric character and contain only alphanumeric, underscores, or hyphens.',
          recommendation: 'Use clean identifiers such as "quote_requested" or "video_completed".'
        });
      }
    }
  }

  // 5. Scan Payload & Parameters for Unhashed PII Privacy Violations
  const detectedPii = scanForPii(parameters);
  if (detectedPii.length > 0) {
    validation.piiIssues = detectedPii;
    detectedPii.forEach((pii) => {
      validation.warningsCount++;
      validation.issues.push({
        code: `PII_PRIVACY_${pii.type.toUpperCase()}`,
        severity: pii.severity || 'warning',
        event: eventName,
        parameter: pii.path,
        message: pii.message,
        recommendation: pii.recommendation
      });

      // Update parameter result with PII alert
      const rootParam = pii.path.split('.')[0].replace(/\[.*\]/, '');
      if (validation.parameterResults[rootParam]) {
        validation.parameterResults[rootParam].pii = true;
        validation.parameterResults[rootParam].piiDetails = pii;
      }
    });
  }

  // 6. Compute Final Validation Status
  if (validation.errorsCount > 0) {
    validation.status = 'error';
  } else if (validation.warningsCount > 0) {
    validation.status = 'warning';
  } else {
    validation.status = 'valid';
  }

  return validation;
}
