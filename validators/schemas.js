/**
 * OpenAI Ads Pixel Inspector - Schema Registry
 * 
 * Defines official and ecosystem standard event schemas for the OpenAI Ads Pixel (oaiq).
 * Source: Official OpenAI Ads Measurement Documentation & Ecosystem Standards.
 * Verified: 2026
 */

export const STANDARD_EVENT_NAMES = [
  'page_viewed',
  'PageView',
  'order_created',
  'lead_created',
  'contents_viewed',
  'subscription_created',
  'add_to_cart',
  'AddToCart',
  'checkout_started',
  'BeginCheckout'
];

export const ISO_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN',
  'CHF', 'SEK', 'NOK', 'DKK', 'NZD', 'SGD', 'HKD', 'KRW', 'PLN', 'ZAR',
  'AED', 'SAR', 'TRY', 'ILS', 'THB', 'PHP', 'MYR', 'IDR', 'CZK', 'HUF'
]);

export const EVENT_SCHEMAS = {
  // Page View
  'page_viewed': {
    description: 'Tracks when a user views a page on the website.',
    category: 'traffic',
    required: [],
    optional: ['page_path', 'page_title', 'event_id', 'url'],
    parameters: {
      page_path: { type: 'string' },
      page_title: { type: 'string' },
      event_id: { type: 'string', minLength: 1 },
      url: { type: 'string', format: 'url' }
    }
  },
  'PageView': {
    aliasOf: 'page_viewed',
    description: 'Alias for page_viewed.',
    category: 'traffic',
    required: [],
    optional: ['page_path', 'page_title', 'event_id', 'url'],
    parameters: {
      page_path: { type: 'string' },
      page_title: { type: 'string' },
      event_id: { type: 'string', minLength: 1 },
      url: { type: 'string', format: 'url' }
    }
  },

  // E-commerce Order Created (Purchase)
  'order_created': {
    description: 'Fired when a user successfully completes a purchase/order.',
    category: 'conversion',
    required: ['amount', 'currency'],
    optional: ['type', 'event_id', 'contents', 'order_id', 'content_ids', 'item_count'],
    parameters: {
      amount: { 
        type: 'number', 
        min: 0,
        minorUnitsRecommended: true,
        description: 'Transaction value in minor currency units (e.g., 2599 for $25.99) or valid positive number.'
      },
      currency: { 
        type: 'string', 
        format: 'currency',
        description: 'Three-letter ISO 4217 currency code (e.g. "USD").'
      },
      type: { 
        type: 'string',
        enum: ['contents', 'order', 'purchase'],
        recommended: 'contents'
      },
      event_id: { 
        type: 'string', 
        minLength: 1,
        description: 'Unique deduplication ID matching the server-side Conversions API (CAPI) event ID.'
      },
      order_id: { type: 'string' },
      contents: { type: 'array' },
      content_ids: { type: 'array' },
      item_count: { type: 'number', min: 1 }
    }
  },

  // Lead Created
  'lead_created': {
    description: 'Fired when a user submits a lead form or signs up for information.',
    category: 'conversion',
    required: [],
    optional: ['type', 'event_id', 'value', 'currency', 'lead_type'],
    parameters: {
      type: { 
        type: 'string',
        enum: ['customer_action', 'lead', 'form'],
        recommended: 'customer_action'
      },
      event_id: { 
        type: 'string', 
        minLength: 1,
        description: 'Unique deduplication ID matching server-side Conversions API.'
      },
      value: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      lead_type: { type: 'string' }
    }
  },

  // View Content / Catalog
  'contents_viewed': {
    description: 'Fired when a user views a specific product, service, or article.',
    category: 'engagement',
    required: [],
    optional: ['type', 'content_ids', 'content_name', 'content_type', 'value', 'currency', 'event_id'],
    parameters: {
      type: { type: 'string' },
      content_ids: { type: 'array' },
      content_name: { type: 'string' },
      content_type: { type: 'string' },
      value: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      event_id: { type: 'string', minLength: 1 }
    }
  },

  // Subscription Created
  'subscription_created': {
    description: 'Fired when a user starts a recurring subscription or membership.',
    category: 'conversion',
    required: ['amount', 'currency'],
    optional: ['subscription_id', 'interval', 'plan_name', 'event_id'],
    parameters: {
      amount: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      subscription_id: { type: 'string' },
      interval: { type: 'string', enum: ['day', 'week', 'month', 'year'] },
      plan_name: { type: 'string' },
      event_id: { type: 'string', minLength: 1 }
    }
  },

  // Add to Cart
  'add_to_cart': {
    description: 'Fired when a user adds items to a shopping cart.',
    category: 'conversion',
    required: [],
    optional: ['amount', 'currency', 'contents', 'content_ids', 'quantity', 'event_id'],
    parameters: {
      amount: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array' },
      content_ids: { type: 'array' },
      quantity: { type: 'number', min: 1 },
      event_id: { type: 'string', minLength: 1 }
    }
  },
  'AddToCart': {
    aliasOf: 'add_to_cart',
    description: 'Alias for add_to_cart.',
    category: 'conversion',
    required: [],
    optional: ['amount', 'currency', 'contents', 'content_ids', 'quantity', 'event_id'],
    parameters: {
      amount: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array' },
      content_ids: { type: 'array' },
      quantity: { type: 'number', min: 1 },
      event_id: { type: 'string', minLength: 1 }
    }
  },

  // Checkout Started
  'checkout_started': {
    description: 'Fired when a user begins the checkout flow.',
    category: 'conversion',
    required: [],
    optional: ['amount', 'currency', 'contents', 'item_count', 'event_id'],
    parameters: {
      amount: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array' },
      item_count: { type: 'number', min: 1 },
      event_id: { type: 'string', minLength: 1 }
    }
  },
  'BeginCheckout': {
    aliasOf: 'checkout_started',
    description: 'Alias for checkout_started.',
    category: 'conversion',
    required: [],
    optional: ['amount', 'currency', 'contents', 'item_count', 'event_id'],
    parameters: {
      amount: { type: 'number', min: 0 },
      currency: { type: 'string', format: 'currency' },
      contents: { type: 'array' },
      item_count: { type: 'number', min: 1 },
      event_id: { type: 'string', minLength: 1 }
    }
  }
};

/**
 * Generic Custom Event Validation Rule
 */
export const CUSTOM_EVENT_RULES = {
  maxNameLength: 64,
  validNamePattern: /^[a-zA-Z0-9_\-\.]+$/,
  reservedWords: ['init', 'consent', 'config', 'set', 'get']
};
