/**
 * OpenAI Ads Pixel Inspector - Schema Registry
 * 
 * Defines official standard event schemas and data shapes for OpenAI Ads (oaiq).
 * Source: https://developers.openai.com/ads/supported-events
 *         https://developers.openai.com/ads/measurement-pixel
 *         https://developers.openai.com/ads/multiple-pixels
 * Last verified: Official OpenAI Ads Documentation 2026
 */

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

export const ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN',
  'CHF', 'SEK', 'NOK', 'DKK', 'NZD', 'SGD', 'HKD', 'KRW', 'PLN', 'ZAR',
  'AED', 'SAR', 'TRY', 'ILS', 'THB', 'PHP', 'MYR', 'IDR', 'CZK', 'HUF'
]);

/**
 * Event Data Shapes specified by OpenAI:
 * - contents (items_added, checkout_started, contents_viewed, order_created, page_viewed)
 * - customer_action (appointment_scheduled, lead_created, registration_completed, app_installed, app_opened)
 * - plan_enrollment (subscription_created, trial_started)
 * - custom (custom)
 */
export const EVENT_DATA_SHAPES = {
  contents: {
    shape: 'contents',
    requiredFields: ['type'],
    parameters: {
      type: { type: 'string', expectedValue: 'contents' },
      amount: { type: 'integer', min: 0, minorUnitsRecommended: true },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array', itemType: 'Content' }
    }
  },
  customer_action: {
    shape: 'customer_action',
    requiredFields: ['type'],
    parameters: {
      type: { type: 'string', expectedValue: 'customer_action' },
      amount: { type: 'integer', min: 0, minorUnitsRecommended: true },
      currency: { type: 'string', format: 'currency' }
    }
  },
  plan_enrollment: {
    shape: 'plan_enrollment',
    requiredFields: ['type'],
    parameters: {
      type: { type: 'string', expectedValue: 'plan_enrollment' },
      plan_id: { type: 'string' },
      amount: { type: 'integer', min: 0, minorUnitsRecommended: true },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array', itemType: 'Content' }
    }
  },
  custom: {
    shape: 'custom',
    requiredFields: ['type'],
    parameters: {
      type: { type: 'string', expectedValue: 'custom' },
      plan_id: { type: 'string' },
      amount: { type: 'integer', min: 0, minorUnitsRecommended: true },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array', itemType: 'Content' }
    }
  }
};

/**
 * Content Item Schema for contents[] array
 */
export const CONTENT_ITEM_SCHEMA = {
  id: { type: 'string' },
  group_id: { type: 'string' },
  name: { type: 'string' },
  content_type: { type: 'string' }, // e.g. "product", "plan", "page"
  quantity: { type: 'integer', min: 1 },
  amount: { type: 'integer', min: 0, minorUnitsRecommended: true },
  currency: { type: 'string', format: 'currency' },
  variant_dict: { type: 'object' }
};

/**
 * Standard Events Directory with Data Shape mappings
 */
export const EVENT_SCHEMAS = {
  // Page Viewed
  'page_viewed': {
    description: 'A user lands on or views an important page.',
    dataShape: 'contents',
    category: 'traffic',
    isPixelSupported: true
  },

  // Contents Viewed
  'contents_viewed': {
    description: 'A user views a product, listing, article, or other content unit.',
    dataShape: 'contents',
    category: 'engagement',
    isPixelSupported: true
  },

  // Items Added (Add to Cart)
  'items_added': {
    description: 'A user adds one or more items to a cart, bundle, or selection.',
    dataShape: 'contents',
    category: 'conversion',
    isPixelSupported: true
  },

  // Checkout Started
  'checkout_started': {
    description: 'A user starts checkout.',
    dataShape: 'contents',
    category: 'conversion',
    isPixelSupported: true
  },

  // Order Created (Purchase)
  'order_created': {
    description: 'A purchase is completed.',
    dataShape: 'contents',
    category: 'conversion',
    isPixelSupported: true
  },

  // Lead Created
  'lead_created': {
    description: 'A user submits a lead form or requests contact.',
    dataShape: 'customer_action',
    category: 'conversion',
    isPixelSupported: true
  },

  // Registration Completed
  'registration_completed': {
    description: 'A user finishes an account or event registration flow.',
    dataShape: 'customer_action',
    category: 'conversion',
    isPixelSupported: true
  },

  // Appointment Scheduled
  'appointment_scheduled': {
    description: 'A user books a meeting, demo, or consultation.',
    dataShape: 'customer_action',
    category: 'conversion',
    isPixelSupported: true
  },

  // Subscription Created
  'subscription_created': {
    description: 'A paid subscription starts.',
    dataShape: 'plan_enrollment',
    category: 'conversion',
    isPixelSupported: true
  },

  // Trial Started
  'trial_started': {
    description: 'A free trial starts.',
    dataShape: 'plan_enrollment',
    category: 'conversion',
    isPixelSupported: true
  },

  // App Installed (CAPI only)
  'app_installed': {
    description: 'A user installs an app (Conversions API only).',
    dataShape: 'customer_action',
    category: 'mobile',
    isPixelSupported: false
  },

  // App Opened (CAPI only)
  'app_opened': {
    description: 'A user opens an app (Conversions API only).',
    dataShape: 'customer_action',
    category: 'mobile',
    isPixelSupported: false
  },

  // Custom Event
  'custom': {
    description: 'A user-defined event not covered by standard taxonomy.',
    dataShape: 'custom',
    category: 'custom',
    isPixelSupported: true
  }
};

/**
 * Options Schema (4th argument in measure call)
 */
export const EVENT_OPTIONS_SCHEMA = {
  event_id: { type: 'string', minLength: 1 },
  custom_event_name: { type: 'string', minLength: 1, maxLength: 64 },
  opt_out: { type: 'boolean' }
};

export const CUSTOM_EVENT_RULES = {
  minLength: 1,
  maxLength: 64,
  validPattern: /^[a-zA-Z0-9][a-zA-Z0-9_\-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
  reservedWords: new Set(['init', 'consent', 'config', 'set', 'get', 'measure', 'measureSingle'])
};
