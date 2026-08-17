/**
 * OpenAI Ads Pixel Inspector - Strict Generic Parameter Validation Engine
 * 
 * Validates individual parameters, arrays, and objects against official OpenAI Ads schemas.
 * Strictly checks data types, minor currency unit formatting, required fields, and mathematical consistency.
 */

import {
  ISO_CURRENCIES,
  CONTENT_ITEM_SCHEMA,
  getCurrencyDecimalPlaces,
  getCurrencySmallestUnitName
} from './schemas.js';

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
    return {
      valid: false,
      severity: 'error',
      code: 'PARAM_NULL',
      message: `Parameter "${paramName}" cannot be null.`
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

  // 2. Check for Unsupported / Unknown Parameter on Standard Events
  if (!rule || Object.keys(rule).length === 0) {
    return {
      valid: false,
      severity: 'warning',
      code: 'PARAM_UNSUPPORTED',
      message: `"${paramName}" is not a recognized standard OpenAI Ads Pixel parameter.`
    };
  }

  // 3. Data Type Validation
  if (rule.type) {
    const typeResult = checkDataType(paramName, paramValue, rule.type);
    if (!typeResult.valid) {
      return typeResult;
    }
  }

  // 4. Expected Fixed Value (e.g. type: 'contents', 'customer_action', 'plan_enrollment', 'custom')
  if (rule.expected !== undefined && paramValue !== rule.expected) {
    return {
      valid: false,
      severity: 'error',
      code: 'PARAM_INVALID_DATA_SHAPE_TYPE',
      message: `Parameter "${paramName}" must be exactly "${rule.expected}", got "${paramValue}".`
    };
  }

  // 5. Amount & Minor Currency Units Requirements
  if (rule.type === 'integer' || rule.type === 'number') {
    if (rule.min !== undefined && paramValue < rule.min) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_NUM_MIN_OUT_OF_RANGE',
        message: `Parameter "${paramName}" (${paramValue}) cannot be negative. Must be >= ${rule.min}.`
      };
    }

    if (rule.minorUnit) {
      // Must be an integer (no floats, decimals, or strings)
      if (!Number.isInteger(paramValue)) {
        return {
          valid: false,
          severity: 'error',
          code: 'PARAM_AMOUNT_NOT_INTEGER',
          message: `"${paramName}" (${paramValue}) must be an integer in minor currency units (no decimals). For example, send 12599 for $125.99 USD.`
        };
      }

      // Check currency pairing
      if (!allParams.currency && rule.requiredCurrency !== false) {
        return {
          valid: false,
          severity: 'error',
          code: 'PARAM_AMOUNT_MISSING_CURRENCY',
          message: `Parameter "currency" is strictly required whenever "${paramName}" is provided.`
        };
      }

      // Check if event amount was mistakenly sent in major units while contents items used minor units
      if (paramName === 'amount' && Array.isArray(allParams.contents) && allParams.contents.length > 0) {
        const itemsWithAmount = allParams.contents.filter(i => typeof i.amount === 'number');
        if (itemsWithAmount.length > 0) {
          const itemsSum = allParams.contents.reduce((sum, i) => sum + (i.amount * (Number(i.quantity) || 1)), 0);
          const curr = (allParams.currency || 'USD').toString().toUpperCase();
          const mult = (curr === 'JPY' || curr === 'KRW') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);
          
          if (mult > 1 && paramValue * mult === itemsSum) {
            return {
              valid: false,
              severity: 'error',
              code: 'PARAM_AMOUNT_MAJOR_UNITS',
              message: `Event amount (${paramValue}) was sent in major units ($${paramValue}.00). In ${curr}, OpenAI expects minor units: ${itemsSum} (${paramValue} × ${mult})!`
            };
          }
        }
      }
    }
  }

  // 6. String Rules & Empty Strings
  if (rule.type === 'string') {
    if (typeof paramValue === 'string' && paramValue.trim() === '') {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_EMPTY_STRING',
        message: `Parameter "${paramName}" cannot be an empty string.`
      };
    }
  }

  // 7. Currency Format Checks (ISO 4217)
  if (rule.format === 'currency') {
    if (typeof paramValue !== 'string') {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_CURRENCY_INVALID_TYPE',
        message: `Currency must be a 3-letter uppercase ISO 4217 string (e.g., "USD", "BDT", "EUR").`
      };
    }
    const clean = paramValue.trim().toUpperCase();
    if (!ISO_CURRENCIES.has(clean)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_CURRENCY_INVALID_FORMAT',
        message: `"${paramValue}" is not a recognized 3-letter ISO 4217 currency code.`
      };
    }
    if (paramValue !== clean) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_CURRENCY_NOT_UPPERCASE',
        message: `Currency code "${paramValue}" must be uppercase (e.g., "${clean}").`
      };
    }
  }

  // 8. Enum Validation (e.g. content_type in ['product', 'plan', 'page', 'category', 'service'])
  if (rule.enum && Array.isArray(rule.enum)) {
    if (!rule.enum.includes(paramValue)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_ENUM_INVALID',
        message: `Value "${paramValue}" for "${paramName}" is invalid. Must be one of: [${rule.enum.join(', ')}].`
      };
    }
  }

  // 9. Array & Content Item Validation (contents[])
  if (rule.type === 'array') {
    if (!Array.isArray(paramValue)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_ARRAY_INVALID_TYPE',
        message: `Expected array for "${paramName}".`
      };
    }

    if (rule.itemSchema === 'Content') {
      const itemIssues = [];
      let itemsTotalAmount = 0;
      let hasItemAmounts = false;

      paramValue.forEach((item, idx) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          itemIssues.push(`Item #${idx + 1} must be an object.`);
        } else {
          // Inherit event-level currency if item-level currency omitted
          const itemContext = Object.assign({ currency: allParams.currency || 'USD' }, item);
          
          if (typeof item.amount === 'number') {
            hasItemAmounts = true;
            itemsTotalAmount += item.amount * (Number(item.quantity) || 1);
          }

          for (const [propName, propRule] of Object.entries(CONTENT_ITEM_SCHEMA)) {
            if (item[propName] !== undefined) {
              const res = validateParameter(propName, item[propName], propRule, itemContext);
              if (!res.valid && res.severity === 'error') {
                itemIssues.push(`Item #${idx + 1} "${propName}": ${res.message}`);
              }
            }
          }
        }
      });

      // Detect if contents item amounts were mistakenly sent in major units while event amount used minor units
      if (hasItemAmounts && typeof allParams.amount === 'number') {
        const curr = (allParams.currency || 'USD').toString().toUpperCase();
        const mult = (curr === 'JPY' || curr === 'KRW') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);
        
        if (mult > 1 && itemsTotalAmount * mult === allParams.amount) {
          itemIssues.push(`Item amount in contents (${itemsTotalAmount}) was sent in major units. For ${curr}, OpenAI expects minor units: ${allParams.amount} (${itemsTotalAmount} × ${mult})!`);
        }
      }

      if (itemIssues.length > 0) {
        return {
          valid: false,
          severity: 'error',
          code: 'PARAM_CONTENTS_ITEM_ERROR',
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
 * Validates data type strictly
 */
function checkDataType(paramName, value, expectedType) {
  if (expectedType === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value) || isNaN(value)) {
      return {
        valid: false,
        severity: 'error',
        code: 'PARAM_TYPE_NOT_INTEGER',
        message: `Expected integer for "${paramName}", got ${typeof value === 'number' ? 'float/decimal' : typeof value}.`
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
