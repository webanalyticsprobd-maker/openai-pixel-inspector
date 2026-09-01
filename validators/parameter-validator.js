/**
 * OpenAI Ads Pixel Inspector - Parameter & Contents Validation Engine
 * 
 * Strict Single Source of Truth validation directly derived from official OpenAI documentation.
 * Produces structured findings with machine-readable codes, paths, and doc references.
 */

import {
  ISO_CURRENCIES,
  CONTENT_ITEM_SCHEMA,
  ALLOWED_CONTENT_ITEM_FIELDS,
  OFFICIAL_DOCS,
  getCurrencyDecimalPlaces,
  getCurrencySmallestUnitName
} from './schemas.js';

/**
 * Validates a single parameter against schema rules
 * 
 * @param {string} paramName 
 * @param {*} paramValue 
 * @param {object} rule 
 * @param {object} allParams 
 * @param {string} eventName 
 * @param {string} basePath 
 * @returns {object} Finding result or null
 */
export function validateParameter(paramName, paramValue, rule = {}, allParams = {}, eventName = '', basePath = '') {
  const currentPath = basePath ? `${basePath}.${paramName}` : paramName;

  // 1. Null Check
  if (paramValue === null) {
    return {
      severity: 'error',
      category: 'parameter',
      eventName: eventName,
      path: currentPath,
      code: 'INVALID_PARAMETER_TYPE',
      title: 'Invalid Parameter Value (Null)',
      detected: 'null',
      expected: rule.type || 'defined value',
      message: `Parameter "${currentPath}" cannot be null.`,
      documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      recommendedFix: `Provide a valid ${rule.type || 'value'} for "${currentPath}".`
    };
  }

  if (paramValue === undefined) {
    if (rule.required) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'MISSING_REQUIRED_PARAMETER',
        title: 'Missing Required Parameter',
        detected: 'undefined',
        expected: rule.expected || rule.type || 'defined value',
        message: `Missing required parameter "${currentPath}" for event "${eventName}".`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Include "${currentPath}" in the event payload.`
      };
    }
    return null;
  }

  // 2. Data Shape Type Check (Mandatory 'type' parameter)
  if (paramName === 'type' && rule.expected !== undefined) {
    if (paramValue !== rule.expected) {
      return {
        severity: 'error',
        category: 'shape',
        eventName: eventName,
        path: currentPath,
        code: 'INCORRECT_DATA_SHAPE',
        title: 'Incorrect Event Data Shape',
        detected: String(paramValue),
        expected: rule.expected,
        message: `Event "${eventName}" requires type: "${rule.expected}", detected "${paramValue}".`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Set type: "${rule.expected}" in the event data object.`
      };
    }
  }

  // 3. Amount & Minor Currency Unit Formatting (Checked before generic integer check to provide specific code)
  if (rule.minorUnit) {
    if (typeof paramValue !== 'number' || isNaN(paramValue)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Amount Type',
        detected: typeof paramValue,
        expected: 'integer in minor currency units (e.g. 2599 for $25.99)',
        message: `"${currentPath}" must be a numeric integer in minor units, received ${typeof paramValue}.`,
        documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
        recommendedFix: `Pass a numeric integer for "${currentPath}" (e.g. 2599 for $25.99 USD).`
      };
    }

    if (!Number.isInteger(paramValue)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'PARAM_AMOUNT_NOT_INTEGER',
        title: 'Amount Not Integer (Minor Units)',
        detected: paramValue,
        expected: 'integer in minor currency units (e.g. 2599 for $25.99)',
        message: `"${currentPath}" (${paramValue}) must be an integer in minor currency units (no decimals). For example, send 2599 for $25.99 USD.`,
        documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
        recommendedFix: `Convert amount to integer minor units (multiply major currency by 100 for 2-decimal currencies like USD/EUR).`
      };
    }

    if (rule.min !== undefined && paramValue < rule.min) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_FORMAT',
        title: 'Numeric Out of Range',
        detected: paramValue,
        expected: `>= ${rule.min}`,
        message: `Parameter "${currentPath}" (${paramValue}) cannot be negative.`,
        documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
        recommendedFix: `Ensure "${currentPath}" is a positive integer in minor units.`
      };
    }

    // Check currency pairing
    if (!allParams.currency && rule.requiredCurrency !== false) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: 'currency',
        code: 'PARAM_AMOUNT_MISSING_CURRENCY',
        title: 'Missing Currency for Amount',
        detected: 'undefined',
        expected: '3-letter uppercase ISO 4217 currency code (e.g. "USD")',
        message: `Parameter "currency" is required whenever "${currentPath}" is provided.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Add currency: "USD" (or your store currency) to the event data object.`
      };
    }
  } else if (rule.type) {
    // Generic Data Type Validation
    const typeError = checkDataType(currentPath, paramValue, rule.type, eventName);
    if (typeError) return typeError;

    if (rule.type === 'integer' || rule.type === 'number') {
      if (rule.min !== undefined && paramValue < rule.min) {
        return {
          severity: 'error',
          category: 'parameter',
          eventName: eventName,
          path: currentPath,
          code: 'INVALID_PARAMETER_FORMAT',
          title: 'Numeric Out of Range',
          detected: paramValue,
          expected: `>= ${rule.min}`,
          message: `Parameter "${currentPath}" (${paramValue}) cannot be negative.`,
          documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
          recommendedFix: `Ensure "${currentPath}" is >= ${rule.min}.`
        };
      }
    }
  }

  // 4. String Rules
  if (rule.type === 'string') {
    if (typeof paramValue === 'string' && paramValue.trim() === '') {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_FORMAT',
        title: 'Empty String Parameter',
        detected: '""',
        expected: 'non-empty string',
        message: `Parameter "${currentPath}" cannot be an empty string.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Provide a non-empty string value or omit "${currentPath}" if optional.`
      };
    }
  }

  // 5. Currency Format Checks (ISO 4217)
  if (rule.format === 'currency') {
    if (typeof paramValue !== 'string') {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Currency Type',
        detected: typeof paramValue,
        expected: 'string',
        message: `Currency must be a 3-letter uppercase ISO 4217 string (e.g. "USD").`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Set currency as a 3-letter string (e.g. "USD").`
      };
    }
    const clean = paramValue.trim().toUpperCase();
    if (!ISO_CURRENCIES.has(clean)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_FORMAT',
        title: 'Unrecognized Currency Code',
        detected: paramValue,
        expected: 'Valid 3-letter ISO 4217 currency code (e.g. "USD", "EUR", "GBP")',
        message: `"${paramValue}" is not a recognized 3-letter ISO 4217 currency code.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Use a standard ISO 4217 currency code such as "USD", "EUR", "GBP", "CAD".`
      };
    }
    if (paramValue !== clean) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_FORMAT',
        title: 'Currency Not Uppercase',
        detected: paramValue,
        expected: clean,
        message: `Currency code "${paramValue}" must be uppercase (e.g. "${clean}").`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Use uppercase currency code: "${clean}".`
      };
    }
  }

  // 6. Enum Validation
  if (rule.enum && Array.isArray(rule.enum)) {
    if (!rule.enum.includes(paramValue)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: currentPath,
        code: 'INVALID_PARAMETER_FORMAT',
        title: 'Invalid Parameter Enum Value',
        detected: paramValue,
        expected: rule.enum.join(' | '),
        message: `Value "${paramValue}" for "${currentPath}" is invalid. Must be one of: [${rule.enum.join(', ')}].`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Use one of the documented allowed values: [${rule.enum.join(', ')}].`
      };
    }
  }

  return null;
}

/**
 * Validates the contents array and all nested items
 * 
 * @param {*} contentsVal 
 * @param {object} allParams 
 * @param {string} eventName 
 * @returns {Array<object>} Array of findings
 */
export function validateContentsArray(contentsVal, allParams = {}, eventName = '') {
  const findings = [];

  if (contentsVal === undefined || contentsVal === null) {
    return findings; // contents is optional for contents data shape
  }

  // Level 1: Is contents an array?
  if (!Array.isArray(contentsVal)) {
    findings.push({
      severity: 'error',
      category: 'contents',
      eventName: eventName,
      path: 'contents',
      code: 'INVALID_CONTENTS_TYPE',
      title: 'Invalid Contents Structure',
      detected: typeof contentsVal === 'object' ? 'object' : typeof contentsVal,
      expected: 'array of Content objects',
      message: `The "contents" parameter must be an array of Content objects, detected ${typeof contentsVal}.`,
      documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
      recommendedFix: 'Wrap content items in an array: contents: [ { id: "...", name: "..." } ].'
    });
    return findings; // Do not cascade into inner items if not an array
  }

  // Level 2: Loop through EVERY item in contents[]
  let itemsTotalAmount = 0;
  let hasItemAmounts = false;

  contentsVal.forEach((item, idx) => {
    const itemPath = `contents[${idx}]`;

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      findings.push({
        severity: 'error',
        category: 'contents',
        eventName: eventName,
        path: itemPath,
        code: 'INVALID_CONTENTS_ITEM',
        title: 'Invalid Content Object',
        detected: Array.isArray(item) ? 'array' : typeof item,
        expected: 'Content object',
        message: `Item at ${itemPath} must be an object representing a product or content item.`,
        documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
        recommendedFix: `Ensure each item in contents[] is an object with valid properties (e.g. { id, name, content_type, quantity, amount, currency }).`
      });
      return;
    }

    // Check item-level fields
    for (const [propName, propVal] of Object.entries(item)) {
      const propPath = `${itemPath}.${propName}`;

      // Check if field is Conversions API (CAPI) only
      if (propName === 'group_id' || propName === 'variant_dict') {
        findings.push({
          severity: 'warning',
          category: 'contents',
          eventName: eventName,
          path: propPath,
          code: 'CAPI_ONLY_CONTENT_FIELD',
          title: 'Conversions API Only Field in JS Pixel',
          detected: propName,
          expected: 'Documented JS Pixel Content fields: id, name, content_type, quantity, amount, currency',
          message: `Field "${propName}" inside ${itemPath} is Conversions API only and not supported in browser JavaScript Pixel payloads.`,
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: `Remove "${propName}" from client-side pixel calls or send via Conversions API.`
        });
        continue;
      }

      // Check if field is an undocumented/unexpected Content field
      if (!ALLOWED_CONTENT_ITEM_FIELDS.has(propName)) {
        findings.push({
          severity: 'warning',
          category: 'contents',
          eventName: eventName,
          path: propPath,
          code: 'UNEXPECTED_CONTENT_FIELD',
          title: 'Undocumented Content Field',
          detected: propName,
          expected: 'id | name | content_type | quantity | amount | currency',
          message: `Field "${propName}" inside ${itemPath} is not a documented OpenAI Content field.`,
          documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
          recommendedFix: `Use only official Content fields: id, name, content_type, quantity, amount, currency.`
        });
        continue;
      }

      // Validate defined Content field
      const fieldRule = CONTENT_ITEM_SCHEMA[propName];
      const itemContext = Object.assign({ currency: item.currency || allParams.currency || 'USD' }, item);
      const fieldFinding = validateParameter(propName, propVal, fieldRule, itemContext, eventName, itemPath);
      if (fieldFinding) {
        findings.push(fieldFinding);
      }
    }

    // Accumulate amounts for major/minor consistency checking
    if (typeof item.amount === 'number') {
      hasItemAmounts = true;
      itemsTotalAmount += item.amount * (Number(item.quantity) || 1);
    }
  });

  // Level 3: Check if item amounts were sent in major units while event amount was in minor units
  if (hasItemAmounts && typeof allParams.amount === 'number') {
    const curr = (allParams.currency || 'USD').toString().toUpperCase();
    const mult = (curr === 'JPY' || curr === 'KRW' || curr === 'VND') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);

    if (mult > 1 && itemsTotalAmount * mult === allParams.amount) {
      findings.push({
        severity: 'error',
        category: 'contents',
        eventName: eventName,
        path: 'contents[0].amount',
        code: 'PARAM_AMOUNT_MAJOR_UNITS',
        title: 'Content Amount in Major Units',
        detected: itemsTotalAmount,
        expected: allParams.amount,
        message: `contents[0].amount was sent in major units ($${itemsTotalAmount}.00). OpenAI expects minor units: ${allParams.amount} (${itemsTotalAmount} × ${mult}) for ${curr}.`,
        documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
        recommendedFix: `Update contents[0].amount to ${allParams.amount} (minor currency units).`
      });
    }
  }

  return findings;
}

/**
 * Checks data type strictly
 */
function checkDataType(path, value, expectedType, eventName) {
  if (expectedType === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value) || isNaN(value)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected Integer)',
        detected: typeof value === 'number' ? 'float/decimal' : typeof value,
        expected: 'integer',
        message: `Expected integer for "${path}", got ${typeof value === 'number' ? 'float/decimal' : typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Ensure "${path}" is passed as an integer without quotes or decimal points.`
      };
    }
  } else if (expectedType === 'number') {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected Number)',
        detected: typeof value,
        expected: 'number',
        message: `Expected number for "${path}", got ${typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Pass a valid numeric value for "${path}".`
      };
    }
  } else if (expectedType === 'string') {
    if (typeof value !== 'string') {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected String)',
        detected: typeof value,
        expected: 'string',
        message: `Expected string for "${path}", got ${typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Pass a string value for "${path}".`
      };
    }
  } else if (expectedType === 'boolean') {
    if (typeof value !== 'boolean') {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected Boolean)',
        detected: typeof value,
        expected: 'boolean',
        message: `Expected boolean for "${path}", got ${typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Pass true or false for "${path}".`
      };
    }
  } else if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected Array)',
        detected: typeof value,
        expected: 'array',
        message: `Expected array for "${path}", got ${typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Pass an array for "${path}".`
      };
    }
  } else if (expectedType === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        severity: 'error',
        category: 'parameter',
        eventName: eventName,
        path: path,
        code: 'INVALID_PARAMETER_TYPE',
        title: 'Invalid Parameter Type (Expected Object)',
        detected: Array.isArray(value) ? 'array' : typeof value,
        expected: 'object',
        message: `Expected object for "${path}", got ${Array.isArray(value) ? 'array' : typeof value}.`,
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: `Pass an object for "${path}".`
      };
    }
  }
  return null;
}
