/**
 * OpenAI Ads Pixel Inspector - Scanner & Full Journey Audit Generator
 */

export function generateAuditReport(tabState) {
  const pixel = tabState.pixel || {};
  const attribution = tabState.attribution || {};
  const events = tabState.events || [];
  const network = tabState.network || [];
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
      networkRequestsTracked: network.length
    },
    journeyTable: [],
    eventSummaries: [],
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
      duplicateStatus: evt.duplicateStatus || '✅ Correct',
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
    let auditMsg = '✅ Valid';
    if (grp.duplicates > 0) {
      auditMsg = `❌ ${grp.duplicates} duplicate(s) detected`;
    } else if (grp.name === 'page_viewed') {
      auditMsg = `✅ Valid across ${grp.uniquePages.size} page(s)`;
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
  } else if ((summary.scores.warningEvents > 0 || summary.scores.duplicateEvents > 0) && summary.overallStatus === 'pass') {
    summary.overallStatus = 'warning';
  }

  return summary;
}
