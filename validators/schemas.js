/**
 * OpenAI Ads Pixel Inspector - Schema Registry & ISO 4217 Currency Definitions
 * 
 * Defines declarative schemas for all OpenAI Ads events according to official specifications:
 * https://developers.openai.com/ads/supported-events
 * https://developers.openai.com/ads/measurement-pixel
 */

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

export const STANDARD_EVENT_NAMES = [
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
  'app_installed',
  'app_opened',
  'custom'
];

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
 * Content Item Schema for contents[] array items
 */
export const CONTENT_ITEM_SCHEMA = {
  id: { type: 'string', description: 'Internal product/item identifier' },
  group_id: { type: 'string', description: 'Product group or parent SKU (Conversions API only)' },
  name: { type: 'string', description: 'Human-readable product/item name' },
  content_type: { type: 'string', enum: ['product', 'plan', 'page', 'category', 'service'], description: 'Category type' },
  quantity: { type: 'integer', min: 1, description: 'Item quantity (positive integer)' },
  amount: { type: 'integer', min: 0, minorUnit: true, description: 'Item monetary value in minor units (e.g. 2500 for $25.00)' },
  currency: { type: 'string', format: 'currency', description: 'ISO 4217 3-letter currency code' },
  variant_dict: { type: 'object', description: 'Key-value map of variants (e.g. { size: "M" })' }
};

/**
 * Generic Declarative Event Schemas
 */
export const EVENT_SCHEMAS = {
  // 1. Page Viewed
  'page_viewed': {
    dataShape: 'contents',
    category: 'traffic',
    required: [],
    optional: ['type', 'contents', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: false, description: 'Optional data shape (defaults to "contents")' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Optional page content items' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Optional monetary value' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 2. Contents Viewed
  'contents_viewed': {
    dataShape: 'contents',
    category: 'engagement',
    required: [],
    optional: ['type', 'contents', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: false, description: 'Optional data shape (defaults to "contents")' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Array of viewed content/product items' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Monetary value in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 3. Items Added (Add To Cart)
  'items_added': {
    dataShape: 'contents',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: false, description: 'Optional data shape (defaults to "contents")' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Cart addition total in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Added product items' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 4. Checkout Started
  'checkout_started': {
    dataShape: 'contents',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: false, description: 'Optional data shape (defaults to "contents")' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Checkout total in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Cart checkout items' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 5. Order Created (Purchase)
  'order_created': {
    dataShape: 'contents',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: false, description: 'Optional data shape (defaults to "contents")' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Order total in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Purchased items' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 6. Lead Created
  'lead_created': {
    dataShape: 'customer_action',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: false, description: 'Optional data shape' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Estimated lead value in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 7. Registration Completed
  'registration_completed': {
    dataShape: 'customer_action',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: false, description: 'Optional data shape' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Optional value' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 8. Appointment Scheduled
  'appointment_scheduled': {
    dataShape: 'customer_action',
    category: 'conversion',
    required: [],
    optional: ['type', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: false, description: 'Optional data shape' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Booking value in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 9. Subscription Created
  'subscription_created': {
    dataShape: 'plan_enrollment',
    category: 'conversion',
    required: [],
    optional: ['type', 'plan_id', 'amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'plan_enrollment', required: false, description: 'Optional data shape' },
      plan_id: { type: 'string', description: 'Internal subscription plan identifier' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Recurring amount in minor units' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Plan-related items' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 10. Trial Started
  'trial_started': {
    dataShape: 'plan_enrollment',
    category: 'conversion',
    required: [],
    optional: ['type', 'plan_id'],
    parameters: {
      type: { type: 'string', expected: 'plan_enrollment', required: false, description: 'Optional data shape' },
      plan_id: { type: 'string', description: 'Trial plan identifier' }
    },
    options: {
      optional: ['event_id', 'opt_out']
    }
  },

  // 11. Custom Event
  'custom': {
    dataShape: 'custom',
    category: 'custom',
    required: [],
    optional: ['type', 'plan_id', 'amount', 'currency', 'contents'],
    optionsRequired: ['custom_event_name'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'custom', required: false, description: 'Optional data shape' },
      plan_id: { type: 'string', description: 'Optional plan ID' },
      amount: { type: 'integer', min: 0, minorUnit: true, description: 'Optional custom event value' },
      currency: { type: 'string', format: 'currency', description: 'ISO currency code' },
      contents: { type: 'array', itemSchema: 'Content', description: 'Optional content items' }
    },
    options: {
      required: ['custom_event_name'],
      optional: ['event_id', 'opt_out']
    }
  }
};

export const CUSTOM_EVENT_RULES = {
  minLength: 1,
  maxLength: 64,
  validPattern: /^[a-zA-Z0-9][a-zA-Z0-9_\-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
  reservedWords: new Set(['init', 'consent', 'config', 'set', 'get', 'measure', 'measureSingle'])
};
