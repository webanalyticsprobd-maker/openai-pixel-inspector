/**
 * OpenAI Ads Pixel Inspector - Event Validator Engine
 * 
 * Validates events against official OpenAI Ads schemas and data shapes:
 * - contents (items_added, checkout_started, contents_viewed, order_created, page_viewed)
 * - customer_action (appointment_scheduled, lead_created, registration_completed)
 * - plan_enrollment (subscription_created, trial_started)
 * - custom
 */

import {
  STANDARD_EVENT_NAMES,
  STANDARD_EVENT_ALIASES,
  EVENT_SCHEMAS,
  EVENT_DATA_SHAPES,
  CONTENT_ITEM_SCHEMA,
  CUSTOM_EVENT_RULES,
  ISO_CURRENCIES
} from './schemas.js';

export function validateEvent(event) {
  let eventName = event.name || event.eventName || '';
  const options = event.options || {};
  const parameters = event.parameters || {};

  // Resolve alias if applicable
  let canonicalName = eventName;
  if (STANDARD_EVENT_ALIASES[eventName]) {
    canonicalName = STANDARD_EVENT_ALIASES[eventName];
  }

  const isBuiltin = STANDARD_EVENT_NAMES.includes(canonicalName);
  const isCustomEvent = canonicalName === 'custom' || !isBuiltin;
  const customEventName = options.custom_event_name || (isCustomEvent && canonicalName !== 'custom' ? canonicalName : null);

  const validation = {
    status: 'valid', // 'valid' | 'warning' | 'error'
    isCustom: isCustomEvent,
    canonicalName: canonicalName,
    dataShape: isBuiltin ? (EVENT_SCHEMAS[canonicalName]?.dataShape || 'contents') : 'custom',
    parameterResults: {},
    issues: [],
    errorsCount: 0,
    warningsCount: 0
  };

  const expectedShapeKey = isBuiltin ? EVENT_SCHEMAS[canonicalName]?.dataShape : 'custom';
  const shapeDef = EVENT_DATA_SHAPES[expectedShapeKey] || EVENT_DATA_SHAPES.contents;

  // 1. Data Shape Type Validation (Required field 'type')
  if (!parameters.type) {
    validation.issues.push({
      code: 'MISSING_DATA_SHAPE_TYPE',
      severity: 'error',
      event: eventName,
      parameter: 'type',
      message: `Event data object is missing required "type" field (expected type: "${expectedShapeKey}").`,
      recommendation: `Include { type: "${expectedShapeKey}" } in the event data object.`
    });
    validation.errorsCount++;
    validation.parameterResults.type = { valid: false, severity: 'error', message: 'Missing type field' };
  } else if (parameters.type !== expectedShapeKey) {
    validation.issues.push({
      code: 'INVALID_DATA_SHAPE_TYPE',
      severity: 'warning',
      event: eventName,
      parameter: 'type',
      message: `Event "${eventName}" has type "${parameters.type}", but official data shape expects type: "${expectedShapeKey}".`,
      recommendation: `Change type to "${expectedShapeKey}".`
    });
    validation.warningsCount++;
    validation.parameterResults.type = { valid: false, severity: 'warning', message: `Expected ${expectedShapeKey}` };
  } else {
    validation.parameterResults.type = { valid: true, severity: 'success', message: 'Valid data shape type' };
  }

  // 2. Amount & Currency Rule (If amount is present, currency is required)
  if (parameters.amount !== undefined && parameters.amount !== null) {
    if (typeof parameters.amount !== 'number' || isNaN(parameters.amount)) {
      validation.issues.push({
        code: 'INVALID_AMOUNT_TYPE',
        severity: 'error',
        event: eventName,
        parameter: 'amount',
        message: 'Amount must be an integer in minor currency units (e.g. 2599 for $25.99).',
        recommendation: 'Pass numeric integers for amount instead of strings or floats.'
      });
      validation.errorsCount++;
      validation.parameterResults.amount = { valid: false, severity: 'error', message: 'Must be integer' };
    } else {
      if (!Number.isInteger(parameters.amount)) {
        validation.issues.push({
          code: 'AMOUNT_NOT_INTEGER',
          severity: 'warning',
          event: eventName,
          parameter: 'amount',
          message: `Amount ${parameters.amount} is a decimal. OpenAI Pixel expects integer minor units (e.g. 2599 instead of 25.99).`,
          recommendation: 'Multiply dollars by 100 to send integer minor units.'
        });
        validation.warningsCount++;
      }
      validation.parameterResults.amount = { valid: true, severity: 'success', message: 'Valid amount' };
    }

    // Check required currency
    if (!parameters.currency) {
      validation.issues.push({
        code: 'MISSING_CURRENCY_WITH_AMOUNT',
        severity: 'error',
        event: eventName,
        parameter: 'currency',
        message: 'Currency is required whenever an "amount" is sent.',
        recommendation: 'Add ISO 4217 currency code (e.g., currency: "USD").'
      });
      validation.errorsCount++;
      validation.parameterResults.currency = { valid: false, severity: 'error', message: 'Required when amount is present' };
    }
  }

  // 3. Currency Format Validation
  if (parameters.currency) {
    if (typeof parameters.currency !== 'string') {
      validation.issues.push({
        code: 'INVALID_CURRENCY_TYPE',
        severity: 'error',
        event: eventName,
        parameter: 'currency',
        message: 'Currency must be a string 3-letter ISO 4217 code.',
        recommendation: 'Use 3-letter currency string like "USD", "EUR", "GBP".'
      });
      validation.errorsCount++;
      validation.parameterResults.currency = { valid: false, severity: 'error', message: 'Invalid currency' };
    } else {
      const cleanCurr = parameters.currency.trim().toUpperCase();
      if (!ISO_CURRENCIES.has(cleanCurr)) {
        validation.issues.push({
          code: 'UNRECOGNIZED_CURRENCY_CODE',
          severity: 'warning',
          event: eventName,
          parameter: 'currency',
          message: `"${parameters.currency}" is not a recognized 3-letter ISO 4217 currency code.`,
          recommendation: 'Verify standard 3-letter uppercase ISO currency.'
        });
        validation.warningsCount++;
      }
      validation.parameterResults.currency = { valid: true, severity: 'success', message: 'Valid currency' };
    }
  }

  // 4. Validate contents[] Array Items
  if (parameters.contents !== undefined) {
    if (!Array.isArray(parameters.contents)) {
      validation.issues.push({
        code: 'CONTENTS_NOT_ARRAY',
        severity: 'error',
        event: eventName,
        parameter: 'contents',
        message: '"contents" must be an array of Content objects.',
        recommendation: 'Wrap items in an array: contents: [{ id: "...", name: "..." }].'
      });
      validation.errorsCount++;
      validation.parameterResults.contents = { valid: false, severity: 'error', message: 'Must be array' };
    } else {
      validation.parameterResults.contents = { valid: true, severity: 'success', message: `${parameters.contents.length} item(s)` };
      parameters.contents.forEach((item, idx) => {
        if (typeof item !== 'object' || item === null) {
          validation.issues.push({
            code: 'INVALID_CONTENT_ITEM',
            severity: 'error',
            event: eventName,
            parameter: `contents[${idx}]`,
            message: `Item at index ${idx} in contents array is not an object.`,
            recommendation: 'Each item in contents[] must be an object with fields like id, name, content_type, quantity, amount.'
          });
          validation.errorsCount++;
        } else {
          // Check item quantity
          if (item.quantity !== undefined && (!Number.isInteger(item.quantity) || item.quantity < 1)) {
            validation.issues.push({
              code: 'INVALID_ITEM_QUANTITY',
              severity: 'warning',
              event: eventName,
              parameter: `contents[${idx}].quantity`,
              message: 'Item quantity must be a positive integer.',
              recommendation: 'Use integer quantities (e.g. quantity: 1).'
            });
            validation.warningsCount++;
          }
        }
      });
    }
  }

  // 5. Custom Event Rules
  if (isCustomEvent) {
    if (canonicalName === 'custom' && !options.custom_event_name) {
      validation.issues.push({
        code: 'MISSING_CUSTOM_EVENT_NAME',
        severity: 'error',
        event: eventName,
        parameter: 'custom_event_name',
        message: 'When measuring "custom", custom_event_name is required in the options object.',
        recommendation: 'Call oaiq("measure", "custom", { type: "custom" }, { custom_event_name: "..." }).'
      });
      validation.errorsCount++;
    }

    if (customEventName) {
      if (customEventName.length > CUSTOM_EVENT_RULES.maxLength) {
        validation.issues.push({
          code: 'CUSTOM_NAME_TOO_LONG',
          severity: 'warning',
          event: eventName,
          parameter: 'custom_event_name',
          message: `Custom event name exceeds ${CUSTOM_EVENT_RULES.maxLength} characters.`,
          recommendation: 'Keep custom event names between 1 and 64 characters.'
        });
        validation.warningsCount++;
      }
      if (!CUSTOM_EVENT_RULES.validPattern.test(customEventName)) {
        validation.issues.push({
          code: 'CUSTOM_NAME_INVALID_FORMAT',
          severity: 'warning',
          event: eventName,
          parameter: 'custom_event_name',
          message: 'Custom event name must start/end with letter or number and contain only letters, numbers, underscores, or dashes.',
          recommendation: 'Use format like "quote_requested" or "video_completed".'
        });
        validation.warningsCount++;
      }
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
