/**
 * OpenAI Ads Pixel Inspector - Event Store & Journey Engine
 * 
 * Maintains full session journey history across all page navigations and reloads.
 * Implements intelligent action-based duplicate detection (distinguishing intentional repeated actions from double-fires).
 */

import { extractUserInfoFromPayload } from '../network/request-parser.js';

export class EventStore {
  constructor() {
    this.events = [];
    this.duplicates = [];
    this.sessionId = 'SESSION_' + Date.now().toString(36).toUpperCase();
    this.startedAt = Date.now();
  }

  clear() {
    this.events = [];
    this.duplicates = [];
    this.sessionId = 'SESSION_' + Date.now().toString(36).toUpperCase();
    this.startedAt = Date.now();
  }

  /**
   * Add normalized event into session journey and evaluate action duplicates
   */
  addEvent(normalizedEvent) {
    const matched = this.detectActionDuplicate(normalizedEvent);
    
    if (matched) {
      normalizedEvent.isDuplicate = true;
      normalizedEvent.duplicateOf = matched._id;
      normalizedEvent.duplicateReason = matched.reason;
      normalizedEvent.duplicateStatus = '❌ Double Fired / Duplicate';
      
      // Increment request count on matched primary event
      matched.event.requestCount = (matched.event.requestCount || 1) + 1;
      matched.event.duplicateStatus = `❌ Double Fired (${matched.event.requestCount}x)`;
      
      this.duplicates.push({
        event: normalizedEvent,
        matchedWithId: matched.event._id,
        reason: matched.reason,
        timestamp: Date.now()
      });

      // Add audit issue
      if (normalizedEvent.validation) {
        normalizedEvent.validation.issues.push({
          code: 'DUPLICATE_EVENT_DETECTED',
          severity: 'warning',
          event: normalizedEvent.name,
          message: `Event "${normalizedEvent.displayName || normalizedEvent.name}" double-fired on the same user action (${matched.reason}).`,
          recommendation: 'Check your trigger configurations in Google Tag Manager or website JS to ensure this action only fires once per trigger.'
        });
        normalizedEvent.validation.warningsCount++;
        if (normalizedEvent.validation.status === 'valid') {
          normalizedEvent.validation.status = 'warning';
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
   * Action-Based Duplicate Detection
   * Compares Event Name, URL/Pathname, Content/Product, Parameters, and Timestamp
   */
  detectActionDuplicate(newEvent) {
    if (!newEvent.name) return null;
    const windowMs = 3000; // 3.0-second action threshold for accidental double-fires

    for (let i = this.events.length - 1; i >= 0; i--) {
      const existing = this.events[i];
      const timeDiff = Math.abs(newEvent.timestamp - existing.timestamp);

      // Rule 1: Exact matching explicit event_id (Only when event_id was actually sent)
      if (newEvent.eventId && existing.eventId && newEvent.eventId === existing.eventId && newEvent.name === existing.name) {
        return {
          event: existing,
          reason: `Matching Event ID "${newEvent.eventId}"`
        };
      }

      // Rule 2: Same event name on the same URL within 3 seconds with identical content/amount/parameters
      if (existing.name === newEvent.name && timeDiff < windowMs) {
        const samePath = (existing.pathname && newEvent.pathname) ? (existing.pathname === newEvent.pathname) : true;
        
        // Compare contents if present
        const existingParams = JSON.stringify(existing.parameters || {});
        const newParams = JSON.stringify(newEvent.parameters || {});

        if (samePath && existingParams === newParams) {
          return {
            event: existing,
            reason: `Fired ${timeDiff}ms after previous call with identical parameters on ${newEvent.pathname || 'same page'}`
          };
        }

        // Special check for page_viewed: 2 page_viewed calls on the same page load
        if (newEvent.name === 'page_viewed' && samePath) {
          return {
            event: existing,
            reason: `Duplicate page_viewed fired ${timeDiff}ms after initial page load`
          };
        }
      }
    }

    return null;
  }

  /**
   * Retrieve Full Chronological User Journey
   */
  getJourney() {
    return this.events.map((evt, idx) => ({
      step: idx + 1,
      name: evt.displayName || evt.name,
      canonicalName: evt.name,
      dataShape: evt.validation ? evt.validation.dataShape : 'contents',
      url: evt.url || '/',
      pathname: evt.pathname || '/',
      timestamp: evt.timestamp,
      eventId: evt.eventId || 'Not Sent',
      parameters: evt.parameters || {},
      requestCount: evt.requestCount || 1,
      duplicateStatus: evt.duplicateStatus || '✅ Correct',
      auditStatus: evt.validation ? evt.validation.status : 'valid',
      issues: evt.validation ? evt.validation.issues : []
    }));
  }

  /**
   * Summarize Journey by Event Name
   */
  getJourneySummary() {
    const summaryMap = {};
    for (const evt of this.events) {
      const name = evt.name;
      if (!summaryMap[name]) {
        summaryMap[name] = {
          name: name,
          displayName: evt.displayName || name,
          isCustom: evt.validation ? evt.validation.isCustom : false,
          totalDetected: 0,
          uniquePages: new Set(),
          duplicateCount: 0,
          validCount: 0,
          warningCount: 0,
          errorCount: 0
        };
      }
      const entry = summaryMap[name];
      entry.totalDetected++;
      if (evt.pathname) entry.uniquePages.add(evt.pathname);
      if (evt.isDuplicate) entry.duplicateCount++;
      
      const status = evt.validation ? evt.validation.status : 'valid';
      if (status === 'valid') entry.validCount++;
      else if (status === 'warning') entry.warningCount++;
      else if (status === 'error') entry.errorCount++;
    }

    return Object.values(summaryMap).map((entry) => {
      let auditText = '✅ Valid';
      if (entry.duplicateCount > 0) {
        auditText = `❌ ${entry.duplicateCount} duplicate(s) detected`;
      } else if (entry.errorCount > 0) {
        auditText = `❌ ${entry.errorCount} error(s)`;
      } else if (entry.name === 'page_viewed') {
        auditText = `✅ Valid across ${entry.uniquePages.size} page(s)`;
      }
      return {
        name: entry.name,
        displayName: entry.displayName,
        isCustom: entry.isCustom,
        detected: entry.totalDetected,
        duplicateCount: entry.duplicateCount,
        audit: auditText,
        uniquePagesCount: entry.uniquePages.size
      };
    });
  }

  filterEvents({ filter = 'all', query = '' } = {}) {
    return this.events.filter((evt) => {
      // Category filter
      if (filter === 'standard' && evt.validation && evt.validation.isCustom) return false;
      if (filter === 'custom' && evt.validation && !evt.validation.isCustom) return false;
      if (filter === 'errors' && evt.validation && evt.validation.status !== 'error') return false;
      if (filter === 'warnings' && evt.validation && evt.validation.status !== 'warning') return false;
      if (filter === 'duplicates' && !evt.isDuplicate) return false;
      if (filter === 'network' && !evt.network.detected) return false;

      // Text search query
      if (query && query.trim() !== '') {
        const q = query.toLowerCase().trim();
        const nameMatch = (evt.displayName || evt.name).toLowerCase().includes(q);
        const urlMatch = (evt.url || evt.pathname || '').toLowerCase().includes(q);
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters).toLowerCase().includes(q);
        return nameMatch || urlMatch || idMatch || paramsMatch;
      }

      return true;
    });
  }

  correlateNetworkRequest(netReq) {
    const userInfo = netReq.payload ? extractUserInfoFromPayload(netReq.payload) : null;
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

        if (userInfo) {
          evt.network.userInfo = userInfo;
          if (!evt.userInfo) {
            evt.userInfo = userInfo;
          } else {
            const existingKeys = new Set(evt.userInfo.fields.map((f) => f.key));
            for (const f of userInfo.fields) {
              if (!existingKeys.has(f.key)) {
                evt.userInfo.fields.push(f);
                existingKeys.add(f.key);
              }
            }
            evt.userInfo.count = evt.userInfo.fields.length;
            evt.userInfo.hasRawPii = evt.userInfo.hasRawPii || userInfo.hasRawPii;
            evt.userInfo.hasHashedData = evt.userInfo.hasHashedData || userInfo.hasHashedData;
          }
        }
        if (!matchedEvt) matchedEvt = evt;
      }
    }
    return matchedEvt;
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
        `"${evt.duplicateStatus || '✅ Correct'}"`,
        evt.validation ? evt.validation.status.toUpperCase() : 'VALID',
        evt.parameters.amount !== undefined ? evt.parameters.amount : '',
        evt.parameters.currency || '',
        `"${JSON.stringify(evt.parameters).replace(/"/g, '""')}"`,
        `"${evt.attribution.oppref || ''}"`
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
      journey: this.getJourney(),
      summary: this.getJourneySummary(),
      rawEvents: this.events
    }, null, 2);
  }
}
