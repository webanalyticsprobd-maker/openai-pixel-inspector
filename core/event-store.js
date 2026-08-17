/**
 * OpenAI Ads Pixel Inspector - Event Store & Deduplication Engine
 */

export class EventStore {
  constructor() {
    this.events = [];
    this.duplicates = [];
  }

  clear() {
    this.events = [];
    this.duplicates = [];
  }

  addEvent(normalizedEvent) {
    // Check for duplicate events
    const isDuplicate = this.detectDuplicate(normalizedEvent);
    if (isDuplicate) {
      this.duplicates.push({
        event: normalizedEvent,
        matchedWithId: isDuplicate.id,
        timestamp: Date.now()
      });
      normalizedEvent.isDuplicate = true;
      normalizedEvent.duplicateOf = isDuplicate.id;
      normalizedEvent.validation.issues.push({
        code: 'DUPLICATE_EVENT_DETECTED',
        severity: 'warning',
        event: normalizedEvent.name,
        message: `Possible duplicate event "${normalizedEvent.name}" with event ID "${normalizedEvent.eventId}".`,
        recommendation: 'Ensure your tracking setup does not trigger identical measure calls repeatedly on the same action.'
      });
      normalizedEvent.validation.warningsCount++;
      if (normalizedEvent.validation.status === 'valid') {
        normalizedEvent.validation.status = 'warning';
      }
    }

    this.events.push(normalizedEvent);
    return normalizedEvent;
  }

  detectDuplicate(newEvent) {
    if (!newEvent.name) return null;
    const windowMs = 5000; // 5-second window for potential duplicate evaluation
    for (const existing of this.events) {
      // Rule 1: Same custom event_id
      if (newEvent.eventId && existing.eventId === newEvent.eventId && existing.name === newEvent.name) {
        return existing;
      }
      // Rule 2: Same event name and identical parameters within threshold
      if (
        existing.name === newEvent.name &&
        Math.abs(existing.timestamp - newEvent.timestamp) < windowMs &&
        JSON.stringify(existing.parameters) === JSON.stringify(newEvent.parameters)
      ) {
        return existing;
      }
    }
    return null;
  }

  filterEvents({ filter = 'all', query = '' } = {}) {
    return this.events.filter((evt) => {
      // Category filter
      if (filter === 'standard' && evt.validation.isCustom) return false;
      if (filter === 'custom' && !evt.validation.isCustom) return false;
      if (filter === 'errors' && evt.validation.status !== 'error') return false;
      if (filter === 'warnings' && evt.validation.status !== 'warning') return false;
      if (filter === 'network' && !evt.network.detected) return false;

      // Text search query
      if (query && query.trim() !== '') {
        const q = query.toLowerCase().trim();
        const nameMatch = evt.name.toLowerCase().includes(q);
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters).toLowerCase().includes(q);
        return nameMatch || idMatch || paramsMatch;
      }

      return true;
    });
  }

  correlateNetworkRequest(netReq) {
    // Attempt to match outgoing POST network request with captured JS event
    for (let i = this.events.length - 1; i >= 0; i--) {
      const evt = this.events[i];
      // Match by event_id if in payload or within 2 seconds
      if (
        (netReq.payload && netReq.payload.event_id && netReq.payload.event_id === evt.eventId) ||
        (netReq.payload && netReq.payload.name && netReq.payload.name === evt.name) ||
        Math.abs(evt.timestamp - netReq.timestamp) < 2000
      ) {
        evt.network.detected = true;
        evt.network.status = netReq.status || 200;
        evt.network.method = netReq.method || 'POST';
        evt.network.url = netReq.url;
        evt.network.responseTimestamp = netReq.responseTimestamp || Date.now();
        return evt;
      }
    }
    return null;
  }

  exportJSON() {
    return JSON.stringify(this.events, null, 2);
  }

  exportCSV() {
    if (this.events.length === 0) return 'Timestamp,Event Name,Type,Pixel ID,Event ID,Status,Amount,Currency,oppref\n';
    const rows = [
      ['Timestamp', 'Event Name', 'Type', 'Pixel ID', 'Event ID', 'Validation Status', 'Amount', 'Currency', 'oppref']
    ];
    for (const evt of this.events) {
      rows.push([
        new Date(evt.timestamp).toISOString(),
        `"${evt.name}"`,
        evt.validation.isCustom ? 'Custom' : 'Standard',
        `"${evt.pixelId || ''}"`,
        `"${evt.eventId || ''}"`,
        evt.validation.status,
        evt.parameters.amount !== undefined ? evt.parameters.amount : '',
        evt.parameters.currency || '',
        `"${evt.attribution.oppref || ''}"`
      ]);
    }
    return rows.map((r) => r.join(',')).join('\n');
  }
}
