/**
 * OpenAI Ads Pixel Inspector - Generic Parameter Validation Engine
 * 
 * Validates individual parameters, arrays, and objects against declarative schemas.
 * Severities: 'valid' (✅), 'warning' (⚠️), 'error' (❌), 'info' (ℹ️)
 */

import { ISO_CURRENCIES, CONTENT_ITEM_SCHEMA } from './schemas.js';

/**
 * Validates a single parameter value against a rule definition
 * 
 * @param {string} paramName 
 * @param {*} paramValue 
 * @param {object} rule - Rule definition from event schema
 * @param {object} allParams - Context of all passed parameters
 * @returns {object} Validation result { valid, severity, message, code }
 */
export function validateParameter(paramName, paramValue, rule = {}, allParams = {}) {
  // 1. Check for Null or Undefined
  if (paramValue === null) {
    if (rule.required) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_NULL_REQUIRED',
        message: `Required parameter "${paramName}" is null.`
      };
    }
    return {
      valid: false,
      severity: 'warning',
      code: 'PARAM_NULL',
      message: `Parameter "${paramName}" was provided with null value.`
    };
  }

  if (paramValue === undefined) {
    if (rule.required) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_MISSING_REQUIRED',
        message: `Missing required parameter "${paramName}".`
      };
    }
    return {
      valid: true,
      severity: 'info',
      code: 'PARAM_OPTIONAL_OMITTED',
      message: `Optional parameter "${paramName}" omitted.`
    };
  }

  // 2. Check for Unsupported / Unknown Parameter
  if (!rule || Object.keys(rule).length === 0) {
    return {
      valid: true,
      severity: 'info',
      code: 'PARAM_UNOFFICIAL_EXTRA',
      message: `Custom or non-standard parameter "${paramName}". Will be captured as custom payload.`
    };
  }

  // 3. Data Type Validation
  if (rule.type) {
    const typeResult = checkDataType(paramName, paramValue, rule.type);
    if (!typeResult.valid) {
      return typeResult;
    }
  }

  // 4. Expected Fixed Value (e.g. type: 'contents')
  if (rule.expected !== undefined && paramValue !== rule.expected) {
    return {
      valid: false,
      severity: 'error',
      code: 'PARAM_INVALID_EXPECTED_VALUE',
      message: `Parameter "${paramName}" must be exactly "${rule.expected}", got "${paramValue}".`
    };
  }

  // 5. Numeric / Amount Format & Minor Units Rules
  if (rule.type === 'integer' || rule.type === 'number') {
    if (rule.min !== undefined && paramValue < rule.min) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_NUM_MIN_OUT_OF_RANGE',
        message: `Parameter "${paramName}" (${paramValue}) must be greater than or equal to ${rule.min}.`
      };
    }

    if (rule.minorUnit) {
      if (!Number.isInteger(paramValue)) {
        return {
          valid: false,
          severity: 'warning',
          code: 'PARAM_AMOUNT_NOT_INTEGER',
          message: `"${paramName}" is decimal (${paramValue}). OpenAI expects minor currency units as an integer (e.g., 2599 for $25.99, or 35000 for $350.00).`
        };
      }
      
      // Educational warning for common major unit mistakes (e.g. sending 350 for $350 instead of 35000)
      if (paramValue > 0 && paramValue < 1000) {
        return {
          valid: true,
          severity: 'warning',
          code: 'PARAM_AMOUNT_POTENTIAL_MAJOR_UNITS',
          message: `"${paramName}" value is ${paramValue}. OpenAI interprets this as ${paramValue} minor units ($${(paramValue / 100).toFixed(2)} USD). If the item price is $${paramValue}.00, you must send ${paramValue * 100}!`
        };
      }
    }
  }

  // 6. String Rules & Empty Strings
  if (rule.type === 'string') {
    if (typeof paramValue === 'string' && paramValue.trim() === '') {
      if (rule.required) {
        return {
          valid: false,
          severity: 'error',
          code: 'PARAM_EMPTY_STRING_REQUIRED',
          message: `Required parameter "${paramName}" cannot be an empty string.`
        };
      }
      return {
        valid: false,
        severity: 'warning',
        code: 'PARAM_EMPTY_STRING',
        message: `Parameter "${paramName}" is an empty string.`
      };
    }
  }

  // 7. Format Checks (Currency, Hashes, etc.)
  if (rule.format === 'currency') {
    if (typeof paramValue !== 'string') {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_CURRENCY_INVALID_TYPE',
        message: `Currency must be a 3-letter uppercase ISO code (e.g., "USD").`
      };
    }
    const clean = paramValue.trim().toUpperCase();
    if (!ISO_CURRENCIES.has(clean)) {
      return {
        valid: false,
        severity: 'warning',
        code: 'PARAM_CURRENCY_UNKNOWN_CODE',
        message: `"${paramValue}" is not a recognized ISO 4217 3-letter currency code.`
      };
    }
  }

  // 8. Enum Validation
  if (rule.enum && Array.isArray(rule.enum)) {
    if (!rule.enum.includes(paramValue)) {
      return {
        valid: false,
        severity: 'warning',
        code: 'PARAM_ENUM_INVALID',
        message: `Value "${paramValue}" for "${paramName}" is not in standard list: [${rule.enum.join(', ')}].`
      };
    }
  }

  // 9. Array & Content Item Validation
  if (rule.type === 'array') {
    if (!Array.isArray(paramValue)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_ARRAY_INVALID_TYPE',
        message: `Expected array for "${paramName}".`
      };
    }

    if (paramValue.length === 0) {
      return {
        valid: true,
        severity: 'info',
        code: 'PARAM_ARRAY_EMPTY',
        message: `Array "${paramName}" is empty ([]). Consider passing item details if available.`
      };
    }

    if (rule.itemSchema === 'Content') {
      const itemIssues = [];
      paramValue.forEach((item, idx) => {
        if (!item || typeof item !== 'object') {
          itemIssues.push(`Item #${idx + 1} must be an object.`);
        } else {
          for (const [propName, propRule] of Object.entries(CONTENT_ITEM_SCHEMA)) {
            if (item[propName] !== undefined) {
              const res = validateParameter(propName, item[propName], propRule, item);
              if (!res.valid) {
                itemIssues.push(`Item #${idx + 1} "${propName}": ${res.message}`);
              }
            }
          }
        }
      });

      if (itemIssues.length > 0) {
        return {
          valid: false,
          severity: 'warning',
          code: 'PARAM_CONTENTS_ITEM_WARNING',
          message: itemIssues.join(' | ')
        };
      }
    }
  }

  // All checks passed
  return {
    valid: true,
    severity: 'valid',
    code: 'PARAM_VALID',
    message: `Valid parameter "${paramName}".`
  };
}

/**
 * Validates data type
 */
function checkDataType(paramName, value, expectedType) {
  if (expectedType === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value) || isNaN(value)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_INTEGER',
        message: `Expected integer for "${paramName}", got ${typeof value === 'number' ? 'float' : typeof value}.`
      };
    }
  } else if (expectedType === 'number') {
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_NUMBER',
        message: `Expected number for "${paramName}", got ${typeof value}.`
      };
    }
  } else if (expectedType === 'string') {
    if (typeof value !== 'string') {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_STRING',
        message: `Expected string for "${paramName}", got ${typeof value}.`
      };
    }
  } else if (expectedType === 'boolean') {
    if (typeof value !== 'boolean') {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_BOOLEAN',
        message: `Expected boolean for "${paramName}", got ${typeof value}.`
      };
    }
  } else if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_ARRAY',
        message: `Expected array for "${paramName}", got ${typeof value}.`
      };
    }
  } else if (expectedType === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_OBJECT',
        message: `Expected object for "${paramName}", got ${Array.isArray(value) ? 'array' : typeof value}.`
      };
    }
  }

  return { valid: true };
}
