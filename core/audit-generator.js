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

  // 1. Amount validation (Event-level monetary value in minor currency units)
  if (paramKey === 'amount' || paramKey.endsWith('_amount') || paramKey === 'value' || paramKey === 'price') {
    if (typeof paramVal !== 'number' || isNaN(paramVal)) {
      return { status: 'error', message: '"' + paramKey + '" must be an integer, received: ' + typeof paramVal };
    }
    if (paramVal < 0) {
      return { status: 'error', message: '"' + paramKey + '" cannot be negative (' + paramVal + ')' };
    }
    
    // Per OpenAI official documentation:
    // "Send monetary values as integers in the standard ISO 4217 minor unit for the currency code you provide, for example 12999 for $129.99 with currency: "USD"."
    if (!Number.isInteger(paramVal)) {
      return { status: 'error', message: '"' + paramKey + '" (' + paramVal + ') must be an integer in minor currency units (no decimals). For example, 12999 for $129.99 USD.' };
    }

    const curr = (eventContext.currency || 'USD').toUpperCase();
    const mult = (curr === 'JPY' || curr === 'KRW') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);

    // Check if event amount was mistakenly sent in major units while contents items used minor units
    if (Array.isArray(eventContext.contents) && eventContext.contents.length > 0) {
      const itemsSum = eventContext.contents.reduce((sum, i) => sum + ((Number(i.amount) || 0) * (Number(i.quantity) || 1)), 0);
      if (mult > 1 && paramVal * mult === itemsSum) {
        return { status: 'error', message: 'Event amount (' + paramVal + ') was sent in major units ($' + paramVal + '.00). In ' + curr + ', OpenAI expects minor units: ' + itemsSum + ' (' + paramVal + ' × ' + mult + ').' };
      }
    }

    if (paramKey === 'amount' && !eventContext.currency) {
      return { status: 'error', message: 'Parameter "currency" is strictly required whenever "amount" is present.' };
    }

    return { status: 'valid', message: 'Valid monetary amount in minor units (' + paramVal + ' ' + curr + ')' };
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
    let itemErrorMsg = '';
    const curr = (eventContext.currency || 'USD').toUpperCase();
    const mult = (curr === 'JPY' || curr === 'KRW') ? 1 : ((curr === 'KWD' || curr === 'BHD') ? 1000 : 100);

    paramVal.forEach((item, idx) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        hasItemErrors = true;
        itemErrorMsg = 'Malformed item object at index ' + idx;
      } else {
        const itemAmt = item.amount !== undefined ? item.amount : item.price;
        if (itemAmt !== undefined && itemAmt !== null) {
          if (typeof itemAmt !== 'number' || isNaN(itemAmt) || itemAmt < 0) {
            hasItemErrors = true;
            itemErrorMsg = 'Invalid item amount at index ' + idx;
          } else {
            let isMajor = false;
            if (!Number.isInteger(itemAmt)) {
              isMajor = true;
            } else if (mult > 1 && itemAmt > 0) {
              if (eventContext.amount !== undefined && typeof eventContext.amount === 'number') {
                if (itemAmt * mult === eventContext.amount || eventContext.amount >= itemAmt * mult) {
                  isMajor = true;
                }
              } else if (itemAmt < 1000) {
                isMajor = true;
              }
            }

            if (isMajor) {
              hasItemErrors = true;
              itemErrorMsg = 'contents[' + idx + '].amount was sent in major units ($' + itemAmt + '). OpenAI expects minor units: ' + (itemAmt * mult) + ' (' + itemAmt + ' × ' + mult + ').';
            }
          }
        }
      }
    });

    if (hasItemErrors) {
      return { status: 'error', message: itemErrorMsg || '"contents" contains item formatting errors.' };
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
export function auditContentsArray(contents = [], eventCurrency = 'USD', eventContext = {}) {
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
    const mult = (currency === 'JPY' || currency === 'KRW') ? 1 : ((currency === 'KWD' || currency === 'BHD') ? 1000 : 100);

    const issues = [];
    if (id === 'N/A') issues.push('Missing ID');
    if (name === 'N/A') issues.push('Missing Name');
    if (typeof quantity !== 'number' || quantity < 1) issues.push('Invalid quantity');
    if (amount !== null) {
      if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
        issues.push('Invalid amount');
      } else {
        let isMajor = false;
        if (!Number.isInteger(amount)) {
          isMajor = true;
        } else if (mult > 1 && amount > 0) {
          if (eventContext.amount !== undefined && typeof eventContext.amount === 'number') {
            if (amount * mult === eventContext.amount || eventContext.amount >= amount * mult) {
              isMajor = true;
            }
          } else if (amount < 1000) {
            isMajor = true;
          }
        }
        if (isMajor) {
          issues.push('Amount sent in major units ($' + amount + ') instead of minor units (' + (amount * mult) + ')');
        }
      }
    }

    return {
      itemIndex: idx + 1,
      id: String(id),
      name: String(name),
      quantity: quantity,
      amount: amount,
      currency: currency,
      status: issues.length > 0 ? (issues.some(i => i.includes('Invalid') || i.includes('Missing ID') || i.includes('major units')) ? 'error' : 'warning') : 'valid',
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
      contentsAudit = auditContentsArray(allParams.contents, allParams.currency || 'USD', allParams);
      const itemErrors = contentsAudit.filter(i => i.status === 'error').length;
      const itemWarns = contentsAudit.filter(i => i.status === 'warning').length;

      if (itemErrors > 0) {
        hasErrors = true;
        paramErrorCount += itemErrors;
        highIssues.push({
          code: 'CONTENTS_ITEM_ERROR',
          severity: 'high',
          event: eventName,
          parameter: 'contents',
          message: 'Event "' + eventName + '" contents array has ' + itemErrors + ' item error(s). Minor currency units required.',
          recommendation: 'Ensure all objects in "' + eventName + '" contents[] have valid id, name, positive quantity, and integer minor unit amounts.'
        });
      } else if (itemWarns > 0) {
        hasWarnings = true;
        emptyParamCount += itemWarns;
      }
    }

    // E. Synchronize issues directly from event validator results across all occurrences
    group.forEach(({ event: evt }) => {
      if (evt.validation && Array.isArray(evt.validation.issues)) {
        evt.validation.issues.forEach((iss) => {
          if (iss.severity === 'critical' || iss.severity === 'error') {
            hasErrors = true;
            paramErrorCount++;
            if (!criticalIssues.some(c => c.code === iss.code && c.event === eventName && c.parameter === (iss.parameterPath || iss.parameter))) {
              criticalIssues.push({
                code: iss.code || 'EVENT_VALIDATION_ERROR',
                severity: 'critical',
                event: eventName,
                parameter: iss.parameterPath || iss.parameter || 'payload',
                message: iss.message || ('Validation error in ' + eventName),
                recommendation: iss.recommendation || ('Correct parameter formatting in ' + eventName)
              });
            }
          } else if (iss.severity === 'warning') {
            hasWarnings = true;
            emptyParamCount++;
            if (!warningIssues.some(w => w.code === iss.code && w.event === eventName && w.parameter === (iss.parameterPath || iss.parameter))) {
              warningIssues.push({
                code: iss.code || 'EVENT_VALIDATION_WARNING',
                severity: 'warning',
                event: eventName,
                parameter: iss.parameterPath || iss.parameter || 'payload',
                message: iss.message || ('Validation warning in ' + eventName),
                recommendation: iss.recommendation || ('Review parameter formatting in ' + eventName)
              });
            }
          }
        });
      }
    });

    // F. Category Specific Checks
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

    // G. Overall Status for this Event
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

    // H. Add to Event Overview Table
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

    // I. Add to Dynamic Event Details Section
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
  const ecommerceScore = (errorEventsCount === 0) ? (warningEventsCount === 0 ? 100 : 88) : 72;
  const parameterScore = Math.max(25, Math.round(100 - (criticalIssues.length * 15) - (highIssues.length * 8) - (warningIssues.length * 3)));
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

  // 5. Generate Dynamic Executive Audit Insights
  const insights = [];

  // Insight A: Conversion Value & Revenue Integrity
  const amountIssues = allIssues.filter(i => (i.message || '').toLowerCase().includes('amount') || (i.message || '').toLowerCase().includes('minor unit'));
  if (amountIssues.length > 0) {
    insights.push({
      type: 'error',
      icon: '❌',
      title: 'Monetary Minor Units Discrepancy',
      desc: 'One or more events passed item amounts in major decimal units ($350) instead of minor units (35000 cents for USD). This can miscalculate ROAS.'
    });
  } else {
    insights.push({
      type: 'success',
      icon: '✅',
      title: 'Monetary Amounts Formatted',
      desc: 'All monitored monetary values adhere to OpenAI minor currency unit requirements.'
    });
  }

  // Insight B: Attribution & oppref Tracking
  if (attribution.oppref) {
    insights.push({
      type: 'success',
      icon: '✅',
      title: 'Ad Click Attribution Active',
      desc: 'oppref parameter (' + attribution.oppref.substring(0, 16) + '...) captured and attached to conversion payloads.'
    });
  } else {
    insights.push({
      type: 'info',
      icon: 'ℹ️',
      title: 'Direct / Organic Visit Mode',
      desc: 'No oppref click ID detected in current session. OpenAI ad campaigns will automatically append this parameter upon ad click.'
    });
  }

  // Insight C: E-Commerce Funnel Integrity
  const uniqueNames = new Set(events.map(e => (e.displayName || e.name || '').toLowerCase()));
  if (uniqueNames.has('contents_viewed') && uniqueNames.has('checkout_started') && uniqueNames.has('order_created')) {
    insights.push({
      type: 'success',
      icon: '⚡',
      title: 'Full E-Commerce Journey Observed',
      desc: 'All critical conversion funnel steps (View Content → Checkout → Order) fired in this testing session.'
    });
  } else {
    insights.push({
      type: 'neutral',
      icon: '📊',
      title: 'Funnel Step Coverage',
      desc: uniqueNames.size + ' distinct event types observed. Simulate complete checkout journey to verify end-to-end attribution.'
    });
  }

  // Insight D: Deduplication Hygiene
  if (duplicateCount > 0) {
    insights.push({
      type: 'error',
      icon: '⚠️',
      title: 'Double-Firing Detected',
      desc: duplicateCount + ' duplicate event firing(s) detected within 2 seconds. Ensure triggers fire once per user action.'
    });
  } else {
    insights.push({
      type: 'success',
      icon: '🛡️',
      title: 'Deduplication Clean',
      desc: 'Zero double-firing or redundant payload retransmissions detected in this session.'
    });
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
    insights: insights,
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

/**
 * Formats full 14-section comprehensive audit report into standard multi-section CSV format
 */
export function formatAuditCsv(report, tabState = {}) {
  const sections = [];

  const escapeCsv = (str) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return '"' + s + '"';
  };

  // Section 1: Executive Audit Summary
  sections.push(['# 1. EXECUTIVE AUDIT SUMMARY', '', '', '', '', '', '', '', '', '']);
  sections.push(['Website', 'Audit Date', 'Overall Health Score', 'Overall Status', 'Total Events', 'Standard Events', 'Custom Events', 'Passed', 'Warnings', 'Critical Issues'].map(escapeCsv));
  sections.push([
    report.website,
    report.auditDate,
    report.overallHealthScore + '%',
    report.overallStatus,
    report.counts.total,
    report.counts.standard,
    report.counts.custom,
    report.counts.passed,
    report.counts.warnings,
    report.counts.critical
  ].map(escapeCsv));
  sections.push([]);

  // Section 2: Event Tracking Overview
  sections.push(['# 2. EVENT TRACKING OVERVIEW', '', '', '', '', '', '']);
  sections.push(['Event Name', 'Classification Type', 'Trigger Status', 'Parameters Status', 'Duplicate Status', 'Occurrences', 'Overall Status'].map(escapeCsv));
  if (report.overviewTable && report.overviewTable.length > 0) {
    report.overviewTable.forEach(row => {
      sections.push([
        row.name,
        row.type,
        row.trigger,
        row.parameters,
        row.duplicate,
        row.occurrences,
        row.status
      ].map(escapeCsv));
    });
  } else {
    sections.push(['No events detected', '-', '-', '-', '-', '0', '-'].map(escapeCsv));
  }
  sections.push([]);

  // Section 3: Tracking Health Category Scores
  sections.push(['# 3. TRACKING HEALTH CATEGORY SCORES', '', '', '']);
  sections.push(['Pillar / Category', 'Score (%)', 'Target', 'Status'].map(escapeCsv));
  sections.push(['Overall Tracking Health', report.overallHealthScore + '%', '100%', report.overallHealthScore >= 80 ? 'Optimal' : 'Needs Improvement'].map(escapeCsv));
  sections.push(['Event Coverage', report.scores.coverage + '%', '100%', report.scores.coverage >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push(['Event Payload Quality', report.scores.payloadQuality + '%', '100%', report.scores.payloadQuality >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push(['Ecommerce Data Quality', report.scores.ecommerceData + '%', '100%', report.scores.ecommerceData >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push(['Parameter Quality', report.scores.parameterQuality + '%', '100%', report.scores.parameterQuality >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push(['Duplicate Prevention', report.scores.duplicatePrevention + '%', '100%', report.scores.duplicatePrevention >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push(['Custom Event Quality', report.scores.customEventQuality + '%', '100%', report.scores.customEventQuality >= 80 ? 'Optimal' : 'Warning'].map(escapeCsv));
  sections.push([]);

  // Section 4-9: Dynamic Event & Parameter Validations
  sections.push(['# 4-9. DYNAMIC EVENT & PARAMETER VALIDATION DETAILS', '', '', '', '', '']);
  sections.push(['Event Name', 'Event Type', 'Parameter Name', 'Received Value', 'Validation Status', 'Finding / Diagnostic Message'].map(escapeCsv));
  if (report.eventDetails && report.eventDetails.length > 0) {
    report.eventDetails.forEach(evt => {
      if (evt.parameters && evt.parameters.length > 0) {
        evt.parameters.forEach(p => {
          sections.push([
            evt.name,
            evt.type,
            p.parameter,
            p.value,
            p.status.toUpperCase(),
            p.message || ''
          ].map(escapeCsv));
        });
      } else {
        sections.push([
          evt.name,
          evt.type,
          '(No parameters)',
          '-',
          evt.status.toUpperCase(),
          evt.finding || ''
        ].map(escapeCsv));
      }
    });
  }
  sections.push([]);

  // Section 10: Contents Array Inspection
  sections.push(['# 10. CONTENTS[] ARRAY INSPECTION', '', '', '', '', '', '', '', '']);
  sections.push(['Event Name', 'Item Index', 'Item ID', 'Item Name', 'Quantity', 'Amount', 'Currency', 'Validation Status', 'Diagnostic Message'].map(escapeCsv));
  let hasContents = false;
  if (report.eventDetails && report.eventDetails.length > 0) {
    report.eventDetails.forEach(evt => {
      if (evt.contents && evt.contents.length > 0) {
        hasContents = true;
        evt.contents.forEach(c => {
          sections.push([
            evt.name,
            c.itemIndex,
            c.id,
            c.name,
            c.quantity,
            c.amount !== null ? c.amount : '',
            c.currency || '',
            c.status.toUpperCase(),
            c.message || ''
          ].map(escapeCsv));
        });
      }
    });
  }
  if (!hasContents) {
    sections.push(['No contents items detected in session events', '-', '-', '-', '-', '-', '-', '-', '-'].map(escapeCsv));
  }
  sections.push([]);

  // Section 11: Duplicate Event Inspection Log
  sections.push(['# 11. DUPLICATE EVENT INSPECTION LOG', '', '', '', '']);
  sections.push(['Event Name', 'Occurrences', 'Duplicate Detected', 'Finding', 'Recommendation'].map(escapeCsv));
  if (report.eventDetails && report.eventDetails.length > 0) {
    report.eventDetails.forEach(evt => {
      sections.push([
        evt.name,
        evt.occurrences,
        evt.duplicateCheck ? 'No (Passed)' : 'Yes (Failed)',
        evt.finding,
        evt.recommendation
      ].map(escapeCsv));
    });
  }
  sections.push([]);

  // Section 12: Issues Found by Severity
  sections.push(['# 12. ISSUES FOUND BY SEVERITY', '', '', '', '', '']);
  sections.push(['Severity', 'Issue Code', 'Event Name', 'Parameter', 'Diagnostic Message', 'Fix Recommendation'].map(escapeCsv));
  ['critical', 'high', 'warning'].forEach(sev => {
    (report.issues[sev] || []).forEach(iss => {
      sections.push([
        sev.toUpperCase(),
        iss.code,
        iss.event || '-',
        iss.parameter || '-',
        iss.message,
        iss.recommendation || '-'
      ].map(escapeCsv));
    });
  });
  sections.push([]);

  // Section 13: Recommended Actions
  sections.push(['# 13. RECOMMENDED ACTIONS CHECKLIST', '', '']);
  sections.push(['Step #', 'Priority', 'Action Description'].map(escapeCsv));
  if (report.recommendations && report.recommendations.length > 0) {
    report.recommendations.forEach((rec, i) => {
      sections.push([
        i + 1,
        i === 0 ? 'High' : 'Medium',
        rec
      ].map(escapeCsv));
    });
  } else {
    sections.push(['1', 'Low', 'No outstanding tracking actions required. Implementation is healthy.'].map(escapeCsv));
  }
  sections.push([]);

  // Section 14: Raw Event Telemetry Stream
  sections.push(['# 14. RAW EVENT TELEMETRY STREAM', '', '', '', '', '', '', '', '', '']);
  sections.push(['Timestamp', 'Event Name', 'Type', 'Page Path', 'Event ID', 'Pixel ID', 'Amount', 'Currency', 'oppref Attribution', 'Parameters JSON'].map(escapeCsv));
  if (tabState && tabState.events && tabState.events.length > 0) {
    tabState.events.forEach(evt => {
      const p = evt.parameters || {};
      sections.push([
        new Date(evt.timestamp).toISOString(),
        evt.displayName || evt.name || '',
        classifyEventType(evt.displayName || evt.name || ''),
        evt.pathname || '',
        evt.eventId || 'Not Sent',
        evt.pixelId || '',
        p.amount !== undefined ? p.amount : '',
        p.currency || '',
        evt.attribution?.oppref || '',
        JSON.stringify(p)
      ].map(escapeCsv));
    });
  }
  sections.push([]);

  return '\uFEFF' + sections.map(r => r.join(',')).join('\r\n');
}
