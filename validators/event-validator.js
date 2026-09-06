/**
 * OpenAI Ads Pixel Inspector - Comprehensive Event Validation Engine
 * 
 * Four Validation Layers:
 * - Level 1: Network Validation (HTTPS, POST, 202 Accepted, PID presence, ec count matching)
 * - Level 2: Official Schema Validation (Rule Source: "Official OpenAI Schema")
 * - Level 3: Data Quality & Consistency (Rule Source: "Debugger Semantic QA")
 * - Level 4: Implementation & Journey QA (Rule Source: "Heuristic QA")
 */

import {
  STANDARD_JS_EVENTS,
  CAPI_ONLY_EVENTS,
  STANDARD_EVENT_ALIASES,
  OPENAI_PIXEL_SCHEMA,
  EVENT_REGISTRY,
  CUSTOM_EVENT_RULES,
  OFFICIAL_DOCS,
  SCHEMA_METADATA,
  decodeMoney,
  getCurrencyDecimalPlaces
} from './schemas.js';
import { validateParameter, validateContentsArray } from './parameter-validator.js';
import { scanForPii } from './pii-scanner.js';

export function formatHumanReadableAmount(amount, currencyCode = 'USD') {
  return decodeMoney(amount, currencyCode);
}

export function validateEvent(event) {
  const eventName = event.name || event.eventName || '';
  const options = event.options || {};
  const parameters = event.parameters || event.data || {};
  const pixelId = event.pixelId || null;

  // Resolve alias if applicable
  let canonicalName = eventName;
  if (STANDARD_EVENT_ALIASES[eventName]) {
    canonicalName = STANDARD_EVENT_ALIASES[eventName];
  }

  const isStandardJsEvent = STANDARD_JS_EVENTS.includes(canonicalName);
  const isCapiOnlyEvent = CAPI_ONLY_EVENTS.includes(canonicalName);
  const isCustomEvent = canonicalName === 'custom' || (!isStandardJsEvent && !isCapiOnlyEvent);

  const findings = [];

  // LEVEL 2: OFFICIAL SCHEMA VALIDATION - Event Name Validation
  if (isCapiOnlyEvent) {
    findings.push({
      severity: 'warning',
      ruleSource: 'Official OpenAI Schema',
      category: 'event',
      eventName: eventName,
      pixelId: pixelId,
      path: 'event',
      code: 'CAPI_ONLY_EVENT',
      title: 'Conversions API Only Event',
      detected: eventName,
      expected: 'Standard JS Pixel events: ' + STANDARD_JS_EVENTS.slice(0, 5).join(', ') + '...',
      message: `Event "${eventName}" is documented as Conversions API only and is not supported in the browser JavaScript Pixel.`,
      documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      recommendedFix: `Send "${eventName}" server-side via Conversions API or use a standard browser event.`
    });
  } else if (!isStandardJsEvent && canonicalName !== 'custom') {
    findings.push({
      severity: 'error',
      ruleSource: 'Official OpenAI Schema',
      category: 'event',
      eventName: eventName,
      pixelId: pixelId,
      path: 'event',
      code: 'UNSUPPORTED_EVENT',
      title: 'Unsupported Event Name',
      detected: eventName,
      expected: 'Documented OpenAI Pixel event name (e.g. order_created, page_viewed, custom)',
      message: `"${eventName}" is not a recognized standard OpenAI Ads Pixel event.`,
      documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      recommendedFix: STANDARD_EVENT_ALIASES[eventName]
        ? `Rename "${eventName}" to official event name "${STANDARD_EVENT_ALIASES[eventName]}".`
        : `Use a standard event name or trigger via custom event: oaiq("measure", "custom", { type: "custom" }, { custom_event_name: "${eventName}" }).`
    });
  }

  // Retrieve schema rules from registry
  const registryEntry = EVENT_REGISTRY[canonicalName] || (isCustomEvent ? EVENT_REGISTRY['custom'] : null);
  const schema = OPENAI_PIXEL_SCHEMA.events[canonicalName] || (isCustomEvent ? OPENAI_PIXEL_SCHEMA.events['custom'] : null);
  const expectedDataType = registryEntry?.dataType || schema?.dataShape || 'contents';

  // LEVEL 2: Mandatory Event Data-Type Check (HARD RULE)
  if (parameters.type !== undefined && parameters.type !== expectedDataType) {
    findings.push({
      severity: 'error',
      ruleSource: 'Official OpenAI Schema',
      category: 'shape',
      eventName: eventName,
      pixelId: pixelId,
      path: 'data.type',
      code: 'EVENT_DATA_TYPE_MISMATCH',
      title: 'Event Data Type Mismatch',
      detected: String(parameters.type),
      expected: expectedDataType,
      message: `Event "${eventName}" expects data.type: "${expectedDataType}", but received "${parameters.type}".`,
      documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
      recommendedFix: `Set data.type to "${expectedDataType}" in the event payload.`
    });
  }

  if (schema) {
    // 2. Validate Required Parameters
    if (schema.requiredParameters && Array.isArray(schema.requiredParameters)) {
      for (const reqField of schema.requiredParameters) {
        if (parameters[reqField] === undefined || parameters[reqField] === null) {
          findings.push({
            severity: 'error',
            ruleSource: 'Official OpenAI Schema',
            category: 'parameter',
            eventName: eventName,
            pixelId: pixelId,
            path: reqField,
            code: 'MISSING_REQUIRED_PARAMETER',
            title: `Missing Required Parameter "${reqField}"`,
            detected: 'undefined',
            expected: schema.parameters[reqField]?.expected || schema.parameters[reqField]?.type || 'defined value',
            message: `Missing required parameter "${reqField}" for event "${eventName}".`,
            documentationReference: schema.docUrl || OFFICIAL_DOCS.SUPPORTED_EVENTS,
            recommendedFix: `Include "${reqField}" in the event parameters.`
          });
        }
      }
    }

    // 3. Validate Recommended Parameters
    if (schema.recommendedParameters && Array.isArray(schema.recommendedParameters)) {
      for (const recField of schema.recommendedParameters) {
        if (parameters[recField] === undefined || parameters[recField] === null || parameters[recField] === '') {
          findings.push({
            severity: 'warning',
            ruleSource: 'Official OpenAI Schema',
            category: 'parameter',
            eventName: eventName,
            pixelId: pixelId,
            path: recField,
            code: 'MISSING_RECOMMENDED_PARAMETER',
            title: `Recommended Parameter Missing: "${recField}"`,
            detected: 'undefined',
            expected: schema.parameters[recField]?.type || 'value',
            message: `Recommended parameter "${recField}" was not provided for "${eventName}".`,
            documentationReference: schema.docUrl || OFFICIAL_DOCS.SUPPORTED_EVENTS,
            recommendedFix: `Providing "${recField}" enables accurate conversion and revenue reporting.`
          });
        }
      }
    }

    // 4. Validate Conditional Requirements (currency required whenever amount is sent)
    if (schema.conditionalRequired && Array.isArray(schema.conditionalRequired)) {
      for (const cond of schema.conditionalRequired) {
        if (parameters[cond.when] !== undefined && parameters[cond.when] !== null) {
          for (const reqField of cond.require) {
            if (parameters[reqField] === undefined || parameters[reqField] === null || parameters[reqField] === '') {
              findings.push({
                severity: 'error',
                ruleSource: 'Official OpenAI Schema',
                category: 'parameter',
                eventName: eventName,
                pixelId: pixelId,
                path: reqField,
                code: 'PARAM_AMOUNT_MISSING_CURRENCY',
                title: `Missing Required "${reqField}"`,
                detected: 'undefined',
                expected: '3-letter ISO 4217 currency code (e.g. "USD", "EUR")',
                message: cond.message || `Parameter "${reqField}" is required when "${cond.when}" is provided.`,
                documentationReference: schema.docUrl || OFFICIAL_DOCS.SUPPORTED_EVENTS,
                recommendedFix: `Add "${reqField}" to event parameters whenever "${cond.when}" is sent.`
              });
            }
          }
        }
      }
    }

    // Amount minor currency unit integer check
    if (parameters.amount !== undefined && parameters.amount !== null) {
      if (typeof parameters.amount === 'number' && !Number.isInteger(parameters.amount)) {
        findings.push({
          severity: 'error',
          ruleSource: 'Official OpenAI Schema',
          category: 'parameter',
          eventName: eventName,
          pixelId: pixelId,
          path: 'amount',
          code: 'PARAM_AMOUNT_NOT_INTEGER',
          title: 'Invalid Amount Format (Expected Integer Minor Units)',
          detected: parameters.amount,
          expected: 'Integer minor units without decimals (e.g. 84259)',
          message: `OpenAI requires monetary amounts to be integers in the currency's minor unit. Received ${parameters.amount}, likely intended ${Math.round(parameters.amount * 100)}.`,
          documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
          recommendedFix: `Convert amount to integer minor units (multiply major currency by 100 for 2-decimal currencies e.g. EUR/USD).`
        });
      }
    }

    // 5. Validate Event-Level Parameters
    const allowedSet = new Set(schema.allowedParameters || Object.keys(schema.parameters || {}));
    for (const [paramKey, paramVal] of Object.entries(parameters)) {
      if (paramKey === 'contents') {
        continue;
      }

      if (!allowedSet.has(paramKey) && !isCustomEvent) {
        findings.push({
          severity: 'warning',
          ruleSource: 'Official OpenAI Schema',
          category: 'parameter',
          eventName: eventName,
          pixelId: pixelId,
          path: paramKey,
          code: 'UNEXPECTED_PARAMETER',
          title: 'Unexpected Parameter',
          detected: paramKey,
          expected: Array.from(allowedSet).join(' | '),
          message: `Parameter "${paramKey}" is not in the documented parameter set for "${eventName}".`,
          documentationReference: schema.docUrl || OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: `Use only documented parameters: [${Array.from(allowedSet).join(', ')}].`
        });
      }

      const paramRule = schema.parameters ? schema.parameters[paramKey] : null;
      if (paramRule) {
        const finding = validateParameter(paramKey, paramVal, paramRule, parameters, eventName, '');
        if (finding) {
          finding.pixelId = pixelId;
          if (!finding.ruleSource) finding.ruleSource = 'Official OpenAI Schema';
          findings.push(finding);
        }
      }
    }

    // 6. Validate Contents Array (if present)
    if (parameters.contents !== undefined) {
      const contentsFindings = validateContentsArray(parameters.contents, parameters, eventName);
      contentsFindings.forEach((f) => {
        f.pixelId = pixelId;
        if (!f.ruleSource) f.ruleSource = 'Official OpenAI Schema';
        findings.push(f);
      });
    }

    // 7. LEVEL 3: DATA QUALITY & SEMANTIC QA (Reconciliation between Item Totals and Event Amount)
    if (
      typeof parameters.amount === 'number' &&
      Array.isArray(parameters.contents) &&
      parameters.contents.length > 0
    ) {
      const curr = (parameters.currency || 'USD').toString().toUpperCase();
      const mult = (curr === 'JPY' || curr === 'KRW' || curr === 'VND') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);

      const firstItem = parameters.contents[0];
      const qty = Number(firstItem.quantity) || 1;

      // Check single-item unit mismatch (e.g. data.amount = 35000, contents[0].amount = 350)
      if (
        parameters.contents.length === 1 &&
        typeof firstItem.amount === 'number'
      ) {
        const itemLineTotal = firstItem.amount * qty;

        if (mult > 1 && itemLineTotal * mult === parameters.amount) {
          const eventFormatted = decodeMoney(parameters.amount, curr);
          const itemFormatted = decodeMoney(firstItem.amount, curr);
          const expectedItemMinor = Math.round(parameters.amount / qty);
          const expectedFormatted = decodeMoney(expectedItemMinor, curr);

          findings.push({
            severity: 'warning',
            ruleSource: 'Debugger Semantic QA',
            category: 'commerce_consistency',
            eventName: eventName,
            pixelId: pixelId,
            path: 'contents[0].amount',
            code: 'COMMERCE_VALUE_MISMATCH',
            title: 'Value Mismatch (Major/Minor Unit Discrepancy)',
            detected: `Event amount: ${parameters.amount} (${eventFormatted}), Item amount: ${firstItem.amount} (${itemFormatted}) × ${qty}`,
            expected: `Consistent minor units across event and item levels (${expectedItemMinor} = ${expectedFormatted} per item)`,
            message: `Event total (${eventFormatted}) differs from item total (${itemFormatted}) by exactly ${mult}x. The event amount uses minor units while contents[0].amount appears to have been passed in major units. Review contents[0].amount = ${firstItem.amount}.`,
            documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
            recommendedFix: `Confirm whether contents[0].amount should be ${expectedItemMinor} (${expectedFormatted}).`
          });
        } else if (itemLineTotal !== parameters.amount) {
          const eventFormatted = decodeMoney(parameters.amount, curr);
          const itemFormatted = decodeMoney(itemLineTotal, curr);

          findings.push({
            severity: 'warning',
            ruleSource: 'Debugger Semantic QA',
            category: 'commerce_consistency',
            eventName: eventName,
            pixelId: pixelId,
            path: 'contents[0].amount',
            code: 'COMMERCE_LINE_TOTAL_MISMATCH',
            title: 'Item Total Differs from Event Total',
            detected: `Item total: ${itemLineTotal} (${itemFormatted}), Event amount: ${parameters.amount} (${eventFormatted})`,
            expected: `Item line total to equal event amount`,
            message: `The calculated item line total (${firstItem.amount} × ${qty} = ${itemLineTotal}) does not match the event-level amount (${parameters.amount}).`,
            documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
            recommendedFix: `Verify product unit prices and quantities match the total order value.`
          });
        }
      } else if (parameters.contents.length > 1) {
        // Multi-item total sum check
        const allHaveAmounts = parameters.contents.every(item => typeof item.amount === 'number');
        if (allHaveAmounts) {
          const sumItems = parameters.contents.reduce((sum, item) => sum + (item.amount * (Number(item.quantity) || 1)), 0);
          if (sumItems !== parameters.amount) {
            const eventFormatted = decodeMoney(parameters.amount, curr);
            const sumFormatted = decodeMoney(sumItems, curr);

            findings.push({
              severity: 'warning',
              ruleSource: 'Debugger Semantic QA',
              category: 'commerce_consistency',
              eventName: eventName,
              pixelId: pixelId,
              path: 'contents',
              code: 'COMMERCE_MULTI_ITEM_SUM_MISMATCH',
              title: 'Multi-Item Sum Differs from Event Total',
              detected: `Calculated items sum: ${sumItems} (${sumFormatted}), Event amount: ${parameters.amount} (${eventFormatted})`,
              expected: `SUM(item amount × quantity) equals event total`,
              message: `The sum of all items in contents[] (${sumFormatted}) differs from event amount (${eventFormatted}).`,
              documentationReference: OFFICIAL_DOCS.COMMERCE_FLOW,
              recommendedFix: `Reconcile individual item amounts with the parent event amount.`
            });
          }
        }
      }
    }
  }

  // 8. Custom Event Validation
  if (isCustomEvent || canonicalName === 'custom') {
    const customName = options.custom_event_name || (canonicalName !== 'custom' ? canonicalName : null);
    if (!customName) {
      findings.push({
        severity: 'error',
        ruleSource: 'Official OpenAI Schema',
        category: 'event',
        eventName: eventName,
        pixelId: pixelId,
        path: 'options.custom_event_name',
        code: 'MISSING_CUSTOM_EVENT_NAME',
        title: 'Missing Custom Event Name',
        detected: 'undefined',
        expected: '1–64 character custom event name in options',
        message: 'Custom events require custom_event_name in the options parameter.',
        documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
        recommendedFix: 'Pass options: { custom_event_name: "your_custom_event" }.'
      });
    } else {
      if (customName.length > CUSTOM_EVENT_RULES.maxLength) {
        findings.push({
          severity: 'warning',
          ruleSource: 'Official OpenAI Schema',
          category: 'event',
          eventName: eventName,
          pixelId: pixelId,
          path: 'options.custom_event_name',
          code: 'CUSTOM_NAME_TOO_LONG',
          title: 'Custom Event Name Too Long',
          detected: customName.length + ' chars',
          expected: '<= 64 characters',
          message: `Custom event name exceeds ${CUSTOM_EVENT_RULES.maxLength} characters.`,
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: 'Shorten custom event name to under 64 characters.'
        });
      }
      if (!CUSTOM_EVENT_RULES.validPattern.test(customName)) {
        findings.push({
          severity: 'warning',
          ruleSource: 'Official OpenAI Schema',
          category: 'event',
          eventName: eventName,
          pixelId: pixelId,
          path: 'options.custom_event_name',
          code: 'CUSTOM_NAME_INVALID_FORMAT',
          title: 'Invalid Custom Event Name Format',
          detected: customName,
          expected: 'Alphanumeric, underscores, or hyphens (must start and end with letter or number)',
          message: 'Custom event name must start and end with a letter or number and contain only letters, numbers, underscores, or hyphens (no spaces or punctuation).',
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: 'Use clean identifiers such as "quote_requested" or "video_completed".'
        });
      }
      if (customName !== customName.toLowerCase()) {
        findings.push({
          severity: 'warning',
          ruleSource: 'Official OpenAI Schema',
          category: 'event',
          eventName: eventName,
          pixelId: pixelId,
          path: 'options.custom_event_name',
          code: 'CUSTOM_NAME_UPPERCASE',
          title: 'Custom Event Name Contains Uppercase',
          detected: customName,
          expected: 'Lowercase snake_case format',
          message: `Custom event names are officially recommended to be lowercase: "${customName.toLowerCase()}".`,
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: `Rename custom event to "${customName.toLowerCase()}".`
        });
      }
      if (STANDARD_JS_EVENTS.includes(customName) && customName !== 'custom') {
        findings.push({
          severity: 'warning',
          ruleSource: 'Official OpenAI Schema',
          category: 'event',
          eventName: eventName,
          pixelId: pixelId,
          path: 'options.custom_event_name',
          code: 'CUSTOM_NAME_COLLIDES_STANDARD',
          title: 'Custom Name Collides With Standard Event',
          detected: customName,
          expected: 'Unique custom business action name',
          message: `Custom event name "${customName}" is identical to a standard OpenAI event name.`,
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: `Use standard event call oaiq("measure", "${customName}", ...) instead of custom event.`
        });
      }
    }
  }

  // 9. Deduplication Info Validation
  if (options.event_id) {
    findings.push({
      severity: 'info',
      ruleSource: 'Official OpenAI Schema',
      category: 'deduplication',
      eventName: eventName,
      pixelId: pixelId,
      path: 'options.event_id',
      code: 'DEDUPLICATION_ID_DETECTED',
      title: 'Browser Deduplication ID Detected',
      detected: String(options.event_id),
      expected: 'Unique event identifier string',
      message: `Browser event_id detected: "${options.event_id}". Ready for Conversions API deduplication.`,
      documentationReference: OFFICIAL_DOCS.MEASUREMENT_PIXEL,
      recommendedFix: 'Ensure matching server-side event uses the same event_id.'
    });
  }

  // 10. Scan for Unhashed PII Privacy Violations
  const detectedPii = scanForPii(parameters);
  if (detectedPii.length > 0) {
    detectedPii.forEach((pii) => {
      findings.push({
        severity: pii.severity || 'warning',
        ruleSource: 'Official OpenAI Schema',
        category: 'privacy',
        eventName: eventName,
        pixelId: pixelId,
        path: pii.path,
        code: `PII_PRIVACY_${pii.type.toUpperCase()}`,
        title: 'Raw Unhashed PII Detected',
        detected: pii.detected || pii.path,
        expected: 'SHA-256 hashed customer identifiers',
        message: pii.message,
        documentationReference: OFFICIAL_DOCS.MEASUREMENT_PIXEL,
        recommendedFix: pii.recommendation
      });
    });
  }

  // 11. Compile Status and Summary Counts
  let errorsCount = 0;
  let warningsCount = 0;
  let infoCount = 0;
  let parameterResults = {};

  findings.forEach((f) => {
    if (f.severity === 'error') errorsCount++;
    else if (f.severity === 'warning') warningsCount++;
    else if (f.severity === 'info') infoCount++;

    const rootPath = f.path.split('.')[0].replace(/\[.*\]/, '');
    if (!parameterResults[rootPath]) {
      parameterResults[rootPath] = {
        valid: f.severity !== 'error',
        severity: f.severity,
        code: f.code,
        message: f.message
      };
    }
  });

  // Ensure valid entries for parameters with no issues
  for (const pKey of Object.keys(parameters)) {
    if (!parameterResults[pKey]) {
      parameterResults[pKey] = {
        valid: true,
        severity: 'valid',
        code: 'PARAM_VALID',
        message: `Valid parameter "${pKey}".`
      };
    }
  }

  let finalStatus = 'valid';
  if (errorsCount > 0) finalStatus = 'error';
  else if (warningsCount > 0) finalStatus = 'warning';

  return {
    status: finalStatus,
    isCustom: isCustomEvent,
    canonicalName: canonicalName,
    dataShape: expectedDataType,
    findings: findings,
    issues: findings.filter((f) => f.severity === 'error' || f.severity === 'warning'),
    parameterResults: parameterResults,
    errorsCount: errorsCount,
    warningsCount: warningsCount,
    infoCount: infoCount,
    humanReadableAmounts: {
      eventAmount: typeof parameters.amount === 'number' ? decodeMoney(parameters.amount, parameters.currency || 'USD') : null,
      items: Array.isArray(parameters.contents) ? parameters.contents.map(i => typeof i.amount === 'number' ? decodeMoney(i.amount, i.currency || parameters.currency || 'USD') : null) : []
    }
  };
}

