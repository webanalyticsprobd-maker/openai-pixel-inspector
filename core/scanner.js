/**
 * OpenAI Ads Pixel Inspector - Scanner & Audit Report Generator
 */

export function generateAuditReport(tabState) {
  const pixel = tabState.pixel || {};
  const attribution = tabState.attribution || {};
  const events = tabState.events || [];
  const network = tabState.network || [];

  const summary = {
    website: tabState.url || 'Unknown',
    hostname: '',
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
      standardEvents: 0,
      customEvents: 0,
      validEvents: 0,
      warningEvents: 0,
      errorEvents: 0,
      networkRequestsTracked: network.length
    },
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

  // 2. Duplicate Pixel IDs
  if (pixel.pixelIds && pixel.pixelIds.length > 1) {
    summary.issues.push({
      code: 'MULTIPLE_PIXEL_IDS_FOUND',
      severity: 'warning',
      message: `Multiple OpenAI Pixel IDs were detected: ${pixel.pixelIds.join(', ')}.`,
      recommendation: 'Review your tag manager and template configurations to prevent duplicate conversions.'
    });
  }

  // 3. Attribution oppref Check
  if (!attribution.oppref) {
    summary.issues.push({
      code: 'OPPREF_NOT_DETECTED',
      severity: 'info',
      message: 'No oppref click reference detected in URL or cookie.',
      recommendation: 'oppref is automatically appended to URLs when users click OpenAI Ads. It will not be present on direct organic traffic.'
    });
  }

  // 4. Events Aggregation
  for (const evt of events) {
    const isCustom = evt.validation && evt.validation.isCustom;
    if (isCustom) {
      summary.scores.customEvents++;
    } else {
      summary.scores.standardEvents++;
    }

    if (evt.validation) {
      if (evt.validation.status === 'valid') summary.scores.validEvents++;
      if (evt.validation.status === 'warning') summary.scores.warningEvents++;
      if (evt.validation.status === 'error') {
        summary.scores.errorEvents++;
        summary.overallStatus = 'fail';
      }

      // Collect all validation issues
      if (Array.isArray(evt.validation.issues)) {
        for (const issue of evt.validation.issues) {
          summary.issues.push(issue);
        }
      }
    }
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
  } else if (summary.scores.warningEvents > 0 && summary.overallStatus === 'pass') {
    summary.overallStatus = 'warning';
  }

  return summary;
}
