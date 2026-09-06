/**
 * OpenAI Ads Pixel Inspector - Official Schema Registry & Validation Rules
 * 
 * Single Source of Truth derived strictly from official OpenAI documentation:
 * - Measurement Pixel: https://developers.openai.com/ads/measurement-pixel
 * - Supported Events:  https://developers.openai.com/ads/supported-events
 * - Multiple Pixels:   https://developers.openai.com/ads/multiple-pixels
 */

export const SCHEMA_METADATA = {
  validatorRulesVersion: '2026.09.06',
  docsSource: 'OpenAI Ads Documentation',
  docsCheckedAt: '2026-09-06'
};

export const OFFICIAL_DOCS = {
  MEASUREMENT_PIXEL: 'https://developers.openai.com/ads/measurement-pixel',
  COMMERCE_FLOW: 'https://developers.openai.com/ads/measurement-pixel#commerce-flow',
  SUPPORTED_EVENTS: 'https://developers.openai.com/ads/supported-events',
  MULTIPLE_PIXELS: 'https://developers.openai.com/ads/multiple-pixels'
};

/**
 * Central Official Event Schema Registry
 * Explicitly maps documented browser-relevant event names to category and expected dataType.
 */
export const EVENT_REGISTRY = {
  // Behavioral / Page
  page_viewed: {
    friendlyName: 'Page Viewed',
    category: 'behavioral',
    dataType: 'contents',
    icon: '👁'
  },
  contents_viewed: {
    friendlyName: 'Contents Viewed',
    category: 'content',
    dataType: 'contents',
    icon: '📦'
  },
  // Ecommerce Funnel
  items_added: {
    friendlyName: 'Items Added',
    category: 'ecommerce',
    dataType: 'contents',
    icon: '🛒'
  },
  checkout_started: {
    friendlyName: 'Checkout Started',
    category: 'ecommerce',
    dataType: 'contents',
    icon: '🧾'
  },
  order_created: {
    friendlyName: 'Order Created',
    category: 'ecommerce',
    dataType: 'contents',
    icon: '💰'
  },
  // Lead Generation
  lead_created: {
    friendlyName: 'Lead Created',
    category: 'leadgen',
    dataType: 'customer_action',
    icon: '📩'
  },
  registration_completed: {
    friendlyName: 'Registration Completed',
    category: 'leadgen',
    dataType: 'customer_action',
    icon: '👤'
  },
  appointment_scheduled: {
    friendlyName: 'Appointment Scheduled',
    category: 'leadgen',
    dataType: 'customer_action',
    icon: '📅'
  },
  // Subscription
  subscription_created: {
    friendlyName: 'Subscription Created',
    category: 'subscription',
    dataType: 'plan_enrollment',
    icon: '💳'
  },
  trial_started: {
    friendlyName: 'Trial Started',
    category: 'subscription',
    dataType: 'plan_enrollment',
    icon: '🧪'
  },
  // Custom
  custom: {
    friendlyName: 'Custom Event',
    category: 'custom',
    dataType: 'custom',
    icon: '⚡'
  },
  // System / SDK Internal Lifecycle
  'openai::sdk_init': {
    friendlyName: 'OpenAI SDK Initialized',
    category: 'system',
    dataType: 'sdk_lifecycle',
    icon: '⚙'
  },
  // Diagnostic
  'oai::diagnostic': {
    friendlyName: 'SDK Diagnostic',
    category: 'diagnostic',
    dataType: 'diagnostic',
    icon: '🩺'
  }
};

export const CURRENCY_DECIMAL_PLACES = {
  // 0 Decimal Places (Multiplier: 10^0 = 1)
  'JPY': 0, 'KRW': 0, 'VND': 0, 'CLP': 0, 'ISK': 0, 'PYG': 0, 'RWF': 0, 'UGX': 0,
  'BIF': 0, 'DJF': 0, 'GNF': 0, 'KMF': 0, 'MGA': 0, 'XAF': 0, 'XOF': 0, 'XPF': 0,
  
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
    case 'JPY': return 'yen (0 minor units)';
    case 'KRW': return 'won (0 minor units)';
    case 'VND': return 'dong (0 minor units)';
    default: return `${getCurrencyDecimalPlaces(clean)} decimal minor units`;
  }
}

/**
 * Decodes integer minor currency units into human-readable major currency amount.
 * Respects ISO 4217 currency exponent table.
 */
export function decodeMoney(amount, currencyCode = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) return null;
  const decimals = getCurrencyDecimalPlaces(currencyCode);
  const major = amount / Math.pow(10, decimals);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode.toUpperCase(),
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(major);
  } catch {
    return `${currencyCode.toUpperCase()} ${major.toFixed(decimals)}`;
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

/**
 * Deterministic Explanations Dictionary: "Why is this data sent?"
 * Provides reliable, client-friendly definitions for all observed fields without AI hallucinations.
 */
export const FIELD_EXPLANATIONS = {
  amount: {
    label: 'Amount',
    meaning: 'The monetary value associated with this event in the currency\'s integer minor unit.',
    docNote: 'OpenAI requires monetary amounts as integers in minor currency units (e.g. cents, pence, fils).'
  },
  currency: {
    label: 'Currency',
    meaning: 'Tells OpenAI how to interpret the amount (ISO 4217 currency code).',
    docNote: 'Required whenever amount is sent.'
  },
  source_url: {
    label: 'Source URL',
    meaning: 'The exact webpage address where this event occurred.',
    docNote: 'Automatically captured by the OpenAI web SDK for context and conversion URL attribution.'
  },
  referrer_url: {
    label: 'Referrer URL',
    meaning: 'The previous or referring page the visitor navigated from before triggering this event.',
    docNote: 'Enables OpenAI to construct the user journey path leading to the action.'
  },
  event_id: {
    label: 'Event Deduplication ID',
    meaning: 'Advertiser-supplied identifier used to deduplicate identical conversions sent via both browser Pixel and Conversions API.',
    docNote: 'Deduplication uses Pixel ID + Event Name + event_id.'
  },
  id: {
    label: 'Transport Event ID',
    meaning: 'Unique UUID identifier assigned to this individual event object by the browser SDK.',
    docNote: 'Internal observed identifier in the transport batch.'
  },
  opt_out: {
    label: 'Event Opt-Out Flag',
    meaning: 'Specifies whether this specific event is opted out of future user-level personalization.',
    docNote: 'opt_out=false indicates the event is not opted out of personalization. It does not prove complete CMP consent.'
  },
  obref: {
    label: 'Internal Browser Reference (obref)',
    meaning: 'Internal OpenAI browser/request reference (UUID-like identifier).',
    docNote: 'Generated internally by the OpenAI SDK per request batch. Not to be confused with oppref or event_id.'
  },
  oppref: {
    label: 'OpenAI Click Reference (oppref)',
    meaning: 'OpenAI ad-click identifier passed in the landing URL parameter for conversion attribution.',
    docNote: 'Documented 30-day attribution token stored in the __oppref first-party cookie.'
  },
  pid: {
    label: 'Pixel ID (pid)',
    meaning: 'Identifies the specific OpenAI Ads pixel / data source receiving this event.',
    docNote: 'Found in the query string (pid=) and matches the advertiser account.'
  },
  st: {
    label: 'SDK Transport Type (st)',
    meaning: 'Identifies the web SDK or transport protocol (e.g. oaiq-web).',
    docNote: 'Standard query parameter sent by official web SDK.'
  },
  sv: {
    label: 'SDK Version (sv)',
    meaning: 'The version of the OpenAI web SDK running in the visitor browser (e.g. 0.1.41).',
    docNote: 'Helps diagnose feature support and library versioning.'
  },
  t: {
    label: 'Request Timestamp (t)',
    meaning: 'The Unix epoch timestamp in milliseconds when the browser dispatched the HTTP POST batch.',
    docNote: 'Compared against event timestamps to calculate network batching delay.'
  },
  ec: {
    label: 'Event Count (ec)',
    meaning: 'The total number of individual event objects batched inside this network request.',
    docNote: 'Should strictly match the length of the events[] array.'
  },
  contents: {
    label: 'Contents Array',
    meaning: 'List of specific products or content items involved in the user action.',
    docNote: 'Supports id, name, content_type, quantity, amount, and currency in the browser JS Pixel.'
  },
  eid: {
    label: 'External Identity Signal (eid)',
    meaning: 'Hashed or pseudonymous identity matching signal for advertising attribution.',
    docNote: 'Enables OpenAI to match conversions to ad clicks without exposing raw customer details.'
  },
  automatic_advanced_matching: {
    label: 'Automatic Advanced Matching',
    meaning: 'SDK configuration indicating whether browser-side automatic hashing and normalization is active.',
    docNote: 'Reported in oai::diagnostic events under config.automatic_advanced_matching.'
  }
};

export function getFieldExplanation(fieldName) {
  if (!fieldName) return null;
  const clean = fieldName.toLowerCase().trim();
  return FIELD_EXPLANATIONS[clean] || {
    label: fieldName,
    meaning: 'Observed technical parameter in the OpenAI network request payload.',
    docNote: 'Preserved exactly as captured from the browser network stream.'
  };
}
