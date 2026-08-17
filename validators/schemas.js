/**
 * OpenAI Ads Pixel Inspector - Schema Registry
 * 
 * Defines declarative schemas for all OpenAI Ads events according to official specifications:
 * https://developers.openai.com/ads/supported-events
 * https://developers.openai.com/ads/measurement-pixel
 */

export const ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN',
  'CHF', 'SEK', 'NOK', 'DKK', 'NZD', 'SGD', 'HKD', 'KRW', 'PLN', 'ZAR',
  'AED', 'SAR', 'TRY', 'ILS', 'THB', 'PHP', 'MYR', 'IDR', 'CZK', 'HUF'
]);

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
  amount: { type: 'integer', min: 0, minorUnit: true, description: 'Item monetary value in minor units (e.g. 2599 for $25.99)' },
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
    required: ['type'],
    optional: ['contents', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: true, description: 'Must be "contents"' },
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
    required: ['type'],
    optional: ['contents', 'amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: true, description: 'Must be "contents"' },
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
    required: ['type'],
    optional: ['amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: true, description: 'Must be "contents"' },
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
    required: ['type'],
    optional: ['amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: true, description: 'Must be "contents"' },
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
    required: ['type'],
    optional: ['amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'contents', required: true, description: 'Must be "contents"' },
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
    required: ['type'],
    optional: ['amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: true, description: 'Must be "customer_action"' },
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
    required: ['type'],
    optional: ['amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: true, description: 'Must be "customer_action"' },
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
    required: ['type'],
    optional: ['amount', 'currency'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'customer_action', required: true, description: 'Must be "customer_action"' },
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
    required: ['type'],
    optional: ['plan_id', 'amount', 'currency', 'contents'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'plan_enrollment', required: true, description: 'Must be "plan_enrollment"' },
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
    required: ['type'],
    optional: ['plan_id'],
    parameters: {
      type: { type: 'string', expected: 'plan_enrollment', required: true, description: 'Must be "plan_enrollment"' },
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
    required: ['type'],
    optional: ['plan_id', 'amount', 'currency', 'contents'],
    optionsRequired: ['custom_event_name'],
    conditionalRequired: [
      { when: 'amount', require: ['currency'], message: 'Currency is required whenever amount is provided' }
    ],
    parameters: {
      type: { type: 'string', expected: 'custom', required: true, description: 'Must be "custom"' },
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
