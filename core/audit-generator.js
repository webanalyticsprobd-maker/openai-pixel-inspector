/**
 * OpenAI Ads Pixel Inspector - Schema-Aware Audit Report Generator Engine
 * 
 * Generates comprehensive, business-agnostic audit reports for:
 * - Standard traffic events
 * - Ecommerce events (contents_viewed, items_added, checkout_started, order_created)
 * - Lead generation events (lead_created, appointment_scheduled, registration_completed)
 * - Custom & business-specific events (quote_requested, demo_requested, product_comparison, etc.)
 */

import { ISO_CURRENCIES } from '../validators/schemas.js';

// Event Classification Sets
const ECOMMERCE_EVENT_NAMES = new Set([
  'contents_viewed', 'view_content', 'viewcontent', 'product_viewed', 'view_item',
  'items_added', 'add_to_cart', 'addtocart', 'cart_updated',
  'checkout_started', 'begin_checkout', 'begincheckout', 'initiate_checkout',
  'order_created', 'purchase', 'order_placed', 'order_completed', 'payment_info_added'
]);

const LEAD_EVENT_NAMES = new Set([
  'lead_created', 'lead', 'generate_lead',
  'appointment_scheduled', 'schedule', 'booking_confirmed',
  'registration_completed', 'complete_registration', 'sign_up',
  'subscription_created', 'subscription_started', 'subscribe',
  'trial_started', 'start_trial', 'quote_requested', 'demo_requested',
  'contact_submitted', 'form_submitted'
]);

const STANDARD_TRAFFIC_NAMES = new Set([
  'page_viewed', 'page_view', 'pageview',
  'app_opened', 'app_installed'
]);

export function classifyEventType(eventName = '') {
  const clean = eventName.toLowerCase().trim().replace(/[\s\-_]/g, '');
  
  for (const name of ECOMMERCE_EVENT_NAMES) {
    if (name.replace(/[\s\-_]/g, '') === clean) return 'Ecommerce';
  }
  for (const name of LEAD_EVENT_NAMES) {
    if (name.replace(/[\s\-_]/g, '') === clean) return 'Lead';
  }
  for (const name of STANDARD_TRAFFIC_NAMES) {
    if (name.replace(/[\s\-_]/g, '') === clean) return 'Standard';
  }
  return 'Custom';
}

/**
 * Validates individual parameters dynamically without false rejections for custom fields
 */
export function auditParameter(paramKey, paramVal, eventContext = {}) {
  if (paramVal === undefined) {
    return { status: 'warning', message: 'Parameter is undefined' };
  }
  if (paramVal === null || (typeof paramVal === 'string' && paramVal.trim() === '')) {
    return { status: 'warning', message: 'Empty value for "' + paramKey + '"' };
  }

  // 1. Amount validation
  if (paramKey === 'amount' || paramKey.endsWith('_amount') || paramKey === 'value' || paramKey === 'price') {
    if (typeof paramVal !== 'number' || isNaN(paramVal)) {
      return { status: 'error', message: '"' + paramKey + '" must be numeric, received: ' + typeof paramVal };
    }
    if (paramVal < 0) {
      return { status: 'error', message: '"' + paramKey + '" cannot be negative (' + paramVal + ')' };
    }
    
    // Check minor units vs currency if currency provided
    const curr = (eventContext.currency || 'USD').toUpperCase();
    const mult = (curr === 'JPY' || curr === 'KRW') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);
    if (mult > 1 && paramVal > 0 && paramVal < 10 && !Number.isInteger(paramVal)) {
      return { status: 'warning', message: 'Amount appears to be in decimal/major units (' + paramVal + '). OpenAI expects minor units (' + (paramVal * mult) + ' for ' + curr + ').' };
    }
    return { status: 'valid', message: 'Valid monetary amount' };
  }

  // 2. Currency validation
  if (paramKey === 'currency') {
    if (typeof paramVal !== 'string' || paramVal.length !== 3) {
      return { status: 'error', message: 'Invalid currency format: "' + paramVal + '". Must be 3-letter ISO code.' };
    }
    const code = paramVal.toUpperCase();
    if (!ISO_CURRENCIES.has(code)) {
      return { status: 'warning', message: 'Unrecognized ISO currency code: "' + code + '"' };
    }
    return { status: 'valid', message: 'Valid ISO 4217 currency (' + code + ')' };
  }

  // 3. Contents Array validation
  if (paramKey === 'contents') {
    if (!Array.isArray(paramVal)) {
      return { status: 'error', message: '"contents" must be an array of item objects.' };
    }
    if (paramVal.length === 0) {
      return { status: 'warning', message: '"contents" array is empty.' };
    }
    let hasItemErrors = false;
    paramVal.forEach((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        hasItemErrors = true;
      }
    });
    if (hasItemErrors) {
      return { status: 'error', message: '"contents" contains invalid/malformed item objects.' };
    }
    return { status: 'valid', message: 'Valid array with ' + paramVal.length + ' item(s)' };
  }

  // 4. Event ID validation
  if (paramKey === 'event_id' || paramKey === 'eventId') {
    if (typeof paramVal !== 'string' || paramVal.trim() === '') {
      return { status: 'warning', message: 'event_id is empty or non-string' };
    }
    return { status: 'valid', message: 'Valid deduplication event_id' };
  }

  // 5. General / Custom Parameter Check
  if (typeof paramVal === 'object') {
    return { status: 'valid', message: 'Valid object structure' };
  }

  return { status: 'valid', message: 'Valid parameter value' };
}

/**
 * Deep inspection of contents[] array objects
 */
export function auditContentsArray(contents = [], eventCurrency = 'USD') {
  if (!Array.isArray(contents)) return [];

  return contents.map((item, idx) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return {
        itemIndex: idx + 1,
        id: 'N/A',
        name: 'Malformed Object',
        quantity: 0,
        amount: 0,
        currency: eventCurrency,
        status: 'error',
        message: 'Item is not a valid object'
      };
    }

    const id = item.id || item.item_id || item.product_id || item.sku || 'N/A';
    const name = item.name || item.item_name || item.title || 'N/A';
    const quantity = item.quantity !== undefined ? item.quantity : 1;
    const amount = item.amount !== undefined ? item.amount : (item.price !== undefined ? item.price : null);
    const currency = (item.currency || eventCurrency || 'USD').toUpperCase();

    const issues = [];
    if (id === 'N/A') issues.push('Missing ID');
    if (name === 'N/A') issues.push('Missing Name');
    if (typeof quantity !== 'number' || quantity < 1) issues.push('Invalid quantity');
    if (amount !== null && (typeof amount !== 'number' || isNaN(amount) || amount < 0)) issues.push('Invalid amount');

    return {
      itemIndex: idx + 1,
      id: String(id),
      name: String(name),
      quantity: quantity,
      amount: amount,
      currency: currency,
      status: issues.length > 0 ? (issues.some(i => i.includes('Invalid') || i.includes('Missing ID')) ? 'error' : 'warning') : 'valid',
      message: issues.length > 0 ? issues.join(', ') : 'Valid item'
    };
  });
}

/**
 * Comprehensive Audit Report Generator
 */
export function generateComprehensiveAudit(tabState = {}) {
  const events = Array.isArray(tabState.events) ? tabState.events : [];
  const pixel = tabState.pixel || {};
  const attribution = tabState.attribution || {};
  const sessionId = tabState.sessionId || ('SESSION_' + (tabState.id || Date.now()));

  let website = 'unknown';
  try {
    website = new URL(tabState.url).hostname;
  } catch {
    website = tabState.url || 'localhost';
  }

  // 1. Classify and Audit Every Event Dynamically
  const eventDetails = [];
  const eventOverviewRows = [];
  const criticalIssues = [];
  const highIssues = [];
  const warningIssues = [];
  const passedChecks = [];
  const recommendations = [];

  let standardEventsCount = 0;
  let customEventsCount = 0;
  let passedEventsCount = 0;
  let warningEventsCount = 0;
  let errorEventsCount = 0;

  // Group events to check for duplicates and aggregate
  const eventNameGroups = {};

  events.forEach((evt, idx) => {
    const rawName = evt.displayName || evt.name || 'unnamed_event';
    const eventType = classifyEventType(rawName);

    if (eventType === 'Custom') customEventsCount++;
    else standardEventsCount++;

    if (!eventNameGroups[rawName]) {
      eventNameGroups[rawName] = [];
    }
    eventNameGroups[rawName].push({ event: evt, index: idx });
  });

  // Evaluate each unique event name block
  for (const [eventName, group] of Object.entries(eventNameGroups)) {
    const eventType = classifyEventType(eventName);
    const occurrences = group.length;
    const latestEvt = group[group.length - 1].event;
    const allParams = latestEvt.parameters || {};

    let hasErrors = false;
    let hasWarnings = false;
    let findingText = '';
    let recommendationText = '';

    // A. Trigger Check
    const triggerPassed = occurrences > 0;

    // B. Duplicate Check
    let duplicateDetected = false;
    let duplicateReason = '';
    
    if (occurrences > 1) {
      for (let i = 1; i < group.length; i++) {
        const prev = group[i - 1].event;
        const curr = group[i].event;
        const timeDiff = Math.abs((curr.timestamp || 0) - (prev.timestamp || 0));
        const samePayload = JSON.stringify(curr.parameters || {}) === JSON.stringify(prev.parameters || {});
        const samePage = (curr.pathname || curr.url) === (prev.pathname || prev.url);

        if (curr.isDuplicate || (samePayload && samePage && timeDiff < 2000)) {
          duplicateDetected = true;
          duplicateReason = 'Multiple ' + eventName + ' events detected for identical user action within ' + timeDiff + 'ms.';
          break;
        }
      }
    }

    if (duplicateDetected) {
      hasErrors = true;
      criticalIssues.push({
        code: 'DUPLICATE_EVENT_FIRING',
        severity: 'critical',
        event: eventName,
        message: occurrences + ' occurrences of "' + eventName + '" detected with double firing / duplicate payloads.',
        recommendation: 'Fix duplicate firing for "' + eventName + '". Ensure tracking trigger only fires once per distinct action.'
      });
    }

    // C. Parameter Audit
    const paramAuditRows = [];
    let emptyParamCount = 0;
    let paramErrorCount = 0;

    for (const [pKey, pVal] of Object.entries(allParams)) {
      const pAudit = auditParameter(pKey, pVal, allParams);
      if (pAudit.status === 'error') {
        paramErrorCount++;
        hasErrors = true;
        highIssues.push({
          code: 'INVALID_PARAM_' + pKey.toUpperCase(),
          severity: 'high',
          event: eventName,
          parameter: pKey,
          message: 'Event "' + eventName + '" parameter "' + pKey + '": ' + pAudit.message,
          recommendation: 'Correct parameter "' + pKey + '" on "' + eventName + '" to match specification.'
        });
      } else if (pAudit.status === 'warning') {
        emptyParamCount++;
        hasWarnings = true;
        warningIssues.push({
          code: 'SUBOPTIMAL_PARAM_' + pKey.toUpperCase(),
          severity: 'warning',
          event: eventName,
          parameter: pKey,
          message: 'Event "' + eventName + '" parameter "' + pKey + '": ' + pAudit.message,
          recommendation: 'Review "' + pKey + '" formatting on event "' + eventName + '".'
        });
      }
      paramAuditRows.push({
        parameter: pKey,
        value: typeof pVal === 'object' ? JSON.stringify(pVal) : String(pVal),
        status: pAudit.status,
        message: pAudit.message
      });
    }

    // D. Contents Array Audit
    let contentsAudit = [];
    if (Array.isArray(allParams.contents)) {
      contentsAudit = auditContentsArray(allParams.contents, allParams.currency || 'USD');
      const itemErrors = contentsAudit.filter(i => i.status === 'error').length;
      const itemWarns = contentsAudit.filter(i => i.status === 'warning').length;

      if (itemErrors > 0) {
        hasErrors = true;
        highIssues.push({
          code: 'CONTENTS_ITEM_ERROR',
          severity: 'high',
          event: eventName,
          parameter: 'contents',
          message: 'Event "' + eventName + '" contents array has ' + itemErrors + ' item error(s).',
          recommendation: 'Ensure all objects in "' + eventName + '" contents[] have valid id, name, positive quantity, and minor unit amounts.'
        });
      } else if (itemWarns > 0) {
        hasWarnings = true;
      }
    }

    // E. Category Specific Checks
    if (eventType === 'Ecommerce') {
      if (eventName === 'order_created' || eventName === 'purchase') {
        if (allParams.amount === undefined || allParams.currency === undefined) {
          hasErrors = true;
          criticalIssues.push({
            code: 'PURCHASE_MISSING_VALUE',
            severity: 'critical',
            event: eventName,
            message: 'Conversion event "' + eventName + '" is missing required amount/currency parameters.',
            recommendation: 'Pass both { amount: <cents>, currency: "USD" } with order_created.'
          });
        }
      }
    }

    // F. Overall Status for this Event
    let eventStatus = 'Passed';
    let eventSeverity = 'valid';

    if (hasErrors || duplicateDetected || paramErrorCount > 0) {
      eventStatus = 'Issue';
      eventSeverity = 'error';
      errorEventsCount++;
      findingText = duplicateDetected ? duplicateReason : ('Parameter or data quality issues detected in "' + eventName + '".');
      recommendationText = 'Review the event implementation and verify parameter formats for "' + eventName + '".';
    } else if (hasWarnings || emptyParamCount > 0) {
      eventStatus = 'Warning';
      eventSeverity = 'warning';
      warningEventsCount++;
      findingText = 'The event was detected and fired, but contains ' + emptyParamCount + ' suboptimal or empty parameter(s).';
      recommendationText = 'Ensure all optional parameters contain valid values before firing "' + eventName + '".';
    } else {
      passedEventsCount++;
      findingText = 'The ' + eventType.toLowerCase() + ' event was successfully detected and its payload contains valid data.';
      recommendationText = 'No immediate issue detected. Implementation is verified.';
    }

    // G. Add to Event Overview Table
    eventOverviewRows.push({
      name: eventName,
      type: eventType,
      trigger: triggerPassed ? '✅' : '❌',
      parameters: paramErrorCount > 0 ? '❌' : (emptyParamCount > 0 ? '⚠️' : '✅'),
      duplicate: duplicateDetected ? '❌' : '✅',
      status: eventSeverity === 'valid' ? '✅ Passed' : (eventSeverity === 'warning' ? '⚠️ Warning' : '❌ Issue'),
      severity: eventSeverity,
      occurrences: occurrences
    });

    // H. Add to Dynamic Event Details Section
    eventDetails.push({
      name: eventName,
      type: eventType,
      status: eventStatus,
      severity: eventSeverity,
      occurrences: occurrences,
      trigger: triggerPassed,
      duplicateCheck: !duplicateDetected,
      parametersStatus: paramErrorCount === 0 && emptyParamCount === 0,
      parameters: paramAuditRows,
      contents: contentsAudit,
      finding: findingText,
      recommendation: recommendationText
    });
  }

  // 2. Pixel Installation and Attribution Global Issues
  if (!pixel.detected) {
    criticalIssues.push({
      code: 'PIXEL_NOT_DETECTED',
      severity: 'critical',
      message: 'OpenAI Ads Pixel base script was not detected on this page.',
      recommendation: 'Add the official OpenAI Pixel snippet to the site <head>.'
    });
  }

  if (!attribution.oppref) {
    warningIssues.push({
      code: 'OPPREF_NOT_DETECTED',
      severity: 'info',
      message: 'No oppref click attribution parameter detected (Direct / Organic visit).',
      recommendation: 'Verify that landing URLs from OpenAI Ads append ?oppref=gAAAA... and persist to __oppref cookie.'
    });
  }

  // 3. Compute Granular Health Scores (0 - 100%)
  const totalEvents = events.length;
  const duplicateCount = events.filter(e => e.isDuplicate).length;

  const eventCoverageScore = totalEvents > 0 ? (totalEvents >= 3 ? 95 : 85) : 0;
  const payloadQualityScore = totalEvents > 0 ? Math.max(20, Math.round(((totalEvents - errorEventsCount) / totalEvents) * 100)) : 100;
  const ecommerceScore = (errorEventsCount === 0) ? (warningEventsCount === 0 ? 100 : 88) : 75;
  const parameterScore = Math.max(30, Math.round(100 - (criticalIssues.length * 20) - (highIssues.length * 10) - (warningIssues.length * 3)));
  const duplicatePreventionScore = duplicateCount > 0 ? 70 : 100;
  const customEventScore = customEventsCount > 0 ? 94 : 100;

  const overallHealthScore = Math.min(100, Math.max(0, Math.round(
    (eventCoverageScore * 0.2) +
    (payloadQualityScore * 0.25) +
    (ecommerceScore * 0.2) +
    (parameterScore * 0.2) +
    (duplicatePreventionScore * 0.15)
  )));

  let overallStatus = '✅ Passed';
  let overallBadge = 'Healthy';
  if (criticalIssues.length > 0 || highIssues.length > 0 || overallHealthScore < 75) {
    overallStatus = '⚠️ Needs Improvement';
    overallBadge = 'Needs Attention';
  } else if (warningIssues.length > 0 || overallHealthScore < 90) {
    overallStatus = '⚠️ Minor Warnings';
    overallBadge = 'Needs Attention';
  }

  // 4. Generate Unified Recommendations List
  const allIssues = [...criticalIssues, ...highIssues, ...warningIssues];
  allIssues.forEach((iss) => {
    if (iss.recommendation && !recommendations.includes(iss.recommendation)) {
      recommendations.push(iss.recommendation);
    }
  });
  if (recommendations.length === 0) {
    recommendations.push('Maintain current tracking setup. All observed events meet OpenAI verification criteria.');
  }

  const auditDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return {
    website,
    auditDate,
    overallHealthScore,
    overallStatus,
    overallBadge,
    scores: {
      overall: overallHealthScore,
      coverage: eventCoverageScore,
      payloadQuality: payloadQualityScore,
      ecommerceData: ecommerceScore,
      parameterQuality: parameterScore,
      duplicatePrevention: duplicatePreventionScore,
      customEventQuality: customEventScore
    },
    counts: {
      total: totalEvents,
      standard: standardEventsCount,
      custom: customEventsCount,
      passed: passedEventsCount,
      warnings: warningEventsCount,
      critical: criticalIssues.length + highIssues.length
    },
    overviewTable: eventOverviewRows,
    eventDetails: eventDetails,
    issues: {
      critical: criticalIssues,
      high: highIssues,
      warning: warningIssues,
      passed: passedChecks
    },
    recommendations: recommendations,
    sessionId: sessionId
  };
}

/**
 * Formats the Comprehensive Audit Report as GitHub-Flavored Markdown
 */
export function formatAuditMarkdown(report) {
  const lines = [];

  lines.push('# OpenAI Pixel Audit Report');
  lines.push('');
  lines.push('The audit report supports standard eCommerce events, lead-generation events, custom events, and business-specific events.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 1. Audit Summary
  lines.push('# 1. Audit Summary');
  lines.push('');
  lines.push('**Website:** ' + report.website);
  lines.push('**Audit Date:** ' + report.auditDate);
  lines.push('**Overall Tracking Health:** ' + report.overallHealthScore + '%');
  lines.push('');
  lines.push('### Events');
  lines.push('');
  lines.push('* Total Events Detected: ' + report.counts.total);
  lines.push('* Standard Events: ' + report.counts.standard);
  lines.push('* Custom Events: ' + report.counts.custom);
  lines.push('* Passed: ' + report.counts.passed);
  lines.push('* Warnings: ' + report.counts.warnings);
  lines.push('* Critical Issues: ' + report.counts.critical);
  lines.push('');
  lines.push('### Overall Status');
  lines.push('');
  lines.push('**' + report.overallStatus + '**');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 2. Event Tracking Overview
  lines.push('# 2. Event Tracking Overview');
  lines.push('');
  lines.push('| Event | Type | Trigger | Parameters | Duplicate | Status |');
  lines.push('| :--- | :--- | :---: | :---: | :---: | :--- |');
  
  if (report.overviewTable.length === 0) {
    lines.push('| *No events detected* | - | - | - | - | - |');
  } else {
    report.overviewTable.forEach((row) => {
      lines.push('| ' + row.name + ' | ' + row.type + ' | ' + row.trigger + ' | ' + row.parameters + ' | ' + row.duplicate + ' | ' + row.status + ' |');
    });
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 3. Event Classification
  lines.push('# 3. Event Classification');
  lines.push('');
  lines.push('Detected events are classified dynamically:');
  lines.push('');
  lines.push('### Standard');
  lines.push('* `page_viewed`');
  lines.push('');
  lines.push('### Ecommerce');
  lines.push('* `contents_viewed`, `items_added`, `checkout_started`, `order_created`');
  lines.push('');
  lines.push('### Lead Generation');
  lines.push('* `lead_created`, `appointment_scheduled`, `registration_completed`, `subscription_created`');
  lines.push('');
  lines.push('### Custom');
  lines.push('* Any business-specific or custom event (e.g. `quote_requested`, `demo_requested`, `product_comparison`).');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 4. Dynamic Event Detail Section
  lines.push('# 4. Dynamic Event Detail Section');
  lines.push('');

  if (report.eventDetails.length === 0) {
    lines.push('*No event details available.*');
    lines.push('');
  } else {
    report.eventDetails.forEach((evt) => {
      lines.push('## Event: ' + evt.name);
      lines.push('');
      lines.push('**Event Type:** ' + evt.type);
      lines.push('**Status:** ' + (evt.severity === 'valid' ? '✅ Passed' : (evt.severity === 'warning' ? '⚠️ Warning' : '❌ Issue')));
      lines.push('');
      lines.push('**Occurrences Detected:** ' + evt.occurrences);
      lines.push('');
      lines.push('**Trigger:** ' + (evt.trigger ? '✅ Detected' : '❌ Failed'));
      lines.push('**Parameters:** ' + (evt.parametersStatus ? '✅ Valid' : '⚠️ Suboptimal'));
      lines.push('**Duplicate Check:** ' + (evt.duplicateCheck ? '✅ Passed' : '❌ Failed'));
      lines.push('');
      lines.push('### Finding');
      lines.push(evt.finding);
      lines.push('');
      lines.push('### Recommendation');
      lines.push(evt.recommendation);
      lines.push('');

      // Parameters Table
      if (evt.parameters && evt.parameters.length > 0) {
        lines.push('### Parameters');
        lines.push('');
        lines.push('| Parameter | Value | Status |');
        lines.push('| :--- | :--- | :---: |');
        evt.parameters.forEach((p) => {
          lines.push('| ' + p.parameter + ' | ' + p.value + ' | ' + (p.status === 'valid' ? '✅' : (p.status === 'warning' ? '⚠️' : '❌')) + ' |');
        });
        lines.push('');
      }

      // Contents Table
      if (evt.contents && evt.contents.length > 0) {
        lines.push('### Contents');
        lines.push('');
        lines.push('**Items Detected:** ' + evt.contents.length);
        lines.push('');
        lines.push('| Item | ID | Name | Quantity | Amount | Currency | Status |');
        lines.push('| :---: | :--- | :--- | :---: | :---: | :---: | :---: |');
        evt.contents.forEach((c) => {
          lines.push('| ' + c.itemIndex + ' | ' + c.id + ' | ' + c.name + ' | ' + c.quantity + ' | ' + (c.amount !== null ? c.amount : '-') + ' | ' + c.currency + ' | ' + (c.status === 'valid' ? '✅' : '❌') + ' |');
        });
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    });
  }

  // 12. Issues Found
  lines.push('# 12. Issues Found');
  lines.push('');
  lines.push('## 🔴 Critical');
  if (report.issues.critical.length === 0) {
    lines.push('*No critical issues found.*');
  } else {
    report.issues.critical.forEach((iss, i) => {
      lines.push((i + 1) + '. **[' + iss.code + ']** ' + iss.message);
    });
  }
  lines.push('');

  lines.push('## 🟠 High');
  if (report.issues.high.length === 0) {
    lines.push('*No high priority issues found.*');
  } else {
    report.issues.high.forEach((iss, i) => {
      lines.push((i + 1) + '. **[' + iss.code + ']** ' + iss.message);
    });
  }
  lines.push('');

  lines.push('## 🟡 Warning');
  if (report.issues.warning.length === 0) {
    lines.push('*No warnings found.*');
  } else {
    report.issues.warning.forEach((iss, i) => {
      lines.push((i + 1) + '. **[' + iss.code + ']** ' + iss.message);
    });
  }
  lines.push('');

  // 13. Recommended Actions
  lines.push('# 13. Recommended Actions');
  lines.push('');
  report.recommendations.forEach((rec, i) => {
    lines.push((i + 1) + '. ' + rec);
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  // 14. Final Tracking Score
  lines.push('# 14. Final Tracking Score');
  lines.push('');
  lines.push('### OpenAI Pixel Tracking Health: **' + report.overallHealthScore + ' / 100**');
  lines.push('');
  lines.push('* **Event Coverage:** ' + report.scores.coverage + '%');
  lines.push('* **Event Payload Quality:** ' + report.scores.payloadQuality + '%');
  lines.push('* **Ecommerce Data Quality:** ' + report.scores.ecommerceData + '%');
  lines.push('* **Parameter Quality:** ' + report.scores.parameterQuality + '%');
  lines.push('* **Duplicate Prevention:** ' + report.scores.duplicatePrevention + '%');
  lines.push('* **Custom Event Quality:** ' + report.scores.customEventQuality + '%');
  lines.push('');
  lines.push('### Overall Status: **' + report.overallStatus + '**');
  lines.push('');

  return lines.join('\n');
}
