/**
 * OpenAI Ads Pixel Inspector - Built-in Parameter & Event Knowledge Dictionary
 * 
 * Comprehensive knowledge base documenting official & inferred OpenAI Ads parameters,
 * event definitions, color coding, data shapes, and plain-English developer explanations.
 * 
 * Intentionally distinguishes between officially documented fields and fields inferred from observed traffic.
 */

// =========================================================================
// 1. Event Type Knowledge System & Color Coding
// =========================================================================

export const EVENT_DICTIONARY = {
  'page_viewed': {
    name: 'page_viewed',
    label: 'Page Viewed',
    color: '#10b981', // green
    colorName: 'green',
    official: true,
    dataShape: 'contents',
    category: 'traffic',
    description: 'Tracks when a visitor lands on or navigates to a web page. Foundation event for audience retargeting and traffic analytics.',
    triggerMoment: 'Triggered automatically or on every route change in single-page apps (SPA).'
  },
  'contents_viewed': {
    name: 'contents_viewed',
    label: 'Contents Viewed',
    color: '#14b8a6', // teal
    colorName: 'teal',
    official: true,
    dataShape: 'contents',
    category: 'engagement',
    description: 'Tracks product detail page views, article views, or key content interactions with item catalog metadata.',
    triggerMoment: 'Triggered when a user views a specific product, item, or piece of content.'
  },
  'items_added': {
    name: 'items_added',
    label: 'Items Added (Add To Cart)',
    color: '#06b6d4', // cyan
    colorName: 'cyan',
    official: true,
    dataShape: 'contents',
    category: 'conversion',
    description: 'Tracks when a user adds one or more items or products to their shopping basket or cart.',
    triggerMoment: 'Triggered upon clicking "Add to Cart" or adding items to a basket.'
  },
  'checkout_started': {
    name: 'checkout_started',
    label: 'Checkout Started',
    color: '#6366f1', // indigo
    colorName: 'indigo',
    official: true,
    dataShape: 'contents',
    category: 'conversion',
    description: 'Tracks when a user enters the checkout funnel or begins the payment/order placement flow.',
    triggerMoment: 'Triggered on the first checkout step or clicking "Proceed to Checkout".'
  },
  'order_created': {
    name: 'order_created',
    label: 'Order Created (Purchase)',
    color: '#3b82f6', // blue
    colorName: 'blue',
    official: true,
    dataShape: 'contents',
    category: 'conversion',
    description: 'Tracks completed purchases, order confirmations, and revenue transactions with itemized contents.',
    triggerMoment: 'Triggered on order confirmation, thank you, or invoice receipt pages.'
  },
  'lead_created': {
    name: 'lead_created',
    label: 'Lead Created',
    color: '#f97316', // orange
    colorName: 'orange',
    official: true,
    dataShape: 'customer_action',
    category: 'conversion',
    description: 'Tracks submission of interest forms, quote requests, demo bookings, or contact inquiries.',
    triggerMoment: 'Triggered upon successful contact or quote form submission.'
  },
  'registration_completed': {
    name: 'registration_completed',
    label: 'Registration Completed',
    color: '#059669', // emerald
    colorName: 'emerald',
    official: true,
    dataShape: 'customer_action',
    category: 'conversion',
    description: 'Tracks user account sign-ups, profile creations, and member onboarding registrations.',
    triggerMoment: 'Triggered after user successfully creates an account or verifies profile.'
  },
  'appointment_scheduled': {
    name: 'appointment_scheduled',
    label: 'Appointment Scheduled',
    color: '#f43f5e', // rose
    colorName: 'rose',
    official: true,
    dataShape: 'customer_action',
    category: 'conversion',
    description: 'Tracks confirmed appointments, meetings, consultation bookings, or reservation times.',
    triggerMoment: 'Triggered after booking confirmation in a calendar or scheduling widget.'
  },
  'subscription_created': {
    name: 'subscription_created',
    label: 'Subscription Created',
    color: '#a855f7', // purple
    colorName: 'purple',
    official: true,
    dataShape: 'plan_enrollment',
    category: 'conversion',
    description: 'Tracks activation of recurring paid subscriptions, membership tiers, or SaaS recurring billing.',
    triggerMoment: 'Triggered when a recurring billing plan is authorized or subscribed.'
  },
  'trial_started': {
    name: 'trial_started',
    label: 'Trial Started',
    color: '#d946ef', // fuchsia
    colorName: 'fuchsia',
    official: true,
    dataShape: 'plan_enrollment',
    category: 'conversion',
    description: 'Tracks start of free trials, sample periods, or no-cost evaluation access without immediate billing.',
    triggerMoment: 'Triggered when a user begins a time-limited free trial.'
  },
  'custom': {
    name: 'custom',
    label: 'Custom Event',
    color: '#8b5cf6', // violet
    colorName: 'violet',
    official: true,
    dataShape: 'custom',
    category: 'custom',
    description: 'Tracks custom brand-specific conversions (e.g. video_play, calculator_used, file_downloaded) specified via custom_event_name.',
    triggerMoment: 'Triggered on specific user interactions defined by custom business requirements.'
  },
  'openai::sdk_init': {
    name: 'openai::sdk_init',
    label: 'SDK Initialization',
    color: '#eab308', // amber
    colorName: 'amber',
    official: false, // Inferred from traffic
    dataShape: 'sdk_lifecycle',
    category: 'sdk',
    description: 'Internal SDK bootstrap and lifecycle signal dispatched when the OpenAI Ads client-side script initializes.',
    triggerMoment: 'Dispatched automatically by oaiq.js on page load.'
  },
  'oai::diagnostic': {
    name: 'oai::diagnostic',
    label: 'SDK Diagnostic / Health',
    color: '#f59e0b', // amber
    colorName: 'amber',
    official: false, // Inferred from traffic
    dataShape: 'diagnostic',
    category: 'diagnostic',
    description: 'Telemetry and health diagnostic event containing dropped event counters, schema versions, and matching configuration status.',
    triggerMoment: 'Dispatched by the OpenAI SDK alongside event batches for pipeline reliability.'
  }
};

export const DEFAULT_EVENT_INFO = {
  name: 'unknown',
  label: 'Unknown Event',
  color: '#6b7280', // gray
  colorName: 'gray',
  official: false,
  dataShape: 'custom',
  category: 'unknown',
  description: 'Unrecognized event name. May be a typo or custom naming without proper custom event configuration.',
  triggerMoment: 'Observed in browser execution or network traffic.'
};

export function getEventInfo(eventName) {
  if (!eventName) return DEFAULT_EVENT_INFO;
  const clean = eventName.trim();
  if (EVENT_DICTIONARY[clean]) return EVENT_DICTIONARY[clean];

  // Check alias or lowercase match
  const lower = clean.toLowerCase();
  for (const [k, v] of Object.entries(EVENT_DICTIONARY)) {
    if (k.toLowerCase() === lower) return v;
  }

  if (lower.startsWith('openai::') || lower.startsWith('oai::')) {
    return {
      name: clean,
      label: clean,
      color: '#f59e0b',
      colorName: 'amber',
      official: false,
      dataShape: 'diagnostic',
      category: 'sdk',
      description: 'Internal OpenAI Ads SDK diagnostic or telemetry signal.',
      triggerMoment: 'Dispatched by the client-side SDK runtime.'
    };
  }

  return {
    ...DEFAULT_EVENT_INFO,
    name: clean,
    label: clean
  };
}

// =========================================================================
// 2. Built-in Parameter Dictionary & Knowledge Base
// =========================================================================

export const PARAMETER_DICTIONARY = {
  // --- QUERY PARAMETERS (URL) ---
  'query.pid': {
    key: 'query.pid',
    name: 'Pixel ID',
    category: 'QUERY',
    official: true,
    type: 'string',
    description: 'The unique OpenAI Ads Pixel identifier assigned to your advertising account.',
    details: 'Specified in URL query string (pid=...) to route event data to the correct ad campaign.'
  },
  'pid': {
    key: 'pid',
    name: 'Pixel ID',
    category: 'QUERY',
    official: true,
    type: 'string',
    description: 'The unique OpenAI Ads Pixel identifier assigned to your advertising account.',
    details: 'Primary identifier for ingestion routing.'
  },
  'query.st': {
    key: 'query.st',
    name: 'SDK Type',
    category: 'QUERY',
    official: false, // Inferred from observed network traffic
    type: 'string',
    description: 'SDK runtime flavor (e.g. "oaiq-web" for standard web browser pixel).',
    details: 'Inferred from network ingestion endpoints to categorize client platform.'
  },
  'st': {
    key: 'st',
    name: 'SDK Type',
    category: 'QUERY',
    official: false,
    type: 'string',
    description: 'SDK runtime flavor (e.g. "oaiq-web").'
  },
  'query.sv': {
    key: 'query.sv',
    name: 'SDK Version',
    category: 'QUERY',
    official: false, // Inferred from observed network traffic
    type: 'string',
    description: 'Semantic version of the downloaded OpenAI pixel script (e.g. "0.1.41").',
    details: 'Used for backward compatibility and debugging client-side script builds.'
  },
  'sv': {
    key: 'sv',
    name: 'SDK Version',
    category: 'QUERY',
    official: false,
    type: 'string',
    description: 'Semantic version of the downloaded OpenAI pixel script (e.g. "0.1.41").'
  },
  'query.t': {
    key: 'query.t',
    name: 'Request Timestamp (Epoch MS)',
    category: 'QUERY',
    official: false, // Inferred from observed network traffic
    type: 'integer',
    description: 'Unix epoch timestamp in milliseconds when the HTTP request was dispatched by the browser.',
    details: 'Allows server-side deduplication and latency measurement.'
  },
  't': {
    key: 't',
    name: 'Request Timestamp',
    category: 'QUERY',
    official: false,
    type: 'integer',
    description: 'Unix epoch timestamp in milliseconds when the request was dispatched.'
  },
  'query.ec': {
    key: 'query.ec',
    name: 'Event Count',
    category: 'QUERY',
    official: false, // Inferred from observed network traffic
    type: 'integer',
    description: 'Number of individual events bundled inside this batch POST payload.',
    details: 'Validates that the server received the exact number of events sent in the batch.'
  },
  'ec': {
    key: 'ec',
    name: 'Event Count',
    category: 'QUERY',
    official: false,
    type: 'integer',
    description: 'Number of individual events bundled in this batch POST payload.'
  },

  // --- BATCH & ATTRIBUTION PARAMETERS ---
  'batch.obref': {
    key: 'batch.obref',
    name: 'Browser Reference (obref)',
    category: 'BATCH',
    official: false, // Inferred from observed network traffic & cookies
    type: 'string',
    description: 'Browser device reference token stored in __obref cookie and sent in batch payload.',
    details: 'Generated by the OpenAI pixel to identify the client browser across page navigations.'
  },
  'obref': {
    key: 'obref',
    name: 'Browser Reference (obref)',
    category: 'BATCH',
    official: false,
    type: 'string',
    description: 'Value from __obref cookie / request payload representing the persistent browser instance.',
    details: 'Distinct from oppref: obref tracks the browser instance, while oppref tracks ad-click attribution.'
  },
  '__obref': {
    key: '__obref',
    name: 'Browser Reference Cookie (__obref)',
    category: 'BATCH',
    official: false,
    type: 'string',
    description: 'First-party cookie created by the OpenAI pixel to persist the browser reference across sessions.',
    details: 'Stored in document.cookie as __obref.'
  },
  'oppref': {
    key: 'oppref',
    name: 'Ad-Click Attribution Token (oppref)',
    category: 'ATTRIBUTION',
    official: true,
    type: 'string',
    description: 'Ad-click attribution identifier passed in the URL query string when a visitor arrives via OpenAI Ads.',
    details: 'Format: ?oppref=<UUID>. Captured from URL and stored in __oppref cookie for conversion attribution.'
  },
  '__oppref': {
    key: '__oppref',
    name: 'Persistent Attribution Cookie (__oppref)',
    category: 'ATTRIBUTION',
    official: true,
    type: 'string',
    description: 'First-party cookie created by the OpenAI pixel to store and persist the oppref ad-click attribution token.',
    details: 'Enables multi-page and delayed conversion attribution for up to 30 days.'
  },

  // --- EVENT ENVELOPE PARAMETERS ---
  'type': {
    key: 'type',
    name: 'Event Type / Name',
    category: 'EVENT',
    official: true,
    type: 'string',
    description: 'The canonical identifier of the triggered action (e.g. "order_created", "page_viewed").',
    details: 'Dictates the required payload shape and validation schema.'
  },
  'id': {
    key: 'id',
    name: 'Network Event ID',
    category: 'EVENT',
    official: false, // Inferred from network payload
    type: 'string',
    description: 'Unique UUID assigned to this specific event instance in the network payload envelope.',
    details: 'Enables individual event tracking and server confirmation.'
  },
  'event_id': {
    key: 'event_id',
    name: 'Deduplication Event ID',
    category: 'EVENT',
    official: true,
    type: 'string',
    description: 'Unique business identifier passed in options to deduplicate browser pixel and server Conversions API events.',
    details: 'Send identical event_id from both Web Pixel and Conversions API (CAPI) to prevent double counting.'
  },
  'timestamp_ms': {
    key: 'timestamp_ms',
    name: 'Event Timestamp (MS)',
    category: 'EVENT',
    official: false, // Inferred from network payload
    type: 'integer',
    description: 'Unix timestamp in milliseconds when the event was recorded by the client script.',
    details: 'Must be within 7 days of server receipt for conversion attribution.'
  },
  'source_url': {
    key: 'source_url',
    name: 'Source URL',
    category: 'EVENT',
    official: false, // Inferred from network payload
    type: 'string',
    description: 'The exact document URL where the event was triggered.',
    details: 'Used for URL path verification, URL-rule triggers, and conversion path analysis.'
  },
  'referrer_url': {
    key: 'referrer_url',
    name: 'Referrer URL',
    category: 'EVENT',
    official: false, // Inferred from network payload
    type: 'string',
    description: 'The referring URL that directed the user to the current page.',
    details: 'Provides traffic source context (search, ad, social, direct).'
  },
  'opt_out': {
    key: 'opt_out',
    name: 'Consent / Opt-Out Flag',
    category: 'EVENT',
    official: true,
    type: 'boolean',
    description: 'Privacy opt-out flag indicating whether data processing should be restricted.',
    details: 'When true, signals user preference to opt out of interest-based ad measurement.'
  },
  'custom_event_name': {
    key: 'custom_event_name',
    name: 'Custom Event Name',
    category: 'EVENT',
    official: true,
    type: 'string',
    description: 'Descriptive name for custom events (required when measuring event name "custom").',
    details: 'Must be 1–64 characters alphanumeric, underscores, or hyphens (e.g. "quote_requested").'
  },

  // --- DATA & COMMERCE PARAMETERS ---
  'data': {
    key: 'data',
    name: 'Event Data Payload',
    category: 'DATA',
    official: true,
    type: 'object',
    description: 'The core business parameter payload containing data shape, amounts, and content items.',
    details: 'Structured according to the event\'s data shape (contents, customer_action, or plan_enrollment).'
  },
  'data.type': {
    key: 'data.type',
    name: 'Data Shape Type',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'The structural contract for the payload: "contents", "customer_action", "plan_enrollment", or "custom".',
    details: 'Mandatory data shape defining which parameters are permitted on this event.'
  },
  'data.amount': {
    key: 'data.amount',
    name: 'Monetary Amount (Minor Units)',
    category: 'DATA',
    official: true,
    type: 'integer',
    description: 'Total monetary value of the event formatted as an integer in the smallest currency unit (e.g. cents).',
    details: 'For USD $25.99 send 2599. Never send float/decimal values. Zero-decimal currencies (JPY/KRW) send exact units.'
  },
  'data.currency': {
    key: 'data.currency',
    name: 'Currency Code (ISO 4217)',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'Standard 3-letter uppercase ISO 4217 currency code (e.g. "USD", "EUR", "GBP", "JPY").',
    details: 'Strictly required whenever amount is provided to compute revenue conversions accurately.'
  },
  'data.plan_id': {
    key: 'data.plan_id',
    name: 'Subscription / Plan ID',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'Unique internal identifier for the subscription tier, membership plan, or trial offering.',
    details: 'Used with subscription_created and trial_started events (dataShape: plan_enrollment).'
  },
  'data.contents': {
    key: 'data.contents',
    name: 'Content Items Array',
    category: 'DATA',
    official: true,
    type: 'array',
    description: 'Array of item/product objects detailing items viewed, added to cart, or purchased.',
    details: 'Each item can contain id, name, content_type, quantity, amount, and currency.'
  },
  'data.contents.id': {
    key: 'data.contents.id',
    name: 'Item Identifier (SKU / Product ID)',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'Unique product SKU, catalog item ID, or content identifier.',
    details: 'Links conversions to your product catalog for dynamic retargeting.'
  },
  'data.contents.name': {
    key: 'data.contents.name',
    name: 'Item Name',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'Human-readable title or product name displayed in conversion reporting.',
    details: 'e.g. "Wireless Noise-Canceling Headphones".'
  },
  'data.contents.content_type': {
    key: 'data.contents.content_type',
    name: 'Content Category Type',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'Classification of the item: "product", "plan", "service", "page", or "category".',
    details: 'Provides catalog context for advertising optimization.'
  },
  'data.contents.quantity': {
    key: 'data.contents.quantity',
    name: 'Item Quantity',
    category: 'DATA',
    official: true,
    type: 'integer',
    description: 'Number of units of this item included in the transaction (must be an integer >= 1).',
    details: 'Used to calculate basket totals and conversion volume.'
  },
  'data.contents.amount': {
    key: 'data.contents.amount',
    name: 'Item Unit Price / Amount (Minor Units)',
    category: 'DATA',
    official: true,
    type: 'integer',
    description: 'Price per unit in minor currency units (e.g. 1999 for $19.99).',
    details: 'Should match the currency specified on the event or item.'
  },
  'data.contents.currency': {
    key: 'data.contents.currency',
    name: 'Item Currency Code',
    category: 'DATA',
    official: true,
    type: 'string',
    description: 'ISO 4217 3-letter currency code for this specific item if multi-currency.',
    details: 'Defaults to the root event currency if omitted.'
  },

  // --- USER DATA & ADVANCED MATCHING ---
  'email_sha256': {
    key: 'email_sha256',
    name: 'Hashed Email (SHA-256)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Normalized, lowercase email address hashed using SHA-256 for secure customer matching.',
    details: 'Never send raw unhashed email addresses in client-side pixel calls.'
  },
  'phone_number_sha256': {
    key: 'phone_number_sha256',
    name: 'Hashed Phone Number (SHA-256)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'E.164 normalized phone number (with country code) hashed using SHA-256.',
    details: 'e.g. SHA-256(+15551234567). Protects user privacy while enabling ad attribution.'
  },
  'external_id_sha256': {
    key: 'external_id_sha256',
    name: 'Hashed External User ID (SHA-256)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Internal CRM / database customer identifier hashed using SHA-256.',
    details: 'Enables cross-device matching across web and server events.'
  },
  'first_name_sha256': {
    key: 'first_name_sha256',
    name: 'Hashed First Name (SHA-256)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Normalized, lowercase first name hashed using SHA-256.',
    details: 'Used for advanced demographic customer matching.'
  },
  'last_name_sha256': {
    key: 'last_name_sha256',
    name: 'Hashed Last Name (SHA-256)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Normalized, lowercase surname/family name hashed using SHA-256.',
    details: 'Used alongside first name and email for matching.'
  },
  'country': {
    key: 'country',
    name: 'Country Code (ISO 3166-1 alpha-2)',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Two-letter country code in lowercase (e.g. "us", "gb", "de", "bd").',
    details: 'Unhashed 2-letter geographical region indicator.'
  },
  'city': {
    key: 'city',
    name: 'City Name',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Customer city name in lowercase with spaces and punctuation removed.',
    details: 'e.g. "sanfrancisco", "berlin", "dhaka".'
  },
  'region': {
    key: 'region',
    name: 'Region / State Code',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'Two-letter state or province code (e.g. "ca", "ny", "by").',
    details: 'Standard sub-national geographical indicator.'
  },
  'postal_code': {
    key: 'postal_code',
    name: 'Postal / ZIP Code',
    category: 'USER',
    official: true,
    type: 'string',
    description: 'ZIP or Postal Code for customer location matching.',
    details: 'e.g. "94103", "10115", "3500".'
  }
};

export const DEFAULT_PARAM_INFO = {
  key: '',
  name: 'Custom Parameter',
  category: 'DATA',
  official: false,
  type: 'any',
  description: 'Custom or contextual tracking parameter passed in this event.',
  details: 'User-defined parameter.'
};

/**
 * Dynamically resolves parameter metadata and plain-English documentation
 */
export function getParameterInfo(paramKey, categoryHint = 'DATA') {
  if (!paramKey) return DEFAULT_PARAM_INFO;
  const clean = paramKey.trim();

  // Direct lookup
  if (PARAMETER_DICTIONARY[clean]) return PARAMETER_DICTIONARY[clean];

  // Lookup without prefixes (e.g. query.pid -> pid or data.amount -> amount)
  const stripped = clean.replace(/^(query|batch|data|event)\./, '');
  if (PARAMETER_DICTIONARY[clean]) return PARAMETER_DICTIONARY[clean];
  if (PARAMETER_DICTIONARY[stripped]) return PARAMETER_DICTIONARY[stripped];

  // Dynamic prefix handling
  if (clean.startsWith('query.')) {
    return {
      key: clean,
      name: `Query Parameter (${stripped})`,
      category: 'QUERY',
      official: false,
      type: 'string',
      description: `URL query parameter "${stripped}" passed to OpenAI Ads ingestion endpoint.`,
      details: 'Inferred from network request URL.'
    };
  }

  if (clean.startsWith('batch.')) {
    return {
      key: clean,
      name: `Batch Parameter (${stripped})`,
      category: 'BATCH',
      official: false,
      type: 'string',
      description: `Top-level batch envelope parameter "${stripped}".`,
      details: 'Inferred from network batch payload.'
    };
  }

  if (clean.startsWith('data.')) {
    return {
      key: clean,
      name: `Payload Parameter (${stripped})`,
      category: 'DATA',
      official: false,
      type: 'any',
      description: `Contextual conversion or product parameter "${stripped}" associated with this event.`,
      details: 'Custom business property.'
    };
  }

  return {
    ...DEFAULT_PARAM_INFO,
    key: clean,
    name: clean,
    category: categoryHint
  };
}

// =========================================================================
// 3. Attribution Knowledge Base
// =========================================================================

export const ATTRIBUTION_DICTIONARY = {
  'oppref': {
    name: 'oppref',
    label: 'Ad-Click Attribution Token (oppref)',
    location: 'URL query parameter (?oppref=...)',
    purpose: 'Ad-click attribution and campaign conversion attribution.',
    persistence: 'Transient (passed on initial landing page URL from ChatGPT / OpenAI Ads ad click).',
    official: true,
    description: 'The active attribution identifier generated when a user clicks on an ad in ChatGPT or OpenAI network. The pixel reads this parameter and saves it to a persistent cookie.'
  },
  '__oppref': {
    name: '__oppref',
    label: 'First-Party Attribution Cookie (__oppref)',
    location: 'document.cookie (__oppref=...)',
    purpose: 'Persistent multi-page and delayed conversion attribution.',
    persistence: 'Persistent (typically 30-day first-party cookie written by oaiq.js).',
    official: true,
    description: 'First-party cookie created automatically by the OpenAI Pixel on the advertiser\'s domain to preserve the oppref across subsequent page navigations and purchase checkout sessions.'
  },
  'obref': {
    name: 'obref',
    label: 'Browser-Level Reference (obref)',
    location: 'Network Request Payload JSON ("obref": "...") & __obref cookie',
    purpose: 'Browser device reference token across sessions and batches.',
    persistence: 'Persistent across all event batches from the same browser instance.',
    official: false, // Inferred from observed network traffic
    description: 'Unique browser client identifier generated and maintained by the OpenAI Ads SDK to correlate multiple event batches from the same browser session.'
  },
  '__obref': {
    name: '__obref',
    label: 'Browser Reference Cookie (__obref)',
    location: 'document.cookie (__obref=...)',
    purpose: 'Stores the browser device reference on the client domain.',
    persistence: 'Persistent first-party cookie.',
    official: false,
    description: 'First-party cookie created by the OpenAI pixel to store the persistent browser reference token across browsing sessions.'
  }
};
