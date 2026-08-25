/**
 * OpenAI Ads Pixel Inspector - Scanner & Full Journey Audit Generator
 * 
 * Analyzes event streams, generates Funnel Progression graphs,
 * checks CAPI deduplication readiness, and inspects PII compliance.
 */

const STANDARD_FUNNEL_STEPS = [
  { key: 'page_view', names: ['page_viewed', 'page_view', 'pageview'], label: 'Page View', requiredParams: ['url'] },
  { key: 'view_content', names: ['view_content', 'product_viewed', 'viewitem', 'view_item'], label: 'View Content', requiredParams: ['contents'] },
  { key: 'add_to_cart', names: ['add_to_cart', 'cart_updated', 'addtocart'], label: 'Add To Cart', requiredParams: ['contents'] },
  { key: 'initiate_checkout', names: ['initiate_checkout', 'checkout_started', 'begin_checkout'], label: 'Initiate Checkout', requiredParams: ['amount', 'currency'] },
  { key: 'purchase', names: ['order_created', 'purchase', 'order_placed'], label: 'Purchase', requiredParams: ['amount', 'currency', 'contents'] }
];

export function computeFunnelAnalysis(events = []) {
  const funnel = {
    steps: [],
    completedCount: 0,
    totalSteps: STANDARD_FUNNEL_STEPS.length,
    completionPercentage: 0,
    highestStepReached: 0,
    dropOffStep: null
  };

  STANDARD_FUNNEL_STEPS.forEach((fStep, stepIdx) => {
    // Find matching events for this funnel stage
    const matchingEvts = events.filter((evt) => {
      const name = (evt.name || '').toLowerCase();
      const disp = (evt.displayName || '').toLowerCase();
      return fStep.names.includes(name) || fStep.names.includes(disp);
    });

    const isDetected = matchingEvts.length > 0;
    const latestEvt = isDetected ? matchingEvts[matchingEvts.length - 1] : null;

    let hasEventId = false;
    let hasAmount = false;
    let hasCurrency = false;
    let issuesCount = 0;
    let piiCount = 0;

    if (latestEvt) {
      hasEventId = Boolean(latestEvt.eventId);
      hasAmount = latestEvt.parameters?.amount !== undefined;
      hasCurrency = Boolean(latestEvt.parameters?.currency);
      issuesCount = latestEvt.validation?.issues?.length || 0;
      piiCount = latestEvt.validation?.piiIssues?.length || 0;
    }

    if (isDetected) {
      funnel.completedCount++;
      funnel.highestStepReached = stepIdx + 1;
    } else if (funnel.dropOffStep === null && stepIdx > 0 && funnel.highestStepReached > 0) {
      funnel.dropOffStep = fStep.label;
    }

    funnel.steps.push({
      stepNumber: stepIdx + 1,
      key: fStep.key,
      label: fStep.label,
      detected: isDetected,
      count: matchingEvts.length,
      latestTimestamp: latestEvt ? latestEvt.timestamp : null,
      eventId: latestEvt?.eventId || null,
      hasEventId: hasEventId,
      hasAmount: hasAmount,
      hasCurrency: hasCurrency,
      issuesCount: issuesCount,
      piiCount: piiCount,
      event: latestEvt
    });
  });

  funnel.completionPercentage = Math.round((funnel.completedCount / funnel.totalSteps) * 100);
  return funnel;
}

export function computeCapiDeduplication(events = []) {
  const criticalMonetaryEvents = ['purchase', 'order_created', 'initiate_checkout', 'checkout_started', 'lead', 'subscribe', 'complete_registration'];
  
  const conversionEvents = events.filter((evt) => {
    const name = (evt.name || '').toLowerCase();
    const disp = (evt.displayName || '').toLowerCase();
    return criticalMonetaryEvents.some((c) => name.includes(c) || disp.includes(c));
  });

  let eventsWithEventId = 0;
  const missingEventIdList = [];
  const seenEventIds = new Map();
  const duplicateEventIds = [];

  conversionEvents.forEach((evt) => {
    const id = evt.eventId;
    if (id && String(id).trim() !== '' && String(id) !== 'undefined' && String(id) !== 'null') {
      eventsWithEventId++;
      if (seenEventIds.has(id)) {
        duplicateEventIds.push({ id: id, event: evt.displayName || evt.name, previousEvent: seenEventIds.get(id) });
      } else {
        seenEventIds.set(id, evt.displayName || evt.name);
      }
    } else {
      missingEventIdList.push(evt.displayName || evt.name);
    }
  });

  let score = 100;
  let status = 'pass'; // 'pass' | 'warning' | 'fail'

  if (conversionEvents.length > 0) {
    const coverage = eventsWithEventId / conversionEvents.length;
    score = Math.round(coverage * 100);

    if (duplicateEventIds.length > 0) {
      score = Math.max(0, score - 30);
      status = 'fail';
    } else if (score < 100) {
      status = score >= 50 ? 'warning' : 'fail';
    }
  }

  return {
    conversionEventsCount: conversionEvents.length,
    eventsWithEventId: eventsWithEventId,
    coverageScore: score,
    status: status,
    missingEventIdList: missingEventIdList,
    duplicateEventIds: duplicateEventIds,
    isCapiReady: conversionEvents.length === 0 || (score === 100 && duplicateEventIds.length === 0)
  };
}

export function generateAuditReport(tabState) {
  const pixel = tabState.pixel || {};
  const attribution = tabState.attribution || {};
  const events = tabState.events || [];
  const network = tabState.network || [];
  const dataLayer = tabState.dataLayer || [];
  const gtmContainers = tabState.gtmContainers || [];
  const visitedPages = tabState.visitedPages || [];

  const summary = {
    website: tabState.url || 'Unknown',
    hostname: '',
    sessionId: tabState.sessionId || 'SESSION_' + Date.now().toString(36).toUpperCase(),
    generatedAt: new Date().toISOString(),
    overallStatus: 'pass', // 'pass' | 'warning' | 'fail'
    scores: {
      pixelInstalled: pixel.detected,
      pixelConfidence: pixel.confidence || 'none',
      pixelIds: pixel.pixelIds || [],
      multipleImplementations: (pixel.pixelIds || []).length > 1,
      initialized: pixel.initialized,
      opprefPresent: Boolean(attribution.oppref),
      opprefCookie: attribution.cookieDetected,
      totalEvents: events.length,
      pagesVisitedCount: Math.max(visitedPages.length, 1),
      standardEvents: 0,
      customEvents: 0,
      validEvents: 0,
      warningEvents: 0,
      errorEvents: 0,
      duplicateEvents: 0,
      networkRequestsTracked: network.length,
      dataLayerEventsTracked: dataLayer.length,
      gtmContainersCount: gtmContainers.length,
      piiViolationsCount: 0
    },
    funnel: computeFunnelAnalysis(events),
    capiDeduplication: computeCapiDeduplication(events),
    journeyTable: [],
    eventSummaries: [],
    piiIssues: [],
    gtmContainers: gtmContainers,
    issues: [],
    recommendations: []
  };

  try {
    summary.hostname = new URL(tabState.url).hostname;
  } catch {
    summary.hostname = tabState.url;
  }

  // 1. Pixel Installation Checks
  if (!pixel.detected) {
    summary.overallStatus = 'fail';
    summary.issues.push({
      code: 'PIXEL_NOT_DETECTED',
      severity: 'critical',
      message: 'OpenAI Ads Pixel (oaiq) was not detected on this page.',
      recommendation: 'Install the base snippet <script src="https://bzrcdn.openai.com/sdk/oaiq.min.js"> and call oaiq("init", { pixelId: "..." }).'
    });
  } else if (!pixel.initialized) {
    summary.overallStatus = 'warning';
    summary.issues.push({
      code: 'PIXEL_NOT_INITIALIZED',
      severity: 'warning',
      message: 'Pixel script was detected, but no oaiq("init", ...) call was observed.',
      recommendation: 'Ensure oaiq("init", { pixelId: "<YOUR-PIXEL-ID>" }) is called before sending events.'
    });
  }

  // 2. Attribution oppref Check
  if (!attribution.oppref) {
    summary.issues.push({
      code: 'OPPREF_NOT_DETECTED',
      severity: 'info',
      message: 'No oppref click reference detected in URL or cookie.',
      recommendation: 'oppref is automatically appended to landing URLs when users click OpenAI Ads. Direct/organic visits will not carry this parameter.'
    });
  }

  // 3. Process Events Journey & Count Aggregates
  const eventGroupMap = {};

  events.forEach((evt, idx) => {
    const isCustom = evt.validation && evt.validation.isCustom;
    if (isCustom) {
      summary.scores.customEvents++;
    } else {
      summary.scores.standardEvents++;
    }

    if (evt.isDuplicate) {
      summary.scores.duplicateEvents++;
    }

    if (evt.validation) {
      if (evt.validation.status === 'valid') summary.scores.validEvents++;
      if (evt.validation.status === 'warning') summary.scores.warningEvents++;
      if (evt.validation.status === 'error') {
        summary.scores.errorEvents++;
        summary.overallStatus = 'fail';
      }

      if (Array.isArray(evt.validation.issues)) {
        for (const issue of evt.validation.issues) {
          summary.issues.push(issue);
        }
      }

      if (Array.isArray(evt.validation.piiIssues) && evt.validation.piiIssues.length > 0) {
        summary.scores.piiViolationsCount += evt.validation.piiIssues.length;
        evt.validation.piiIssues.forEach((p) => {
          summary.piiIssues.push(Object.assign({ eventName: evt.displayName || evt.name }, p));
        });
      }
    }

    // Build Journey Row
    summary.journeyTable.push({
      step: idx + 1,
      name: evt.displayName || evt.name,
      canonicalName: evt.name,
      dataShape: evt.validation ? evt.validation.dataShape : 'contents',
      url: evt.url || '/',
      pathname: evt.pathname || '/',
      timestamp: evt.timestamp,
      eventId: evt.eventId || 'Not Sent',
      parameters: evt.parameters || {},
      count: evt.requestCount || 1,
      duplicateStatus: evt.duplicateStatus || 'Correct',
      auditStatus: evt.validation ? evt.validation.status : 'valid'
    });

    // Group for Event Summary Table
    const grpName = evt.name;
    if (!eventGroupMap[grpName]) {
      eventGroupMap[grpName] = {
        name: grpName,
        displayName: evt.displayName || grpName,
        isCustom: isCustom,
        count: 0,
        duplicates: 0,
        uniquePages: new Set()
      };
    }
    eventGroupMap[grpName].count++;
    if (evt.pathname) eventGroupMap[grpName].uniquePages.add(evt.pathname);
    if (evt.isDuplicate) eventGroupMap[grpName].duplicates++;
  });

  // Build Event Summaries
  summary.eventSummaries = Object.values(eventGroupMap).map((grp) => {
    let auditMsg = 'Valid';
    if (grp.duplicates > 0) {
      auditMsg = `${grp.duplicates} duplicate(s) detected`;
    } else if (grp.name === 'page_viewed') {
      auditMsg = `Valid across ${grp.uniquePages.size} page(s)`;
    }
    return {
      name: grp.name,
      displayName: grp.displayName,
      isCustom: grp.isCustom,
      detected: grp.count,
      duplicates: grp.duplicates,
      audit: auditMsg
    };
  });

  // 4. CAPI Deduplication Issues
  if (summary.capiDeduplication.status === 'fail') {
    summary.overallStatus = 'fail';
    summary.issues.push({
      code: 'CAPI_DEDUPLICATION_RISK',
      severity: 'error',
      message: `High risk of double-counting: Missing event_id on ${summary.capiDeduplication.missingEventIdList.join(', ')}.`,
      recommendation: 'Pass a unique event_id on all monetary conversion events (e.g. order ID) to allow server-side deduplication.'
    });
  }

  // Deduplicate issues list
  const uniqueIssues = [];
  const seenCodes = new Set();
  for (const issue of summary.issues) {
    const key = `${issue.code}_${issue.event || ''}_${issue.parameter || ''}`;
    if (!seenCodes.has(key)) {
      seenCodes.add(key);
      uniqueIssues.push(issue);
    }
  }
  summary.issues = uniqueIssues;

  if (summary.scores.errorEvents > 0 && summary.overallStatus !== 'fail') {
    summary.overallStatus = 'fail';
  } else if ((summary.scores.warningEvents > 0 || summary.scores.duplicateEvents > 0 || summary.scores.piiViolationsCount > 0) && summary.overallStatus === 'pass') {
    summary.overallStatus = 'warning';
  }

  return summary;
}
