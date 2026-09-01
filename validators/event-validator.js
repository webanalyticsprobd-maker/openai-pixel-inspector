/**
 * OpenAI Ads Pixel Inspector - Comprehensive Event Validation Engine
 * 
 * Validates events against the central OpenAI Pixel schema.
 * Emits standardized finding objects with machine-readable codes and precise payload paths.
 */

import {
  STANDARD_JS_EVENTS,
  CAPI_ONLY_EVENTS,
  STANDARD_EVENT_ALIASES,
  OPENAI_PIXEL_SCHEMA,
  CUSTOM_EVENT_RULES,
  OFFICIAL_DOCS
} from './schemas.js';
import { validateParameter, validateContentsArray } from './parameter-validator.js';
import { scanForPii } from './pii-scanner.js';

export function validateEvent(event) {
  const eventName = event.name || event.eventName || '';
  const options = event.options || {};
  const parameters = event.parameters || {};
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

  // 1. Event Name Validation
  if (isCapiOnlyEvent) {
    findings.push({
      severity: 'warning',
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
    // Non-standard event name passed directly to measure (e.g. oaiq("measure", "purchase"))
    findings.push({
      severity: 'error',
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

  // Retrieve schema rules
  const schema = OPENAI_PIXEL_SCHEMA.events[canonicalName] || (isCustomEvent ? OPENAI_PIXEL_SCHEMA.events['custom'] : null);

  if (schema) {
    // 2. Validate Required Parameters
    if (schema.requiredParameters && Array.isArray(schema.requiredParameters)) {
      for (const reqField of schema.requiredParameters) {
        if (parameters[reqField] === undefined || parameters[reqField] === null) {
          findings.push({
            severity: 'error',
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

    // 4. Validate Conditional Requirements (e.g. currency required when amount is sent)
    if (schema.conditionalRequired && Array.isArray(schema.conditionalRequired)) {
      for (const cond of schema.conditionalRequired) {
        if (parameters[cond.when] !== undefined && parameters[cond.when] !== null) {
          for (const reqField of cond.require) {
            if (parameters[reqField] === undefined || parameters[reqField] === null || parameters[reqField] === '') {
              findings.push({
                severity: 'error',
                category: 'parameter',
                eventName: eventName,
                pixelId: pixelId,
                path: reqField,
                code: 'PARAM_AMOUNT_MISSING_CURRENCY',
                title: `Missing Required "${reqField}"`,
                detected: 'undefined',
                expected: '3-letter ISO 4217 currency code (e.g. "USD")',
                message: cond.message || `Parameter "${reqField}" is required when "${cond.when}" is provided.`,
                documentationReference: schema.docUrl || OFFICIAL_DOCS.SUPPORTED_EVENTS,
                recommendedFix: `Add "${reqField}" to event parameters whenever "${cond.when}" is sent.`
              });
            }
          }
        }
      }
    }

    // 5. Validate Event-Level Parameters
    const allowedSet = new Set(schema.allowedParameters || Object.keys(schema.parameters || {}));
    for (const [paramKey, paramVal] of Object.entries(parameters)) {
      if (paramKey === 'contents') {
        // Handled separately below in contents validator
        continue;
      }

      if (!allowedSet.has(paramKey) && !isCustomEvent) {
        findings.push({
          severity: 'warning',
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
          findings.push(finding);
        }
      }
    }

    // 6. Validate Contents Array (if present)
    if (parameters.contents !== undefined) {
      const contentsFindings = validateContentsArray(parameters.contents, parameters, eventName);
      contentsFindings.forEach((f) => {
        f.pixelId = pixelId;
        findings.push(f);
      });
    }
  }

  // 7. Custom Event Validation
  if (isCustomEvent || canonicalName === 'custom') {
    const customName = options.custom_event_name || (canonicalName !== 'custom' ? canonicalName : null);
    if (!customName) {
      findings.push({
        severity: 'error',
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
          category: 'event',
          eventName: eventName,
          pixelId: pixelId,
          path: 'options.custom_event_name',
          code: 'CUSTOM_NAME_INVALID_FORMAT',
          title: 'Invalid Custom Event Name Format',
          detected: customName,
          expected: 'Alphanumeric, underscores, or hyphens',
          message: 'Custom event name must start and end with an alphanumeric character and contain only alphanumeric, underscores, or hyphens.',
          documentationReference: OFFICIAL_DOCS.SUPPORTED_EVENTS,
          recommendedFix: 'Use clean identifiers such as "quote_requested" or "video_completed".'
        });
      }
      if (STANDARD_JS_EVENTS.includes(customName) && customName !== 'custom') {
        findings.push({
          severity: 'warning',
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

  // 8. Deduplication Info Validation
  if (options.event_id) {
    findings.push({
      severity: 'info',
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

  // 9. Scan for Unhashed PII Privacy Violations
  const detectedPii = scanForPii(parameters);
  if (detectedPii.length > 0) {
    detectedPii.forEach((pii) => {
      findings.push({
        severity: pii.severity || 'warning',
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

  // 10. Compile Status and Summary Counts
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
    dataShape: schema ? schema.dataShape : 'contents',
    findings: findings,
    issues: findings.filter((f) => f.severity === 'error' || f.severity === 'warning'),
    parameterResults: parameterResults,
    errorsCount: errorsCount,
    warningsCount: warningsCount,
    infoCount: infoCount
  };
}
