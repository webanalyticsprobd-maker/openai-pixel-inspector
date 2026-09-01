/**
 * OpenAI Ads Pixel Inspector - Official Schema Registry & Validation Rules
 * 
 * Single Source of Truth derived strictly from official OpenAI documentation:
 * - Measurement Pixel: https://developers.openai.com/ads/measurement-pixel
 * - Supported Events:  https://developers.openai.com/ads/supported-events
 * - Multiple Pixels:   https://developers.openai.com/ads/multiple-pixels
 */

export const OFFICIAL_DOCS = {
  MEASUREMENT_PIXEL: 'https://developers.openai.com/ads/measurement-pixel',
  COMMERCE_FLOW: 'https://developers.openai.com/ads/measurement-pixel#commerce-flow',
  SUPPORTED_EVENTS: 'https://developers.openai.com/ads/supported-events',
  MULTIPLE_PIXELS: 'https://developers.openai.com/ads/multiple-pixels'
};

export const CURRENCY_DECIMAL_PLACES = {
  // 0 Decimal Places (Multiplier: 10^0 = 1)
  'JPY': 0, 'KRW': 0, 'VND': 0, 'CLP': 0, 'ISK': 0, 'PYG': 0, 'RWF': 0, 'UGX': 0,
  
  // 3 Decimal Places (Multiplier: 10^3 = 1000)
  'KWD': 3, 'BHD': 3, 'OMR': 3, 'JOD': 3, 'TND': 3, 'IQD': 3, 'LYD': 3,

  // 2 Decimal Places (Standard Default, Multiplier: 10^2 = 100)
  'USD': 2, 'BDT': 2, 'EUR': 2, 'GBP': 2, 'CAD': 2, 'AUD': 2, 'INR': 2,
  'CHF': 2, 'SGD': 2, 'NZD': 2, 'BRL': 2, 'MXN': 2, 'CNY': 2, 'SEK': 2,
  'NOK': 2, 'DKK': 2, 'HKD': 2, 'PLN': 2, 'ZAR': 2, 'AED': 2, 'SAR': 2,
  'TRY': 2, 'ILS': 2, 'THB': 2, 'PHP': 2, 'MYR': 2, 'IDR': 2, 'CZK': 2,
  'HUF': 2, 'PKR': 2, 'EGP': 2, 'NGN': 2, 'KES': 2, 'GHS': 2, 'LKR': 2
};

export const ISO_CURRENCIES = new Set(Object.keys(CURRENCY_DECIMAL_PLACES));

export function getCurrencyDecimalPlaces(currencyCode) {
  if (!currencyCode || typeof currencyCode !== 'string') return 2;
  const clean = currencyCode.trim().toUpperCase();
  return CURRENCY_DECIMAL_PLACES[clean] !== undefined ? CURRENCY_DECIMAL_PLACES[clean] : 2;
}

export function getCurrencySmallestUnitName(currencyCode) {
  const clean = (currencyCode || 'USD').trim().toUpperCase();
  switch (clean) {
    case 'USD': case 'CAD': case 'AUD': case 'NZD': case 'SGD': return 'cents';
    case 'BDT': return 'poisha';
    case 'EUR': return 'cents';
    case 'GBP': return 'pence';
    case 'INR': case 'PKR': return 'paise';
    case 'CHF': return 'rappen/centimes';
    case 'KWD': case 'BHD': case 'IQD': case 'JOD': return 'fils';
    case 'OMR': return 'baisa';
    case 'JPY': return 'yen (0 decimals)';
    case 'KRW': return 'won (0 decimals)';
    case 'VND': return 'dong (0 decimals)';
    default: return `${getCurrencyDecimalPlaces(clean)} decimal minor units`;
  }
}

/**
 * Official Standard JavaScript Pixel Events
 */
export const STANDARD_JS_EVENTS = [
  'page_viewed',
  'contents_viewed',
  'items_added',
  'checkout_started',
  'order_created',
  'lead_created',
  'registration_completed',
  'appointment_scheduled',
  'subscription_created',
  'trial_started',
  'custom'
];

/**
 * Conversions API (CAPI) Only Events (Not for Browser JS Pixel)
 */
export const CAPI_ONLY_EVENTS = [
  'app_installed',
  'app_opened'
];

export const STANDARD_EVENT_NAMES = [...STANDARD_JS_EVENTS, ...CAPI_ONLY_EVENTS];

export const STANDARD_EVENT_ALIASES = {
  'PageView': 'page_viewed',
  'AddToCart': 'items_added',
  'add_to_cart': 'items_added',
  'ViewContent': 'contents_viewed',
  'view_content': 'contents_viewed',
  'BeginCheckout': 'checkout_started',
  'Purchase': 'order_created',
  'CompleteRegistration': 'registration_completed',
  'Schedule': 'appointment_scheduled',
  'Subscribe': 'subscription_created',
  'StartTrial': 'trial_started'
};

/**
 * Documented Content Item Schema for contents[] array items in Browser JS Pixel
 */
export const CONTENT_ITEM_SCHEMA = {
  // Documented JS Pixel Content fields
  id: { type: 'string', required: false, description: 'Internal product or item identifier' },
  name: { type: 'string', required: false, description: 'Human-readable product/item name' },
  content_type: { type: 'string', enum: ['product', 'plan', 'page', 'category', 'service'], required: false, description: 'Category type (e.g. product, page)' },
  quantity: { type: 'integer', min: 1, required: false, description: 'Item quantity (integer, never string)' },
  amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Item monetary value in minor units (e.g. 2599 for $25.99)' },
  currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 3-letter uppercase currency code' },

  // Conversions API (CAPI) only fields - flagged as warning if in JS Pixel
  group_id: { type: 'string', capiOnly: true, description: 'Product group or parent SKU (Conversions API only)' },
  variant_dict: { type: 'object', capiOnly: true, description: 'Key-value map of variants (Conversions API only)' }
};

export const ALLOWED_CONTENT_ITEM_FIELDS = new Set(Object.keys(CONTENT_ITEM_SCHEMA));

/**
 * Central Declarative Event Schemas
 */
export const OPENAI_PIXEL_SCHEMA = {
  events: {
    // 1. Page Viewed
    'page_viewed': {
      dataShape: 'contents',
      category: 'traffic',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: [],
      optionalParameters: ['contents', 'amount', 'currency'],
      allowedParameters: ['type', 'contents', 'amount', 'currency'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'contents', required: true, description: 'Mandatory data shape (must be "contents")' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Optional page content items (e.g. { id, name, content_type: "page" })' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Optional monetary value in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 uppercase currency code' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 2. Contents Viewed
    'contents_viewed': {
      dataShape: 'contents',
      category: 'engagement',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: ['contents'],
      optionalParameters: ['contents', 'amount', 'currency'],
      allowedParameters: ['type', 'contents', 'amount', 'currency'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'contents', required: true, description: 'Mandatory data shape (must be "contents")' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Array of viewed content/product items' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Monetary value in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 3. Items Added (Add To Cart)
    'items_added': {
      dataShape: 'contents',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.COMMERCE_FLOW,
      requiredParameters: ['type'],
      recommendedParameters: ['amount', 'currency'],
      optionalParameters: ['amount', 'currency', 'contents'],
      allowedParameters: ['type', 'amount', 'currency', 'contents'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'contents', required: true, description: 'Mandatory data shape (must be "contents")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Cart addition total in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Added product items (optional array of Content objects)' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 4. Checkout Started
    'checkout_started': {
      dataShape: 'contents',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.COMMERCE_FLOW,
      requiredParameters: ['type'],
      recommendedParameters: ['amount', 'currency'],
      optionalParameters: ['amount', 'currency', 'contents'],
      allowedParameters: ['type', 'amount', 'currency', 'contents'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'contents', required: true, description: 'Mandatory data shape (must be "contents")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Checkout total in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Cart checkout items' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 5. Order Created (Purchase)
    'order_created': {
      dataShape: 'contents',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.COMMERCE_FLOW,
      requiredParameters: ['type'],
      recommendedParameters: ['amount', 'currency'],
      optionalParameters: ['amount', 'currency', 'contents'],
      allowedParameters: ['type', 'amount', 'currency', 'contents'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'contents', required: true, description: 'Mandatory data shape (must be "contents")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Order total in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Purchased items' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 6. Lead Created
    'lead_created': {
      dataShape: 'customer_action',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: [],
      optionalParameters: ['amount', 'currency'],
      allowedParameters: ['type', 'amount', 'currency'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'customer_action', required: true, description: 'Mandatory data shape (must be "customer_action")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Estimated lead value in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 7. Registration Completed
    'registration_completed': {
      dataShape: 'customer_action',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: [],
      optionalParameters: ['amount', 'currency'],
      allowedParameters: ['type', 'amount', 'currency'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'customer_action', required: true, description: 'Mandatory data shape (must be "customer_action")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Optional value in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 8. Appointment Scheduled
    'appointment_scheduled': {
      dataShape: 'customer_action',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: [],
      optionalParameters: ['amount', 'currency'],
      allowedParameters: ['type', 'amount', 'currency'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'customer_action', required: true, description: 'Mandatory data shape (must be "customer_action")' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Booking value in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 9. Subscription Created
    'subscription_created': {
      dataShape: 'plan_enrollment',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: ['plan_id', 'amount', 'currency'],
      optionalParameters: ['plan_id', 'amount', 'currency', 'contents'],
      allowedParameters: ['type', 'plan_id', 'amount', 'currency', 'contents'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'plan_enrollment', required: true, description: 'Mandatory data shape (must be "plan_enrollment")' },
        plan_id: { type: 'string', required: false, description: 'Internal subscription plan identifier' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Recurring amount in minor units' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Plan-related items' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 10. Trial Started
    'trial_started': {
      dataShape: 'plan_enrollment',
      category: 'conversion',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      recommendedParameters: ['plan_id'],
      optionalParameters: ['plan_id'],
      allowedParameters: ['type', 'plan_id'],
      parameters: {
        type: { type: 'string', expected: 'plan_enrollment', required: true, description: 'Mandatory data shape (must be "plan_enrollment")' },
        plan_id: { type: 'string', required: false, description: 'Trial plan identifier' }
      },
      options: {
        optional: ['event_id', 'opt_out']
      }
    },

    // 11. Custom Event
    'custom': {
      dataShape: 'custom',
      category: 'custom',
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      optionsRequired: ['custom_event_name'],
      optionalParameters: ['plan_id', 'amount', 'currency', 'contents'],
      allowedParameters: ['type', 'plan_id', 'amount', 'currency', 'contents'],
      conditionalRequired: [
        { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
      ],
      parameters: {
        type: { type: 'string', expected: 'custom', required: true, description: 'Mandatory data shape (must be "custom")' },
        plan_id: { type: 'string', required: false, description: 'Optional plan ID' },
        amount: { type: 'integer', min: 0, minorUnit: true, required: false, description: 'Optional custom event value' },
        currency: { type: 'string', format: 'currency', required: false, description: 'ISO 4217 currency code' },
        contents: { type: 'array', itemSchema: 'Content', required: false, description: 'Optional content items' }
      },
      options: {
        required: ['custom_event_name'],
        optional: ['event_id', 'opt_out']
      }
    },

    // Conversions API (CAPI) Only Events
    'app_installed': {
      dataShape: 'app_activity',
      category: 'capi_only',
      capiOnly: true,
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      parameters: { type: { type: 'string', expected: 'app_activity' } }
    },
    'app_opened': {
      dataShape: 'app_activity',
      category: 'capi_only',
      capiOnly: true,
      docUrl: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      requiredParameters: ['type'],
      parameters: { type: { type: 'string', expected: 'app_activity' } }
    }
  }
};

export const EVENT_SCHEMAS = OPENAI_PIXEL_SCHEMA.events;

export const CUSTOM_EVENT_RULES = {
  minLength: 1,
  maxLength: 64,
  validPattern: /^[a-zA-Z0-9][a-zA-Z0-9_-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
  recommendedCase: 'lowercase',
  reservedWords: new Set(['init', 'consent', 'config', 'set', 'get', 'measure', 'measureSingle', ...STANDARD_EVENT_NAMES])
};
