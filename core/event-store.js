/**
 * OpenAI Ads Pixel Inspector - Event Store, Pixel Registry & Multi-Pixel Analyzer
 * 
 * Single source of truth for:
 * 1. Runtime Multi-Pixel Registry
 * 2. Event Lifecycle & Session Journey
 * 3. Same-Pixel Duplicate Detection vs Multi-Pixel Delivery
 * 4. Cross-Pixel Payload Consistency Comparison
 * 5. Documented Audit Score Calculation
 */

import { OFFICIAL_DOCS } from '../validators/schemas.js';

export class EventStore {
  constructor() {
    this.events = [];
    this.duplicates = [];
    this.pixelRegistry = {}; // { [pixelId]: { pixelId, events: [], eventCounts: {}, firstSeen, lastSeen } }
    this.sessionId = 'SESSION_' + Date.now().toString(36).toUpperCase();
    this.startedAt = Date.now();
  }

  clear() {
    this.events = [];
    this.duplicates = [];
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
        firstSeen: timestamp,
        lastSeen: timestamp
      };
    } else {
      this.pixelRegistry[cleanId].lastSeen = timestamp;
    }
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
      normalizedEvent.duplicateStatus = '✅ Correct';
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
   * Correlates network telemetry with store events
   */
  correlateNetworkRequest(netReq) {
    let matchedEvt = null;
    const batchEvents = (netReq.payload && Array.isArray(netReq.payload.events)) ? netReq.payload.events : null;

    for (let i = this.events.length - 1; i >= 0; i--) {
      const evt = this.events[i];
      let isMatch = false;

      if (batchEvents) {
        for (const subEvt of batchEvents) {
          const subType = subEvt.type || subEvt.name;
          const subId = subEvt.id || subEvt.event_id;
          if (
            (subId && evt.eventId && subId === evt.eventId) ||
            (subType && (subType === evt.name || subType === evt.displayName)) ||
            (subEvt.timestamp_ms && Math.abs(evt.timestamp - subEvt.timestamp_ms) < 3000)
          ) {
            isMatch = true;
            if (subId && !evt.eventId) {
              evt.eventId = subId;
            }
            break;
          }
        }
      } else {
        if (
          (netReq.payload && netReq.payload.event_id && evt.eventId && netReq.payload.event_id === evt.eventId) ||
          (netReq.payload && (netReq.payload.name || netReq.payload.event) === evt.name) ||
          Math.abs(evt.timestamp - netReq.timestamp) < 2500
        ) {
          isMatch = true;
        }
      }

      if (isMatch) {
        evt.network.detected = true;
        evt.network.status = netReq.status || 200;
        evt.network.method = netReq.method || 'POST';
        evt.network.url = netReq.url;
        evt.network.payload = netReq.payload;
        evt.network.responseTimestamp = netReq.responseTimestamp || Date.now();

        if (!matchedEvt) matchedEvt = evt;
      }
    }
    return matchedEvt;
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

    // Group events by name across pixels
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

    // Multi-pixel routing analysis (measure vs measureSingle)
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
   * Errors: -15 pts, Warnings: -5 pts, Info/Passed: 0 pts
   * Never penalizes unobserved funnel events.
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

    // Baseline 100
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
      totalEvents: this.events.length
    };
  }

  getJourneySummary() {
    return {
      totalEvents: this.events.length,
      uniqueEventTypes: new Set(this.events.map((e) => e.name)).size,
      pixelsDetected: Object.keys(this.pixelRegistry),
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
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
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
      'Data Type',
      'Page URL',
      'Page Path',
      'Event ID',
      'Pixel ID',
      'Method',
      'Duplicate Status',
      'Audit Status',
      'Amount',
      'Currency',
      'Parameters JSON',
      'oppref'
    ];

    const rows = [headers];
    this.events.forEach((evt, idx) => {
      rows.push([
        idx + 1,
        new Date(evt.timestamp).toISOString(),
        `"${evt.displayName || evt.name}"`,
        evt.validation ? evt.validation.dataShape : 'contents',
        `"${evt.url || ''}"`,
        `"${evt.pathname || ''}"`,
        `"${evt.eventId || 'Not Sent'}"`,
        `"${evt.pixelId || ''}"`,
        `"${evt.source?.method || 'measure'}"`,
        `"${evt.duplicateStatus || '✅ Correct'}"`,
        evt.validation ? evt.validation.status.toUpperCase() : 'VALID',
        evt.parameters.amount !== undefined ? evt.parameters.amount : '',
        evt.parameters.currency || '',
        `"${JSON.stringify(evt.parameters).replace(/"/g, '""')}"`,
        `"${evt.attribution?.oppref || ''}"`
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
      pixelsDetected: Object.keys(this.pixelRegistry),
      multiPixelSummary: this.getMultiPixelSummary(),
      auditScore: this.calculateAuditScore(),
      summary: this.getJourneySummary(),
      rawEvents: this.events
    }, null, 2);
  }
}
