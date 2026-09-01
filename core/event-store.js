/**
 * OpenAI Ads Pixel Inspector - Event Store, Pixel Registry & Multi-Pixel Analyzer
 * 
 * Single source of truth for:
 * 1. Runtime Multi-Pixel Registry
 * 2. Network-First Event Lifecycle & Session Journey
 * 3. Batch Request Processing & Event Classification
 * 4. Same-Pixel Duplicate Detection vs Multi-Pixel Delivery
 * 5. Cross-Pixel Payload Consistency Comparison
 * 6. SDK Diagnostics & User Matching Storage
 * 7. Documented Audit Score Calculation
 */

import { OFFICIAL_DOCS } from '../validators/schemas.js';
import { normalizeEvent } from './normalizer.js';
import { validateEvent } from '../validators/event-validator.js';

export class EventStore {
  constructor() {
    this.events = [];
    this.duplicates = [];
    this.parentRequests = [];
    this.sdkEvents = [];
    this.latestDiagnostics = null;
    this.latestUserMatching = null;
    this.pixelRegistry = {}; // { [pixelId]: { pixelId, events: [], eventCounts: {}, requestsCount: 0, firstSeen, lastSeen } }
    this.sessionId = 'SESSION_' + Date.now().toString(36).toUpperCase();
    this.startedAt = Date.now();
  }

  clear() {
    this.events = [];
    this.duplicates = [];
    this.parentRequests = [];
    this.sdkEvents = [];
    this.latestDiagnostics = null;
    this.latestUserMatching = null;
    this.pixelRegistry = {};
    this.sessionId = 'SESSION_' + Date.now().toString(36).toUpperCase();
    this.startedAt = Date.now();
  }

  /**
   * Register a pixel ID into the multi-pixel runtime registry
   */
  registerPixelId(pixelId, timestamp = Date.now()) {
    if (!pixelId || typeof pixelId !== 'string') return;
    const cleanId = pixelId.trim();
    if (!this.pixelRegistry[cleanId]) {
      this.pixelRegistry[cleanId] = {
        pixelId: cleanId,
        events: [],
        eventCounts: {},
        requestsCount: 0,
        firstSeen: timestamp,
        lastSeen: timestamp
      };
    } else {
      this.pixelRegistry[cleanId].lastSeen = timestamp;
    }
  }

  /**
   * Processes an incoming parsed OpenAI Network Batch
   * 
   * @param {object} batch - { parentRequest, measurementEvents, internalEvents, diagnostics, userMatching }
   * @param {object} tabContext
   */
  addNetworkBatch(batch, tabContext = {}) {
    if (!batch) return;

    if (batch.parentRequest) {
      this.parentRequests.push(batch.parentRequest);
      const pid = batch.parentRequest.pixelId || 'DEFAULT_PIXEL';
      this.registerPixelId(pid, batch.parentRequest.timestamp);
      if (this.pixelRegistry[pid]) {
        this.pixelRegistry[pid].requestsCount = (this.pixelRegistry[pid].requestsCount || 0) + 1;
      }
    }

    if (batch.diagnostics) {
      this.latestDiagnostics = batch.diagnostics;
    }

    if (batch.userMatching) {
      this.latestUserMatching = batch.userMatching;
    }

    if (Array.isArray(batch.internalEvents)) {
      batch.internalEvents.forEach(ie => this.sdkEvents.push(ie));
    }

    if (Array.isArray(batch.measurementEvents)) {
      batch.measurementEvents.forEach(mEvt => {
        // Correlate with existing event or add as a new network event
        const matched = this.correlateNetworkEvent(mEvt);
        if (!matched) {
          const normalized = normalizeEvent({
            name: mEvt.name,
            parameters: mEvt.parameters,
            pixelId: mEvt.pixelId || batch.parentRequest?.pixelId || null,
            sdkEventId: mEvt.sdkEventId,
            sourceUrl: mEvt.sourceUrl,
            referrerUrl: mEvt.referrerUrl,
            optOut: mEvt.optOut,
            parentRequestId: mEvt.parentRequestId,
            userInfo: mEvt.userInfo || batch.userMatching,
            timestamp: mEvt.timestamp,
            source: {
              type: 'network',
              location: 'browser_network_request',
              caller: 'Browser Network Request (bzr.openai.com)'
            },
            network: {
              detected: true,
              status: 200,
              method: 'POST',
              url: batch.parentRequest?.requestUrl || 'bzr.openai.com/v1/sdk/events',
              payload: mEvt.data
            }
          }, tabContext);

          this.addEvent(normalized);
        }
      });
    }
  }

  /**
   * Correlates an incoming network measurement event with an existing JS-intercepted event
   */
  correlateNetworkEvent(netEvt) {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const evt = this.events[i];
      const timeDiff = Math.abs(evt.timestamp - netEvt.timestamp);

      if (timeDiff < 3500 && evt.name === netEvt.name) {
        // If not yet correlated with a network request, correlate it
        if (!evt.network || !evt.network.detected || evt.evidence !== 'Browser Network Request') {
          evt.evidence = 'Browser Network Request';
          evt.jsObserved = true;
          evt.sdkEventId = netEvt.sdkEventId;
          evt.sourceUrl = netEvt.sourceUrl || evt.url;
          evt.referrerUrl = netEvt.referrerUrl;
          evt.optOut = netEvt.optOut;
          evt.parentRequestId = netEvt.parentRequestId;
          evt.network.detected = true;
          evt.network.status = 200;
          evt.network.method = 'POST';
          evt.network.payload = netEvt.parameters;
          evt.duplicateStatus = '✅ Sent (Network Request)';

          // Update parameters and user info to actual network payload and re-run validation on network data
          evt.parameters = netEvt.parameters;
          evt.userInfo = netEvt.userInfo || evt.userInfo;
          evt.validation = validateEvent(evt);

          return evt;
        }
      }
    }
    return null;
  }

  /**
   * Add normalized event into session journey, update pixel registry, and evaluate duplicates
   */
  addEvent(normalizedEvent) {
    const pixelId = normalizedEvent.pixelId || 'DEFAULT_PIXEL';
    this.registerPixelId(pixelId, normalizedEvent.timestamp);

    // Update Pixel Registry stats
    if (this.pixelRegistry[pixelId]) {
      this.pixelRegistry[pixelId].events.push(normalizedEvent);
      this.pixelRegistry[pixelId].eventCounts[normalizedEvent.name] = (this.pixelRegistry[pixelId].eventCounts[normalizedEvent.name] || 0) + 1;
      this.pixelRegistry[pixelId].lastSeen = normalizedEvent.timestamp;
    }

    // Evaluate duplicates & multi-pixel delivery
    const duplicateMatch = this.detectActionDuplicate(normalizedEvent);

    if (duplicateMatch) {
      if (duplicateMatch.type === 'same_pixel_duplicate') {
        normalizedEvent.isDuplicate = true;
        normalizedEvent.duplicateOf = duplicateMatch.event._id;
        normalizedEvent.duplicateReason = duplicateMatch.reason;
        normalizedEvent.duplicateStatus = '⚠️ Possible Duplicate';

        duplicateMatch.event.requestCount = (duplicateMatch.event.requestCount || 1) + 1;
        duplicateMatch.event.duplicateStatus = `⚠️ Possible Duplicate (${duplicateMatch.event.requestCount}x)`;

        this.duplicates.push({
          event: normalizedEvent,
          matchedWithId: duplicateMatch.event._id,
          reason: duplicateMatch.reason,
          timestamp: Date.now()
        });

        if (normalizedEvent.validation) {
          normalizedEvent.validation.findings.push({
            severity: 'warning',
            category: 'duplicate',
            eventName: normalizedEvent.name,
            pixelId: pixelId,
            path: 'event',
            code: 'POSSIBLE_DUPLICATE_EVENT',
            title: 'Possible Duplicate Event',
            detected: `Fired ${duplicateMatch.timeDiff}ms after previous call`,
            expected: 'Single event execution per user trigger',
            message: `Event "${normalizedEvent.displayName || normalizedEvent.name}" fired multiple times in close succession on pixel "${pixelId}" (${duplicateMatch.reason}).`,
            documentationReference: OFFICIAL_DOCS.MEASUREMENT_PIXEL,
            recommendedFix: 'Check trigger rules in Tag Manager or JS event listeners to prevent accidental multiple executions.'
          });
          normalizedEvent.validation.warningsCount++;
          if (normalizedEvent.validation.status === 'valid') {
            normalizedEvent.validation.status = 'warning';
          }
        }
      } else if (duplicateMatch.type === 'multi_pixel_delivery') {
        normalizedEvent.isMultiPixelDelivery = true;
        normalizedEvent.multiPixelPartner = duplicateMatch.event._id;
        normalizedEvent.duplicateStatus = 'ℹ️ Multi-Pixel Broadcast';

        // Check if payloads between the two pixels match
        const payloadDiff = this.comparePayloads(duplicateMatch.event, normalizedEvent);
        if (payloadDiff.hasMismatch && normalizedEvent.validation) {
          normalizedEvent.validation.findings.push({
            severity: 'warning',
            category: 'multi_pixel',
            eventName: normalizedEvent.name,
            pixelId: pixelId,
            path: payloadDiff.mismatchedKeys.join(', '),
            code: 'MULTI_PIXEL_PAYLOAD_MISMATCH',
            title: 'Inconsistent Multi-Pixel Event Payload',
            detected: JSON.stringify(normalizedEvent.parameters),
            expected: JSON.stringify(duplicateMatch.event.parameters),
            message: `The same event "${normalizedEvent.name}" was sent to multiple pixels with inconsistent payloads (${payloadDiff.summary}).`,
            documentationReference: OFFICIAL_DOCS.MULTIPLE_PIXELS,
            recommendedFix: 'Align parameters between all initialized Pixel IDs for consistent data quality.'
          });
          normalizedEvent.validation.warningsCount++;
          if (normalizedEvent.validation.status === 'valid') {
            normalizedEvent.validation.status = 'warning';
          }
        }
      }
    } else {
      normalizedEvent.isDuplicate = false;
      normalizedEvent.requestCount = 1;
      if (!normalizedEvent.duplicateStatus || normalizedEvent.duplicateStatus.includes('Awaiting')) {
        normalizedEvent.duplicateStatus = normalizedEvent.evidence === 'Browser Network Request' ? '✅ Sent (Network Request)' : '⏳ Awaiting Network Transmission';
      }
    }

    this.events.push(normalizedEvent);
    return normalizedEvent;
  }

  /**
   * Distinguishes Same-Pixel Duplicates from Multi-Pixel Delivery
   */
  detectActionDuplicate(newEvent) {
    if (!newEvent.name) return null;
    const windowMs = 3000;

    for (let i = this.events.length - 1; i >= 0; i--) {
      const existing = this.events[i];
      const timeDiff = Math.abs(newEvent.timestamp - existing.timestamp);

      if (timeDiff > windowMs) continue;

      if (existing.name === newEvent.name) {
        const samePixel = (existing.pixelId === newEvent.pixelId);
        const samePath = (existing.pathname && newEvent.pathname) ? (existing.pathname === newEvent.pathname) : true;

        if (samePixel) {
          // Same Pixel Duplicate Check
          if (newEvent.eventId && existing.eventId && newEvent.eventId === existing.eventId) {
            return {
              type: 'same_pixel_duplicate',
              event: existing,
              timeDiff: timeDiff,
              reason: `Matching Event ID "${newEvent.eventId}"`
            };
          }

          const existingParams = JSON.stringify(existing.parameters || {});
          const newParams = JSON.stringify(newEvent.parameters || {});

          if (samePath && existingParams === newParams) {
            return {
              type: 'same_pixel_duplicate',
              event: existing,
              timeDiff: timeDiff,
              reason: `Fired ${timeDiff}ms after previous call with identical parameters on ${newEvent.pathname || 'same page'}`
            };
          }

          if (newEvent.name === 'page_viewed' && samePath) {
            return {
              type: 'same_pixel_duplicate',
              event: existing,
              timeDiff: timeDiff,
              reason: `Duplicate page_viewed fired ${timeDiff}ms after initial page load`
            };
          }
        } else {
          // Multi-Pixel Delivery Check (Same user action broadcast to different Pixel IDs)
          return {
            type: 'multi_pixel_delivery',
            event: existing,
            timeDiff: timeDiff,
            reason: `Broadcast to ${existing.pixelId} and ${newEvent.pixelId}`
          };
        }
      }
    }

    return null;
  }

  /**
   * Compares payloads between two events sent to different pixels
   */
  comparePayloads(eventA, eventB) {
    const paramsA = eventA.parameters || {};
    const paramsB = eventB.parameters || {};
    const allKeys = Array.from(new Set([...Object.keys(paramsA), ...Object.keys(paramsB)]));

    const mismatchedKeys = [];
    const diffs = [];

    for (const key of allKeys) {
      const valA = paramsA[key];
      const valB = paramsB[key];

      const strA = JSON.stringify(valA);
      const strB = JSON.stringify(valB);

      if (strA !== strB) {
        mismatchedKeys.push(key);
        diffs.push(`${key}: [Pixel ${eventA.pixelId || 'A'}: ${strA}] vs [Pixel ${eventB.pixelId || 'B'}: ${strB}]`);
      }
    }

    return {
      hasMismatch: mismatchedKeys.length > 0,
      mismatchedKeys: mismatchedKeys,
      diffs: diffs,
      summary: diffs.join(', ')
    };
  }

  /**
   * Returns Multi-Pixel Summary Analysis
   */
  getMultiPixelSummary() {
    const pixelIds = Object.keys(this.pixelRegistry);
    if (pixelIds.length <= 1) {
      return {
        multiplePixelsDetected: false,
        pixelCount: pixelIds.length,
        pixels: pixelIds,
        sharedEvents: [],
        uniqueEventsByPixel: {},
        routingAnalysis: [],
        payloadMismatches: []
      };
    }

    const eventsByPixel = {};
    pixelIds.forEach((pid) => {
      eventsByPixel[pid] = new Set(this.pixelRegistry[pid].events.map((e) => e.name));
    });

    const allEventNames = Array.from(new Set(this.events.map((e) => e.name)));
    const sharedEvents = allEventNames.filter((name) => pixelIds.every((pid) => eventsByPixel[pid]?.has(name)));

    const uniqueEventsByPixel = {};
    pixelIds.forEach((pid) => {
      const otherPixels = pixelIds.filter((p) => p !== pid);
      uniqueEventsByPixel[pid] = Array.from(eventsByPixel[pid] || []).filter((name) => !otherPixels.some((op) => eventsByPixel[op]?.has(name)));
    });

    const routingAnalysis = this.events.map((e) => ({
      eventName: e.name,
      timestamp: e.timestamp,
      method: e.source?.method || 'measure',
      targetPixelId: e.targetPixelId || e.pixelId,
      recipients: e.recipients || (e.pixelId ? [e.pixelId] : [])
    }));

    return {
      multiplePixelsDetected: true,
      pixelCount: pixelIds.length,
      pixels: pixelIds,
      pixelRegistry: this.pixelRegistry,
      sharedEvents: sharedEvents,
      uniqueEventsByPixel: uniqueEventsByPixel,
      routingAnalysis: routingAnalysis
    };
  }

  /**
   * Calculates professional Audit Health Score (0–100) based strictly on findings
   */
  calculateAuditScore() {
    let errorCount = 0;
    let warningCount = 0;

    for (const evt of this.events) {
      if (evt.validation) {
        errorCount += evt.validation.errorsCount || 0;
        warningCount += evt.validation.warningsCount || 0;
      }
    }

    const penalty = (errorCount * 15) + (warningCount * 5);
    const score = Math.max(0, Math.min(100, 100 - penalty));

    let grade = 'A';
    let statusText = 'Excellent';

    if (score >= 90) { grade = 'A'; statusText = 'Excellent'; }
    else if (score >= 75) { grade = 'B'; statusText = 'Good'; }
    else if (score >= 60) { grade = 'C'; statusText = 'Needs Attention'; }
    else if (score >= 40) { grade = 'D'; statusText = 'Poor'; }
    else { grade = 'F'; statusText = 'Critical Action Required'; }

    return {
      score: score,
      grade: grade,
      statusText: statusText,
      errorsCount: errorCount,
      warningsCount: warningCount,
      totalEvents: this.events.length,
      networkRequestsCount: this.parentRequests.length
    };
  }

  getNetworkActivitySummary() {
    const pixelIds = Object.keys(this.pixelRegistry);
    const perPixelSummary = {};
    pixelIds.forEach(pid => {
      perPixelSummary[pid] = {
        requestsCount: this.pixelRegistry[pid].requestsCount || 0,
        eventCounts: this.pixelRegistry[pid].eventCounts || {}
      };
    });

    return {
      totalNetworkRequests: this.parentRequests.length,
      totalEventsSent: this.events.filter(e => e.evidence === 'Browser Network Request').length,
      totalSdkEvents: this.sdkEvents.length,
      uniqueEventsCount: new Set(this.events.map(e => e.name)).size,
      pixelsCount: pixelIds.length,
      pixels: pixelIds,
      perPixelSummary: perPixelSummary,
      latestDiagnostics: this.latestDiagnostics,
      latestUserMatching: this.latestUserMatching
    };
  }

  getJourneySummary() {
    return {
      totalEvents: this.events.length,
      uniqueEventTypes: new Set(this.events.map((e) => e.name)).size,
      pixelsDetected: Object.keys(this.pixelRegistry),
      networkSummary: this.getNetworkActivitySummary(),
      multiPixelSummary: this.getMultiPixelSummary(),
      auditScore: this.calculateAuditScore(),
      duplicateCount: this.duplicates.length,
      startedAt: this.startedAt,
      durationMs: Date.now() - this.startedAt
    };
  }

  getFilteredEvents(filter = 'all', query = '', selectedPixel = 'all') {
    return this.events.filter((evt) => {
      // Pixel ID filter
      if (selectedPixel && selectedPixel !== 'all') {
        if (evt.pixelId !== selectedPixel) return false;
      }

      // Status filter
      if (filter === 'standard') {
        if (evt.validation?.isCustom) return false;
      } else if (filter === 'custom') {
        if (!evt.validation?.isCustom) return false;
      } else if (filter === 'errors') {
        if (!evt.validation || evt.validation.status !== 'error') return false;
      } else if (filter === 'warnings') {
        if (!evt.validation || evt.validation.status !== 'warning') return false;
      } else if (filter === 'duplicates') {
        if (!evt.isDuplicate) return false;
      } else if (filter === 'passed') {
        if (!evt.validation || evt.validation.status !== 'valid') return false;
      }

      // Search query
      if (query && query.trim() !== '') {
        const q = query.toLowerCase().trim();
        const nameMatch = (evt.displayName || evt.name).toLowerCase().includes(q);
        const urlMatch = (evt.url || evt.pathname || '').toLowerCase().includes(q);
        const idMatch = (evt.eventId || evt.sdkEventId || '').toLowerCase().includes(q);
        const pixelMatch = (evt.pixelId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters || {}).toLowerCase().includes(q);
        const findingsMatch = evt.validation?.findings?.some((f) => f.code.toLowerCase().includes(q) || f.message.toLowerCase().includes(q));

        return nameMatch || urlMatch || idMatch || pixelMatch || paramsMatch || findingsMatch;
      }

      return true;
    });
  }

  exportCSV() {
    const headers = [
      'Step',
      'Timestamp',
      'Event Name',
      'Evidence',
      'Pixel ID',
      'SDK Event ID',
      'Advertiser Event ID',
      'Data Type',
      'Page URL',
      'Duplicate Status',
      'Audit Status',
      'Amount',
      'Currency',
      'Parameters JSON'
    ];

    const rows = [headers];
    this.events.forEach((evt, idx) => {
      rows.push([
        idx + 1,
        new Date(evt.timestamp).toISOString(),
        `"${evt.displayName || evt.name}"`,
        `"${evt.evidence || 'Browser Network Request'}"`,
        `"${evt.pixelId || ''}"`,
        `"${evt.sdkEventId || ''}"`,
        `"${evt.eventId || 'Not Sent'}"`,
        evt.validation ? evt.validation.dataShape : 'contents',
        `"${evt.url || ''}"`,
        `"${evt.duplicateStatus || '✅ Correct'}"`,
        evt.validation ? evt.validation.status.toUpperCase() : 'VALID',
        evt.parameters.amount !== undefined ? evt.parameters.amount : '',
        evt.parameters.currency || '',
        `"${JSON.stringify(evt.parameters).replace(/"/g, '""')}"`
      ]);
    });

    return rows.map((r) => r.join(',')).join('\n');
  }

  exportJSON() {
    return JSON.stringify({
      sessionId: this.sessionId,
      startedAt: new Date(this.startedAt).toISOString(),
      exportedAt: new Date().toISOString(),
      totalEvents: this.events.length,
      networkActivity: this.getNetworkActivitySummary(),
      pixelsDetected: Object.keys(this.pixelRegistry),
      multiPixelSummary: this.getMultiPixelSummary(),
      auditScore: this.calculateAuditScore(),
      summary: this.getJourneySummary(),
      rawEvents: this.events,
      sdkEvents: this.sdkEvents,
      parentRequests: this.parentRequests
    }, null, 2);
  }
}
