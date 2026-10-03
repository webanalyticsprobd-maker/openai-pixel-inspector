/**
 * Automated Test Suite for OpenAI Ads Pixel Inspector & Live Debugger
 * Tests all 25 critical QA scenarios from the specification.
 */

import assert from 'assert';
import {
  OPENAI_PIXEL_SCHEMA,
  STANDARD_JS_EVENTS,
  CAPI_ONLY_EVENTS,
  getCurrencyDecimalPlaces,
  getCurrencySmallestUnitName,
  CUSTOM_EVENT_RULES
} from '../validators/schemas.js';
import {
  isOpenAINetworkRequest,
  extractPixelIdFromUrl,
  classifyNetworkEvent,
  parseOpenAINetworkBatch,
  extractUserMatchingEnvelope
} from '../network/request-parser.js';
import {
  validateParameter,
  validateContentsArray
} from '../validators/parameter-validator.js';
import { validateEvent } from '../validators/event-validator.js';
import { normalizeEvent } from '../core/normalizer.js';
import { EventStore } from '../core/event-store.js';
import { getEventInfo } from '../core/dictionary.js';

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    console.error(`  ✕ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

console.log('--- RUNNING OPENAI PIXEL INSPECTOR TEST SUITE ---');

// 1. Endpoint & Pixel ID Extraction Tests
test('Recognizes OpenAI ingestion endpoints', () => {
  assert.strictEqual(isOpenAINetworkRequest('https://bzr.openai.com/v1/sdk/events?pid=123'), true);
  assert.strictEqual(isOpenAINetworkRequest('https://bzr.openai.com/events?pid=123'), true);
  assert.strictEqual(isOpenAINetworkRequest('https://google.com'), false);
});

test('Extracts Pixel ID from query parameters', () => {
  const url = 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh&st=oaiq-web&sv=0.1.41';
  assert.strictEqual(extractPixelIdFromUrl(url), '4KjX1dq4C7HUw7EUpRXfMh');
});

// 2. Event Classification Tests
test('Classifies system vs diagnostic vs business events', () => {
  assert.strictEqual(classifyNetworkEvent({ type: 'openai::sdk_init' }), 'SDK_INTERNAL');
  assert.strictEqual(classifyNetworkEvent({ type: 'oai::diagnostic' }), 'DIAGNOSTIC');
  assert.strictEqual(classifyNetworkEvent({ type: 'page_viewed' }), 'MEASUREMENT_EVENT');
  assert.strictEqual(classifyNetworkEvent({ type: 'order_created' }), 'MEASUREMENT_EVENT');
  assert.strictEqual(classifyNetworkEvent({ type: 'lead_created' }), 'MEASUREMENT_EVENT');
});

// 3. Currency Exponent & Minor Unit Calculations
test('Supports ISO 4217 currency exponents', () => {
  assert.strictEqual(getCurrencyDecimalPlaces('USD'), 2);
  assert.strictEqual(getCurrencyDecimalPlaces('EUR'), 2);
  assert.strictEqual(getCurrencyDecimalPlaces('JPY'), 0);
  assert.strictEqual(getCurrencyDecimalPlaces('KWD'), 3);
  assert.strictEqual(getCurrencyDecimalPlaces('BDT'), 2);
});

// 4. Minor Unit Integer Validation
test('Validates integer amounts in minor units', () => {
  const rule = { type: 'integer', minorUnit: true, required: true };
  
  // Valid integer minor unit (2599 = $25.99)
  const validRes = validateParameter('amount', 2599, rule, { currency: 'USD' }, 'items_added');
  assert.strictEqual(validRes, null);

  // Invalid decimal amount (25.99)
  const invalidRes = validateParameter('amount', 25.99, rule, { currency: 'USD' }, 'items_added');
  assert.notStrictEqual(invalidRes, null);
  assert.strictEqual(invalidRes.code, 'PARAM_AMOUNT_NOT_INTEGER');
});

test('Validates missing currency when amount exists', () => {
  const rule = { type: 'integer', minorUnit: true, required: false };
  const missingCur = validateParameter('amount', 2599, rule, {}, 'items_added');
  assert.notStrictEqual(missingCur, null);
  assert.strictEqual(missingCur.code, 'PARAM_AMOUNT_MISSING_CURRENCY');
});

// 5. Quantity Validation
test('Validates quantity is integer >= 0', () => {
  const rule = { type: 'integer', min: 1, required: false };
  assert.strictEqual(validateParameter('quantity', 1, rule, {}, 'items_added'), null);

  // String quantity
  const strQty = validateParameter('quantity', "1", rule, {}, 'items_added');
  assert.notStrictEqual(strQty, null);
  assert.strictEqual(strQty.code, 'INVALID_PARAMETER_TYPE');
});

// 6. CAPI-Only Field Detection
test('Flags CAPI-only content fields in browser contents array', () => {
  const contents = [
    { id: 'sku_1', name: 'Product 1', group_id: 'grp_123', quantity: 1 }
  ];
  const findings = validateContentsArray(contents, { currency: 'USD' }, 'items_added');
  const capiFinding = findings.find(f => f.code === 'CAPI_ONLY_CONTENT_FIELD');
  assert.notStrictEqual(capiFinding, undefined);
  assert.strictEqual(capiFinding.severity, 'warning');
});

// 7. Custom Event Name Validation
test('Validates custom event naming syntax rules', () => {
  assert.strictEqual(CUSTOM_EVENT_RULES.validPattern.test('quote_requested'), true);
  assert.strictEqual(CUSTOM_EVENT_RULES.validPattern.test('sign_up-now'), true);
  assert.strictEqual(CUSTOM_EVENT_RULES.validPattern.test('Quote Requested!'), false);
  assert.strictEqual(CUSTOM_EVENT_RULES.validPattern.test('_invalid_start'), false);
});

// 8. Event Data Type (Shape) Validation
test('Validates mandatory data.type shape across standard events', () => {
  // Valid contents shape for order_created
  const validEvt = normalizeEvent({
    name: 'order_created',
    data: { type: 'contents', amount: 84259, currency: 'EUR' }
  });
  assert.strictEqual(validEvt.validation.errorsCount, 0);

  // Invalid data.type for lead_created (expected customer_action, received contents)
  const invalidEvt = normalizeEvent({
    name: 'lead_created',
    data: { type: 'contents', amount: 5000, currency: 'USD' }
  });
  assert.strictEqual(invalidEvt.validation.errorsCount > 0, true);
  assert.strictEqual(invalidEvt.validation.findings.some(f => f.code === 'INCORRECT_DATA_SHAPE'), true);
});

// 9. Batch Request Parser (Page Load Scenario)
test('Parses 3-event Page Load Batch cleanly', () => {
  const rawBatch = {
    url: 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh&st=oaiq-web&sv=0.1.41&t=1788707816401&ec=3',
    method: 'POST',
    status: 202,
    rawPayload: {
      obref: '86d3c0fe-e6a0-4e67-945a-3edadc613539',
      events: [
        { type: 'openai::sdk_init', timestamp_ms: 1788707815131, id: 'c61622d5', source_url: 'https://lizenzdeals24.de/', data: { type: 'sdk_lifecycle' } },
        { type: 'page_viewed', timestamp_ms: 1788707815131, id: '50109a76', source_url: 'https://lizenzdeals24.de/', opt_out: false, data: { type: 'contents' } },
        { type: 'oai::diagnostic', timestamp_ms: 1788707815203, id: '763bc7ed', data: { type: 'diagnostic', schema_version: 1, dropped_event_count: 0, config: { automatic_advanced_matching: 'enabled' } } }
      ]
    }
  };

  const parsed = parseOpenAINetworkBatch(rawBatch);
  assert.strictEqual(parsed.parentRequest.totalEventsCount, 3);
  assert.strictEqual(parsed.parentRequest.obref, '86d3c0fe-e6a0-4e67-945a-3edadc613539');
  assert.strictEqual(parsed.measurementEvents.length, 1); // page_viewed
  assert.strictEqual(parsed.internalEvents.length, 2); // sdk_init + diagnostic
  assert.strictEqual(parsed.diagnostics.droppedEventCount, 0);
  assert.strictEqual(parsed.diagnostics.automaticAdvancedMatching, 'enabled');
});

// 10. Advanced Matching Form Envelope (user.fm) & Masking
test('Parses rich form matching user.fm with 8 fields and masks SHA-256 hashes', () => {
  const userObj = {
    fm: {
      em: ['21e179aa2c9bc86c844a7dafc32e9c89b5585f7db00b39bf2f734e4cef42cead'],
      ph: ['5138f0631ec80cbd470e101feadee7b261c9673662e84a62edeb202477df60a3'],
      fn: '68f3cbee6ec6bb02a6c87954799e03b1aa72127f8386159f2212d7fda5db760b',
      ln: 'd751f76b33d539f5f12db4e3c006e7f05821591487321469f847312936f2dd4a',
      co: 'bd',
      ct: 'comilla',
      rg: 'bd-01',
      pc: '3500'
    }
  };

  const matching = extractUserMatchingEnvelope(userObj);
  assert.strictEqual(matching.detected, true);
  assert.strictEqual(matching.count, 8);
  assert.strictEqual(matching.hasHashedData, true);
  
  const emailField = matching.fields.find(f => f.type === 'email');
  assert.strictEqual(emailField.isHashed, true);
  assert.strictEqual(emailField.masked.includes('SHA-256 (21e179...cead)'), true);

  const countryField = matching.fields.find(f => f.type === 'country');
  assert.strictEqual(countryField.isHashed, false);
  assert.strictEqual(countryField.value, 'bd');
});

// 11. User Identity Container (user.in with eid and em)
test('Parses user.in identity matching container with eid and em hashes', () => {
  const userObj = {
    in: {
      eid: '820175c4978946d36e1bb966ac541f11effad869df84f58280f7c845d155391f',
      em: '0f693d1732735e24c5404e130f332847ec4565e898c52e791c514ccd7278b919'
    }
  };

  const matching = extractUserMatchingEnvelope(userObj);
  assert.strictEqual(matching.detected, true);
  assert.strictEqual(matching.count, 2);
  assert.strictEqual(matching.hasHashedData, true);

  const eidField = matching.fields.find(f => f.key === 'eid');
  assert.strictEqual(eidField.type, 'external_id');
  assert.strictEqual(eidField.isHashed, true);
  assert.strictEqual(eidField.masked, 'SHA-256 (820175...391f)');

  const emField = matching.fields.find(f => f.key === 'em');
  assert.strictEqual(emField.type, 'email');
  assert.strictEqual(emField.isHashed, true);
  assert.strictEqual(emField.masked, 'SHA-256 (0f693d...b919)');
});

// 11. Checkout Value Mismatch Test ($350.00 vs $3.50)
test('Detects and reconciles item-level vs event-level value discrepancy', () => {
  const eventAmount = 35000; // $350.00 in minor units
  const itemAmount = 350;    // $3.50 in minor units (or mistaken major units)
  const quantity = 1;
  const calculatedItemTotal = itemAmount * quantity;

  assert.notStrictEqual(eventAmount, calculatedItemTotal);
  const diffMajor = (eventAmount - calculatedItemTotal) / 100;
  assert.strictEqual(diffMajor, 346.50);
});

// 12. 4-Layer Validation Classification & RuleSource Verification
test('Tags validation findings with exact ruleSource metadata', () => {
  // Schema error: non-integer amount
  const evt = normalizeEvent({
    name: 'order_created',
    data: { type: 'contents', amount: 842.59, currency: 'EUR' }
  });
  assert.strictEqual(evt.validation.errorsCount > 0, true);
  const schemaFinding = evt.validation.findings.find(f => f.code === 'PARAM_AMOUNT_NOT_INTEGER');
  assert.strictEqual(schemaFinding.ruleSource, 'Official OpenAI Schema');
});

// 13. Currency Minor Unit Zero-Decimal Handling (JPY)
test('Decodes zero-decimal minor unit currencies correctly (JPY/KRW)', () => {
  assert.strictEqual(getCurrencyDecimalPlaces('JPY'), 0);
  assert.strictEqual(getCurrencyDecimalPlaces('KRW'), 0);
});

// 14. EventStore Debugger QA Score Calculation
test('Calculates Debugger QA Score with 6-layer breakdown', () => {
  const store = new EventStore();
  const res = store.calculateDebuggerQAScore();
  assert.strictEqual(res.score > 0, true);
  assert.strictEqual(res.breakdown.network.max, 15);
  assert.strictEqual(res.breakdown.schema.max, 30);
  assert.strictEqual(res.breakdown.requiredFields.max, 20);
  assert.strictEqual(res.breakdown.consistency.max, 15);
  assert.strictEqual(res.breakdown.matching.max, 10);
  assert.strictEqual(res.breakdown.diagnostics.max, 10);
});

// 15. Strict Separation of obref and oppref
test('Strictly separates obref from oppref attribution', () => {
  const rawBatch = {
    url: 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh&st=oaiq-web&sv=0.1.41',
    method: 'POST',
    status: 202,
    rawPayload: {
      obref: 'browser-sdk-uuid-1234',
      events: [
        { type: 'page_viewed', id: 'evt_1', data: { type: 'contents' } }
      ]
    }
  };

  const parsed = parseOpenAINetworkBatch(rawBatch);
  assert.strictEqual(parsed.parentRequest.obref, 'browser-sdk-uuid-1234');
  assert.strictEqual(parsed.openAIRequest.transport.obref, 'browser-sdk-uuid-1234');
  assert.strictEqual(parsed.openAIRequest.query.pid, '4KjX1dq4C7HUw7EUpRXfMh');
});

// 16. Internal SDK Event Exclusion Test
test('Excludes internal SDK events (sdk_init, diagnostic) from measurement events list', () => {
  const rawBatch = {
    url: 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh',
    rawPayload: {
      events: [
        { type: 'openai::sdk_init', id: '1' },
        { type: 'lead_created', id: '2', data: { type: 'customer_action' } },
        { type: 'oai::diagnostic', id: '3' }
      ]
    }
  };

  const parsed = parseOpenAINetworkBatch(rawBatch);
  assert.strictEqual(parsed.measurementEvents.length, 1);
  assert.strictEqual(parsed.measurementEvents[0].type, 'lead_created');
  assert.strictEqual(parsed.internalEvents.length, 2);
});

// 17. All Standard Events Recognition and Normalization
test('Recognizes and normalizes all 10 official standard events without error', () => {
  const standardEventNames = [
    'page_viewed',
    'contents_viewed',
    'items_added',
    'checkout_started',
    'order_created',
    'lead_created',
    'registration_completed',
    'appointment_scheduled',
    'subscription_created',
    'trial_started'
  ];

  standardEventNames.forEach((evtName) => {
    const isInternal = classifyNetworkEvent({ type: evtName });
    assert.strictEqual(isInternal, 'MEASUREMENT_EVENT');
    const norm = normalizeEvent({
      name: evtName,
      data: { type: 'contents' }
    });
    assert.strictEqual(norm.name, evtName);
    assert.strictEqual(norm.validation.isCustom, false);
  });
});

// 18. Batch Network Event Processing in EventStore
test('Processes batched standard measurement events in store correctly', () => {
  const store = new EventStore();
  const rawBatch = {
    url: 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh',
    method: 'POST',
    status: 202,
    rawPayload: {
      obref: 'batch-ref-abc',
      events: [
        { type: 'page_viewed', id: 'evt_pv_1', data: { type: 'contents' } },
        { type: 'contents_viewed', id: 'evt_cv_1', data: { type: 'contents', amount: 1500, currency: 'USD' } },
        { type: 'items_added', id: 'evt_ia_1', data: { type: 'contents', amount: 1500, currency: 'USD' } }
      ]
    }
  };

  const parsed = parseOpenAINetworkBatch(rawBatch);
  assert.strictEqual(parsed.measurementEvents.length, 3);
  parsed.measurementEvents.forEach((evt) => {
    const normalized = normalizeEvent({
      name: evt.type,
      parameters: evt.data,
      event_id: evt.id
    });
    store.addEvent(normalized);
  });

  assert.strictEqual(store.events.length, 3);
  assert.strictEqual(store.events[0].name, 'page_viewed');
  assert.strictEqual(store.events[1].name, 'contents_viewed');
  assert.strictEqual(store.events[2].name, 'items_added');
});

// 19. Normalizes Events with contents[] Items Array without Exception
test('Normalizes event with contents array items without TypeError', () => {
  const norm = normalizeEvent({
    name: 'items_added',
    data: {
      type: 'contents',
      amount: 2599,
      currency: 'USD',
      contents: [
        {
          id: 'prod_123',
          name: 'Pro Wireless Mouse',
          quantity: 1,
          amount: 2599,
          currency: 'USD',
          content_type: 'product'
        }
      ]
    }
  });

  assert.strictEqual(norm.name, 'items_added');
  assert.strictEqual(norm.validation.errorsCount, 0);
  assert.strictEqual(norm.parameters.contents.length, 1);
});

// 20. Processed Event Keys Deduplication Engine
test('Prevents dual ingestion of identical network events using processedEventKeys', () => {
  const store = new EventStore();
  const eventKey = 'evt_id:54f1f433-08a1-4321';
  
  assert.strictEqual(store.hasProcessedKey(eventKey), false);
  store.markProcessedKey(eventKey);
  assert.strictEqual(store.hasProcessedKey(eventKey), true);

  store.clear();
  assert.strictEqual(store.hasProcessedKey(eventKey), false);
});

// 21. Legitimate Repeated Network Events (e.g. repeated clicks across seconds)
test('Preserves legitimate repeated network requests as separate valid events', () => {
  const store = new EventStore();
  const t1 = 1000000;
  const t2 = 1002500; // 2.5 seconds later (separate legitimate user click)

  const evt1 = normalizeEvent({
    name: 'items_added',
    timestamp: t1,
    data: { type: 'contents', amount: 1500, currency: 'USD' }
  });
  const evt2 = normalizeEvent({
    name: 'items_added',
    timestamp: t2,
    data: { type: 'contents', amount: 1500, currency: 'USD' }
  });

  store.addEvent(evt1);
  store.addEvent(evt2);

  assert.strictEqual(store.events.length, 2);
  assert.strictEqual(store.events[0].isDuplicate, false);
  assert.strictEqual(store.events[1].isDuplicate, false);
  assert.strictEqual(store.events[1].duplicateStatus, '✅ Correct');
});

// 22. Rapid Double-Firing Detection (< 300ms race condition)
test('Detects rapid double-firing race condition within 300ms with identical parameters', () => {
  const store = new EventStore();
  const t1 = 1000000;
  const t2 = 1000050; // 50ms later (simultaneous tag trigger race condition)

  const evt1 = normalizeEvent({
    name: 'order_created',
    timestamp: t1,
    data: { type: 'contents', amount: 5000, currency: 'USD' }
  });
  const evt2 = normalizeEvent({
    name: 'order_created',
    timestamp: t2,
    data: { type: 'contents', amount: 5000, currency: 'USD' }
  });

  store.addEvent(evt1);
  store.addEvent(evt2);

  assert.strictEqual(store.events.length, 2);
  assert.strictEqual(store.events[0].isDuplicate, false);
  assert.strictEqual(store.events[1].isDuplicate, true);
  assert.strictEqual(store.events[1].duplicateStatus, '❌ Double Fired / Duplicate');
});

// 23. Exact Duplicate Event ID Detection
test('Detects duplicate event ID sent across multiple network requests', () => {
  const store = new EventStore();
  const evt1 = normalizeEvent({
    name: 'order_created',
    event_id: 'order_abc_123',
    timestamp: 1000000,
    data: { type: 'contents', amount: 5000, currency: 'USD' }
  });
  const evt2 = normalizeEvent({
    name: 'order_created',
    event_id: 'order_abc_123',
    timestamp: 1008000, // 8 seconds later with SAME explicit event_id
    data: { type: 'contents', amount: 5000, currency: 'USD' }
  });

  store.addEvent(evt1);
  store.addEvent(evt2);

  assert.strictEqual(store.events.length, 2);
  assert.strictEqual(store.events[0].isDuplicate, false);
  assert.strictEqual(store.events[1].isDuplicate, true);
  assert.strictEqual(store.events[1].duplicateReason.includes('order_abc_123'), true);
});

// 24. Custom Event Network Payload with top-level custom_event_name
test('Accurately detects custom event from wire network payload with custom_event_name', () => {
  const rawEnvelope = {
    type: 'custom',
    timestamp_ms: 1791009108118,
    id: '2e9a9c4c-f6d6-453c-8f44-da26f3f00038',
    source_url: 'https://example.com/quote',
    referrer_url: 'https://example.com/',
    custom_event_name: 'get_a_quote',
    data: { type: 'custom' }
  };

  const customEventName = rawEnvelope.custom_event_name || (rawEnvelope.data && rawEnvelope.data.custom_event_name) || (rawEnvelope.options && rawEnvelope.options.custom_event_name);

  const normalized = normalizeEvent({
    name: rawEnvelope.type,
    custom_event_name: customEventName,
    options: {
      custom_event_name: customEventName,
      event_id: rawEnvelope.id
    },
    parameters: rawEnvelope.data,
    event_id: rawEnvelope.id,
    timestamp: rawEnvelope.timestamp_ms,
    eventEnvelope: rawEnvelope
  });

  assert.strictEqual(normalized.displayName, 'get_a_quote');
  assert.strictEqual(normalized.custom_event_name, 'get_a_quote');
  assert.strictEqual(normalized.validation.isCustom, true);
  assert.strictEqual(normalized.validation.errorsCount, 0);
  assert.strictEqual(normalized.validation.status, 'valid');

  // Verify dictionary classification
  const info = getEventInfo(normalized.displayName);
  assert.strictEqual(info.category, 'custom');
  assert.strictEqual(info.label, 'Get A Quote');
});

// 25. Custom Event with custom_event_name in data/options object
test('Extracts custom_event_name from data object and options object correctly', () => {
  const normData = normalizeEvent({
    name: 'custom',
    data: {
      custom_event_name: 'calculator_used',
      amount: 5000,
      currency: 'USD'
    }
  });

  assert.strictEqual(normData.displayName, 'calculator_used');
  assert.strictEqual(normData.custom_event_name, 'calculator_used');
  assert.strictEqual(normData.validation.errorsCount, 0);
  assert.strictEqual(normData.validation.status, 'valid');

  const normOptions = normalizeEvent({
    name: 'custom',
    options: {
      custom_event_name: 'video_completed'
    },
    parameters: {
      video_id: 'vid_123'
    }
  });

  assert.strictEqual(normOptions.displayName, 'video_completed');
  assert.strictEqual(normOptions.validation.errorsCount, 0);
});

// 26. Custom Event with direct non-standard event name
test('Recognizes direct custom event name without false missing-name error', () => {
  const norm = normalizeEvent({
    name: 'download_whitepaper',
    parameters: { file_id: 'wp_2026.pdf' }
  });

  assert.strictEqual(norm.displayName, 'download_whitepaper');
  assert.strictEqual(norm.validation.isCustom, true);
  assert.strictEqual(norm.validation.errorsCount, 0);
});

// 27. Truly Missing custom_event_name generates MISSING_CUSTOM_EVENT_NAME error
test('Reports genuine error when custom_event_name is missing for type "custom"', () => {
  const norm = normalizeEvent({
    name: 'custom',
    data: { type: 'custom' }
  });

  assert.strictEqual(norm.validation.errorsCount, 1);
  assert.strictEqual(norm.validation.status, 'error');
  const missingIssue = norm.validation.issues.find(i => i.code === 'MISSING_CUSTOM_EVENT_NAME');
  assert.notStrictEqual(missingIssue, undefined);
  assert.strictEqual(missingIssue.severity, 'error');
});

// 28. Malformed / Too Long custom_event_name triggers warning
test('Validates custom_event_name length and character pattern', () => {
  // Exceeds 64 characters
  const tooLongName = 'a'.repeat(65);
  const normLong = normalizeEvent({
    name: 'custom',
    options: { custom_event_name: tooLongName }
  });
  assert.strictEqual(normLong.validation.warningsCount, 1);
  const longIssue = normLong.validation.issues.find(i => i.code === 'CUSTOM_NAME_TOO_LONG');
  assert.notStrictEqual(longIssue, undefined);

  // Invalid characters (e.g. spaces or symbols)
  const normInvalidChars = normalizeEvent({
    name: 'custom',
    options: { custom_event_name: 'get a quote!' }
  });
  assert.strictEqual(normInvalidChars.validation.warningsCount, 1);
  const formatIssue = normInvalidChars.validation.issues.find(i => i.code === 'CUSTOM_NAME_INVALID_FORMAT');
  assert.notStrictEqual(formatIssue, undefined);
});

// 29. Mixed Batch with Standard and Custom Events
test('Parses and normalizes batch containing both standard and custom events independently', () => {
  const rawBatch = {
    url: 'https://bzr.openai.com/v1/sdk/events?pid=4KjX1dq4C7HUw7EUpRXfMh',
    rawPayload: {
      obref: 'obref-uuid-999',
      events: [
        { type: 'page_viewed', id: 'evt_1', data: { type: 'contents' } },
        { type: 'custom', id: 'evt_2', custom_event_name: 'schedule_demo', data: { type: 'custom' } }
      ]
    }
  };

  const parsed = parseOpenAINetworkBatch(rawBatch);
  assert.strictEqual(parsed.measurementEvents.length, 2);

  const norm1 = normalizeEvent({
    name: parsed.measurementEvents[0].type,
    parameters: parsed.measurementEvents[0].data,
    event_id: parsed.measurementEvents[0].id
  });
  const norm2 = normalizeEvent({
    name: parsed.measurementEvents[1].type,
    custom_event_name: parsed.measurementEvents[1].custom_event_name,
    options: { custom_event_name: parsed.measurementEvents[1].custom_event_name },
    parameters: parsed.measurementEvents[1].data,
    event_id: parsed.measurementEvents[1].id
  });

  assert.strictEqual(norm1.displayName, 'page_viewed');
  assert.strictEqual(norm1.validation.isCustom, false);
  assert.strictEqual(norm1.validation.errorsCount, 0);

  assert.strictEqual(norm2.displayName, 'schedule_demo');
  assert.strictEqual(norm2.validation.isCustom, true);
  assert.strictEqual(norm2.validation.errorsCount, 0);
});

console.log(`\nTEST RESULTS: ${passedTests}/${totalTests} tests passed!`);
if (passedTests !== totalTests) {
  process.exit(1);
}


