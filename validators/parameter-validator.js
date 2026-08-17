/**
 * OpenAI Ads Pixel Inspector - Parameter Validator
 */

import { ISO_CURRENCIES } from './schemas.js';

export function validateParameter(paramName, paramValue, rule = {}) {
  const result = {
    valid: true,
    severity: 'success', // 'success' | 'warning' | 'error' | 'info'
    message: 'Valid parameter',
    value: paramValue
  };

  if (paramValue === null || paramValue === undefined) {
    return {
      valid: false,
      severity: 'error',
      message: `Parameter "${paramName}" is null or undefined.`
    };
  }

  // Type check
  if (rule.type) {
    let actualType = typeof paramValue;
    if (Array.isArray(paramValue)) actualType = 'array';

    if (rule.type === 'number') {
      if (typeof paramValue !== 'number' || isNaN(paramValue)) {
        return {
          valid: false,
          severity: 'error',
          message: `Expected number for "${paramName}", got ${typeof paramValue}.`
        };
      }
      if (rule.min !== undefined && paramValue < rule.min) {
        return {
          valid: false,
          severity: 'error',
          message: `Parameter "${paramName}" must be >= ${rule.min}.`
        };
      }
      if (rule.minorUnitsRecommended && Number.isInteger(paramValue) && paramValue < 100 && paramValue > 0) {
        return {
          valid: true,
          severity: 'warning',
          message: `"${paramName}" value (${paramValue}) appears to be in major currency units. OpenAI Ads Pixel expects minor units (cents, e.g., 2599 for $25.99).`
        };
      }
    } else if (rule.type === 'string') {
      if (typeof paramValue !== 'string') {
        return {
          valid: false,
          severity: 'error',
          message: `Expected string for "${paramName}", got ${typeof paramValue}.`
        };
      }
      if (rule.minLength && paramValue.trim().length < rule.minLength) {
        return {
          valid: false,
          severity: 'error',
          message: `Parameter "${paramName}" cannot be empty.`
        };
      }
    } else if (rule.type === 'array') {
      if (!Array.isArray(paramValue)) {
        return {
          valid: false,
          severity: 'error',
          message: `Expected array for "${paramName}".`
        };
      }
    }
  }

  // Format checks
  if (rule.format === 'currency') {
    if (typeof paramValue !== 'string') {
      return {
        valid: false,
        severity: 'error',
        message: `Currency must be a 3-letter uppercase ISO code (e.g., "USD").`
      };
    }
    const cleanCurrency = paramValue.trim().toUpperCase();
    if (!ISO_CURRENCIES.has(cleanCurrency)) {
      return {
        valid: false,
        severity: 'warning',
        message: `"${paramValue}" is not a recognized 3-letter ISO 4217 currency code.`
      };
    }
  }

  // Enum checks
  if (rule.enum && Array.isArray(rule.enum)) {
    if (!rule.enum.includes(paramValue)) {
      return {
        valid: false,
        severity: 'warning',
        message: `Value "${paramValue}" for "${paramName}" is not in standard list: [${rule.enum.join(', ')}].`
      };
    }
  }

  return result;
}
