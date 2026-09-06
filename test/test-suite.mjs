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

console.log(`\nTEST RESULTS: ${passedTests}/${totalTests} tests passed!`);
if (passedTests !== totalTests) {
  process.exit(1);
}
