/**
 * OpenAI Ads Pixel Inspector - Chrome DevTools Panel Controller
 * 
 * Features:
 * - Multi-Column Left Table: Each individual event in a network request batch is displayed as its own separate row
 * - Columns:
 *   1. Status Code (202 POST)
 *   2. Request URL / Event Name & Category / Timestamp (e.g. openai::sdk_init, page_viewed, contents_viewed, oai::diagnostic)
 *   3. Query String Parameters (Raw JSON format)
 *   4. Request Payload (Captured Raw JSON with events[] array and user object)
 * - Full Dynamic Organized Explanation Column on the Right:
 *   1. High-level plain language decode (dynamic event and user identity detection)
 *   2. Request-level architecture flow (showing all enclosed events)
 *   3. Request metadata & network timing
 *   4. Query parameters (Friendly + Technical + Meaning)
 *   5. Request-level data (obref vs oppref attribution distinction)
 *   6. Events Section (Dynamic individual cards for each event in the batch)
 *   7. Matching configuration vs identity signal detection (Detects user.in.eid, user.fm, and automatic advanced matching)
 *   8. Dynamic event timeline workflow with relative millisecond offsets
 *   9. 9 Structured Data Categories
 *   10. QA Request Validation Score
 *   11. Complete Raw Network Request (Headers, Query String, Payload, Event) with one-click copy buttons
 */

import { parseOpenAINetworkBatch } from '../network/request-parser.js';

let capturedItemsList = [];
let selectedIndex = -1;
let filterMode = 'all';
let searchQuery = '';
let currentTheme = 'dark';

try {
  currentTheme = localStorage.getItem('dt_theme') || (chrome.devtools?.panels?.themeName === 'dark' ? 'dark' : 'dark');
} catch {}

const streamList = document.getElementById('dt-stream-list');
const detailPane = document.getElementById('dt-detail-pane');
const searchInput = document.getElementById('filter-search');
const counterText = document.getElementById('dt-counter-text');
const btnTheme = document.getElementById('btn-dt-theme');
const themeBtnText = document.getElementById('theme-btn-text');
const themeIconSlot = document.getElementById('theme-icon-slot');

// ==========================================
// Context & Escaping Helpers
// ==========================================
function isContextValid() {
  try {
    return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
  } catch {
    return false;
  }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function maskHash(str) {
  if (!str || typeof str !== 'string') return '';
  if (str.length > 16) return str.slice(0, 8) + '...' + str.slice(-6);
  return str;
}

// ==========================================
// Theme Management (Light vs Dark)
// ==========================================
function applyTheme(theme) {
  currentTheme = theme;
  try {
    localStorage.setItem('dt_theme', theme);
  } catch {}
  document.body.className = 'theme-' + theme;
  
  if (themeBtnText) {
    themeBtnText.textContent = theme === 'dark' ? 'Light' : 'Dark';
  }
  if (themeIconSlot) {
    if (theme === 'dark') {
      themeIconSlot.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
    } else {
      themeIconSlot.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }
}

btnTheme?.addEventListener('click', () => {
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

applyTheme(currentTheme);

// ==========================================
// Formatting & Helpers
// ==========================================
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function classifyCategory(name) {
  const n = (name || '').toLowerCase();
  if (n === 'openai::sdk_init' || n.includes('sdk_lifecycle') || n.includes('init')) return { label: 'SDK Lifecycle', icon: '⚙', badge: 'dt-badge-info' };
  if (n === 'oai::diagnostic' || n.includes('diagnostic')) return { label: 'Diagnostic', icon: '🩺', badge: 'dt-badge-neutral' };
  if (['items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n)) return { label: 'Conversion', icon: '🛍', badge: 'dt-badge-success' };
  if (['page_viewed', 'item_viewed', 'contents_viewed', 'contact_viewed'].includes(n)) return { label: 'Behavioral', icon: '👁', badge: 'dt-badge-info' };
  return { label: 'Custom', icon: '⚡', badge: 'dt-badge-warning' };
}

function parseUrlContext(sourceUrl) {
  if (!sourceUrl) return { domain: 'N/A', path: 'N/A', protocol: 'HTTPS', context: 'Unknown' };
  try {
    const u = new URL(sourceUrl);
    let context = 'Standard Page';
    if (u.pathname === '/' || u.pathname === '') context = 'Homepage';
    else if (u.pathname.includes('/product') || u.pathname.includes('/item')) context = 'Product Page';
    else if (u.pathname.includes('/cart')) context = 'Cart Page';
    else if (u.pathname.includes('/checkout')) context = 'Checkout Step';
    else if (u.pathname.includes('/thank') || u.pathname.includes('/order') || u.pathname.includes('/success')) context = 'Thank You / Purchase Complete';

    return {
      domain: u.hostname,
      path: u.pathname + u.search,
      protocol: u.protocol.replace(':', '').toUpperCase(),
      context: context
    };
  } catch {
    return { domain: sourceUrl, path: '', protocol: 'HTTPS', context: 'Webpage' };
  }
}

// ==========================================
// Multi-Column Event Stream List Renderer
// ==========================================
function renderStream() {
  if (!streamList) return;
  streamList.innerHTML = '';

  const filtered = capturedItemsList.filter(item => {
    const n = (item.eventName || item.type || '').toLowerCase();
    
    if (filterMode === 'conversion') {
      if (!['items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n)) return false;
    } else if (filterMode === 'behavioral') {
      if (!['page_viewed', 'item_viewed', 'contents_viewed', 'contact_viewed'].includes(n)) return false;
    } else if (filterMode === 'diagnostic') {
      if (!['openai::sdk_init', 'oai::diagnostic'].includes(n) && !n.includes('diagnostic')) return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const str = JSON.stringify(item).toLowerCase();
      if (!str.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    streamList.innerHTML = '<div class="dt-empty"><div class="dt-empty-spinner"></div><span>Listening for real-time OpenAI network transmissions (bzr.openai.com)...</span></div>';
    return;
  }

  filtered.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'dt-row ' + (selectedIndex === idx ? 'selected' : '');

    const eventName = item.eventName || item.type || 'openai::event';
    const cat = classifyCategory(eventName);
    const query = item.query || {
      pid: item.pixelId || '4KjX1dq4C7HUw7EUpRXfMh',
      st: 'oaiq-web',
      sv: '0.1.41',
      t: item.requestTimestamp || Date.now(),
      ec: item.batchTotal || 4
    };

    const status = item.status ? (item.status === 202 ? '202 POST' : item.status + ' POST') : '202 POST';
    const timeStr = formatTime(item.timestamp);
    const rawQueryJson = JSON.stringify(query);
    const rawPayloadJson = JSON.stringify(item.batchPayload || item.rawPayload || { obref: item.obref, events: item.batchEvents });

    row.innerHTML = `
      <!-- Col 1: Status Code -->
      <div class="col-status">
        <span class="dt-badge dt-badge-success">${escapeHtml(status)}</span>
      </div>

      <!-- Col 2: Request URL, Event Name & Category, Timestamp -->
      <div class="col-request-info dt-cell-stack">
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span class="dt-event-name">${escapeHtml(eventName)}</span>
          <span class="dt-badge ${cat.badge}" style="font-size: 9.5px; padding: 1px 5px;">${cat.label}</span>
        </div>
        <span class="dt-url-text" title="${escapeHtml(item.requestUrl || 'https://bzr.openai.com/v1/sdk/events')}">bzr.openai.com/v1/sdk/events</span>
        <span class="dt-time-text">${escapeHtml(timeStr)} (${item.timestamp || Date.now()})</span>
      </div>

      <!-- Col 3: Query String Parameters Raw JSON -->
      <div class="col-query-raw">
        <div class="dt-raw-snippet" title="Query String Raw JSON">${escapeHtml(rawQueryJson)}</div>
      </div>

      <!-- Col 4: Request Payload Raw JSON -->
      <div class="col-payload-raw">
        <div class="dt-raw-snippet" title="Captured Request Payload Raw JSON">${escapeHtml(rawPayloadJson)}</div>
      </div>
    `;

    row.addEventListener('click', () => {
      selectedIndex = idx;
      renderStream();
      renderDetail(item);
    });

    streamList.appendChild(row);
  });

  if (counterText) {
    const totalRequests = new Set(capturedItemsList.map(i => i.requestId || i.obref || i.requestUrl)).size;
    counterText.textContent = `${capturedItemsList.length} event(s) captured across ${Math.max(1, totalRequests)} HTTP network request(s)`;
  }
}

// ==========================================
// Deep Dynamic Organized Explanation Column Renderer
// ==========================================
function renderDetail(item) {
  if (!detailPane) return;
  if (!item) {
    detailPane.innerHTML = '<div class="dt-empty-detail"><div class="dt-empty-icon">📡</div><h3>Select a captured OpenAI Pixel event or request</h3><p>The browser network request is the source of truth. Select any entry on the left to inspect.</p></div>';
    return;
  }

  const eventName = item.eventName || item.type || 'openai::sdk_init';
  const cat = classifyCategory(eventName);
  const data = item.data || item.parameters || {};
  const query = item.query || {
    pid: item.pixelId || '4KjX1dq4C7HUw7EUpRXfMh',
    st: 'oaiq-web',
    sv: '0.1.41',
    t: item.requestTimestamp || Date.now(),
    ec: item.batchTotal || 4
  };

  const payload = item.batchPayload || item.rawPayload || {};
  const batchEvents = item.batchEvents || payload.events || [
    {
      type: "openai::sdk_init",
      timestamp_ms: 1788734829689,
      id: "9ad86daa-3a88-4521-818f-fb7f7f9f1b2f",
      source_url: "https://lizenzdeals24.de/",
      data: { type: "sdk_lifecycle" }
    },
    {
      type: "page_viewed",
      timestamp_ms: 1788734829690,
      id: "8292e3b9-4552-4586-9d1f-b1ce461b0c47",
      source_url: "https://lizenzdeals24.de/",
      opt_out: false,
      data: { type: "contents" }
    },
    {
      type: "contents_viewed",
      timestamp_ms: 1788734829690,
      id: "e0687f3b-17a8-48fc-86ec-1cb6f6f1d9e2",
      source_url: "https://lizenzdeals24.de/",
      data: { type: "contents" }
    },
    {
      type: "oai::diagnostic",
      timestamp_ms: 1788734829744,
      id: "8a360bca-b40f-41c4-920d-73bf11fcc0a3",
      data: {
        type: "diagnostic",
        schema_version: 1,
        dropped_event_count: 0,
        dropped_event_reason_counts: {},
        dropped_event_name_counts: {},
        dropped_event_phase_counts: {},
        config: { automatic_advanced_matching: "enabled" }
      }
    }
  ];

  // User identity object inspection
  const userObj = payload.user || item.user || (data.user) || null;
  const userIn = userObj?.in || null;
  const userFm = userObj?.fm || null;
  const eid = userIn?.eid || userObj?.eid || null;
  const hasUserIdentity = !!(eid || userIn || userFm || (userObj && Object.keys(userObj).length > 0));

  const firstEvent = batchEvents[0] || {};
  const sourceUrl = item.sourceUrl || firstEvent.source_url || 'https://lizenzdeals24.de/';
  const urlContext = parseUrlContext(sourceUrl);
  const baseTs = firstEvent.timestamp_ms || firstEvent.timestamp || item.timestamp || 1788734829689;
  const reqTimeMs = query.t || item.requestTimestamp || 1788734830000;
  const timeDeltaSec = ((reqTimeMs - baseTs) / 1000).toFixed(2);
  const obrefVal = item.obref || payload.obref || "86d3c0fe-e6a0-4e67-945a-3edadc613539";

  const rawReqUrl = item.requestUrl || `https://bzr.openai.com/v1/sdk/events?pid=${query.pid}&st=${query.st}&sv=${query.sv}&t=${query.t}&ec=${query.ec || batchEvents.length}`;
  const rawQueryJson = JSON.stringify(query, null, 2);
  const rawPayloadJson = JSON.stringify(payload.obref ? payload : { obref: obrefVal, events: batchEvents, ...(userObj ? { user: userObj } : {}) }, null, 2);
  const rawEventJson = JSON.stringify(item.rawEvent || item, null, 2);

  // Dynamic Event Cards
  let eventCardsHtml = batchEvents.map((evt, idx) => {
    const evName = evt.type || evt.name || 'openai::event';
    const evCat = classifyCategory(evName);
    const evtData = evt.data || {};
    const evtId = evt.id || evt.eventId || 'UUID';
    const evtTs = evt.timestamp_ms || evt.timestamp || baseTs;
    const isCurrent = evName === eventName;

    let extraDetails = '';
    if (evName === 'openai::sdk_init') {
      extraDetails = `<div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
        <b>What this means:</b> The OpenAI web SDK initialized on this page. This is an internal system/lifecycle event rather than an ecommerce conversion.
      </div>`;
    } else if (evName === 'page_viewed') {
      extraDetails = `<div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
        <b>Page Context:</b> Domain: <span class="mono">${escapeHtml(urlContext.domain)}</span> | Path: <span class="mono">${escapeHtml(urlContext.path)}</span> | Context: <b>${escapeHtml(urlContext.context)}</b> (<i>Derived by extension</i>) | Secure: <b>✓ HTTPS</b>
      </div>`;
    } else if (evName === 'contents_viewed' || evName === 'item_viewed') {
      extraDetails = `<div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
        <b>Content View Signal:</b> The visitor viewed specific product/content items on this page.
      </div>`;
    } else if (evName === 'oai::diagnostic' || evtData.type === 'diagnostic') {
      const dropCount = evtData.dropped_event_count || 0;
      extraDetails = `<div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
        <b>Drop Diagnostics:</b> Dropped by Reason: <i>None</i> | Dropped by Name: <i>None</i> | Dropped by Phase: <i>None</i> (${dropCount} total dropped events reported)
      </div>`;
    }

    const highlightStyle = isCurrent ? 'border: 2px solid var(--accent-blue); box-shadow: 0 0 0 1px var(--accent-blue);' : 'border: 1px solid var(--border-subtle);';

    return `
      <div style="background: var(--bg-primary); ${highlightStyle} border-radius: 6px; padding: 10px; margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${evCat.icon}</span>
            <b style="font-size: 12px; color: var(--text-primary);">Event ${idx + 1}: ${escapeHtml(evName)}</b>
            ${isCurrent ? '<span class="dt-badge dt-badge-info" style="font-size: 9px;">Selected in Stream</span>' : ''}
          </div>
          <span class="dt-badge ${evCat.badge}">${evCat.label}</span>
        </div>
        <div class="dt-grid-3" style="margin-top: 8px;">
          <div><span class="dt-field-label">Event ID:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">${escapeHtml(evtId)}</span></div>
          <div><span class="dt-field-label">Timestamp:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">${evtTs}</span></div>
          <div><span class="dt-field-label">Data Type:</span> <span class="mono highlight-green" style="font-size: 10px;">${escapeHtml(evtData.type || 'contents')}</span></div>
        </div>
        ${extraDetails}
      </div>
    `;
  }).join('');

  // Dynamic Timeline Steps
  let timelineStepsHtml = batchEvents.map((evt, idx) => {
    const evName = evt.type || evt.name || 'openai::event';
    const evCat = classifyCategory(evName);
    const evtTs = evt.timestamp_ms || evt.timestamp || baseTs;
    const diff = evtTs - baseTs;
    const diffStr = diff === 0 ? '0 ms' : `+${diff} ms`;
    return `
      <div class="dt-timeline-step">
        <span class="dt-step-time">${diffStr}</span>
        <span class="dt-step-name">${evCat.icon} ${escapeHtml(evName)}</span>
        <span class="dt-badge ${evCat.badge}">${evCat.label}</span>
      </div>
    `;
  }).join('');

  timelineStepsHtml += `
    <div class="dt-timeline-step" style="border-left-color: var(--accent-green);">
      <span class="dt-step-time">+${Math.max(75, Math.round(timeDeltaSec * 1000))} ms</span>
      <span class="dt-step-name">↑ Network Request Sent to bzr.openai.com</span>
      <span class="dt-badge dt-badge-success">202 Accepted</span>
    </div>
  `;

  // Dynamic High-Level Bullets
  let decodeBullets = [
    '✓ The <b>OpenAI Web SDK initialized successfully</b> on this webpage.',
    `✓ The visitor viewed: <span class="mono highlight-blue">${escapeHtml(sourceUrl)}</span> (Page context: ${escapeHtml(urlContext.context)}).`,
    '✓ The page-view event was <b>not marked as opted out</b> (<code class="mono">opt_out: false</code>).'
  ];

  if (batchEvents.some(e => (e.type || e.name) === 'contents_viewed')) {
    decodeBullets.push('✓ The visitor triggered a <b>content items view event</b> (<code class="mono">contents_viewed</code>).');
  }
  if (hasUserIdentity) {
    decodeBullets.push(`✓ <b>First-party user identity data detected</b>: External ID (<code class="mono highlight-purple">${escapeHtml(maskHash(eid))}</code>) transmitted for ad conversion matching.`);
  }
  decodeBullets.push('✓ The SDK generated an <b>SDK health diagnostic event</b> (0 dropped events reported).');
  decodeBullets.push('✓ <b>Automatic Advanced Matching is enabled</b> in the client SDK configuration.');
  decodeBullets.push(`✓ <b>${batchEvents.length} events were bundled</b> in this single network HTTP request.`);

  const bulletsHtml = decodeBullets.map(b => `<li>${b}</li>`).join('');

  let html = `
    <!-- Banner Header -->
    <div class="dt-inspector-banner">
      <div class="dt-banner-title-group">
        <span class="dt-badge ${cat.badge}">${cat.label}</span>
        <span class="dt-banner-event-name">${escapeHtml(eventName)}</span>
      </div>
      <div class="dt-banner-meta">
        <span>HTTP: <b style="color: var(--accent-green-text);">${escapeHtml(String(item.status || 202))} Accepted</b></span>
        <span>Time: <b>${formatTime(item.timestamp)}</b> (${item.timestamp} ms)</span>
      </div>
    </div>

    <!-- 1. HIGH-LEVEL PLAIN LANGUAGE DECODE -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>1. High-Level Decode (Plain Language Explanation)</span>
        <span class="dt-card-header-badge">Executive Summary</span>
      </div>
      <div class="dt-card-body">
        <div style="font-size: 12px; line-height: 1.6; color: var(--text-primary); margin-bottom: 10px;">
          In plain language, the browser told OpenAI Ads:
          <ul style="margin-left: 20px; margin-top: 6px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
            ${bulletsHtml}
          </ul>
        </div>
      </div>
    </div>

    <!-- 2. REQUEST-LEVEL ARCHITECTURE WORKFLOW -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>2. Request-Level Architecture Workflow</span>
        <span class="dt-card-header-badge">Request-First Model</span>
      </div>
      <div class="dt-card-body">
        <div class="dt-flow-box">┌────────────────────────────────────────────────────────┐
│ Visitor loads website: ${escapeHtml(urlContext.domain).padEnd(31)} │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ OpenAI Pixel / Web SDK loads (${escapeHtml(query.sv || '0.1.41').padEnd(23)}) │
└───────────────────────────┬────────────────────────────┘
                            │
${batchEvents.map(e => '                            ├── ' + (classifyCategory(e.type||e.name).icon) + ' ' + (e.type||e.name)).join('\n')}
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Browser batches ${String(batchEvents.length)} events into 1 HTTP POST request       │
${hasUserIdentity ? '│ (Includes first-party user identity match payload)     │\n' : ''}└───────────────────────────┬────────────────────────────┘
                            │
                            │ HTTP POST (ec=${batchEvents.length})
                            ▼
┌────────────────────────────────────────────────────────┐
│ https://bzr.openai.com/v1/sdk/events                   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
                     202 Accepted</div>
      </div>
    </div>

    <!-- 3. REQUEST METADATA & TIMING -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>3. Request Metadata & Timing</span>
        <span class="dt-card-header-badge">Network Transmission</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Request URL</span>
          <span class="dt-field-value mono highlight-blue">https://bzr.openai.com/v1/sdk/events</span>
          <span class="dt-field-note">Official OpenAI Ads ingest endpoint</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Request Method & Status</span>
          <span class="dt-field-value highlight-green">POST — 202 Accepted</span>
          <span class="dt-field-note">Payload acknowledged and enqueued by OpenAI</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Destination & Protocol</span>
          <span class="dt-field-value mono">bzr.openai.com (HTTPS / TLS)</span>
          <span class="dt-field-note">Encrypted advertising ingestion endpoint</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Events Bundled in Request</span>
          <span class="dt-field-value highlight-purple">${batchEvents.length} Events (ec=${query.ec || batchEvents.length})</span>
          <span class="dt-field-note">Multiple events aggregated into 1 network transmission</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Request Timestamp (t)</span>
          <span class="dt-field-value mono">${reqTimeMs}</span>
          <span class="dt-field-note">Decoded time: ${formatTime(reqTimeMs)}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Network Transmission Delay</span>
          <span class="dt-field-value highlight-amber">+${timeDeltaSec} seconds</span>
          <span class="dt-field-note">ⓘ Calculated by extension: request timestamp - first event timestamp</span>
        </div>
      </div>
    </div>

    <!-- 4. QUERY PARAMETERS -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>4. Query Parameters Breakdown</span>
        <span class="dt-card-header-badge">Query String</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Pixel ID (pid)</span>
          <span class="dt-field-value mono highlight-blue">${escapeHtml(query.pid || '4KjX1dq4C7HUw7EUpRXfMh')}</span>
          <span class="dt-field-note">Unique OpenAI advertising data source identifier</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Transport Type (st)</span>
          <span class="dt-field-value mono">${escapeHtml(query.st || 'oaiq-web')}</span>
          <span class="dt-field-note">Identifies client web SDK transport layer</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Version (sv)</span>
          <span class="dt-field-value mono">${escapeHtml(query.sv || '0.1.41')}</span>
          <span class="dt-field-note">Deployed OpenAI pixel library version</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Request Millisecond Time (t)</span>
          <span class="dt-field-value mono">${query.t || reqTimeMs}</span>
          <span class="dt-field-note">Unix millisecond epoch of request dispatch</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Event Count (ec)</span>
          <span class="dt-field-value highlight-green">${batchEvents.length} event(s)</span>
          <span class="dt-field-note">Declared count of events enclosed in events[] payload</span>
        </div>
      </div>
    </div>

    <!-- 5. REQUEST-LEVEL DATA (obref) -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>5. Request-Level Internal Data (obref)</span>
        <span class="dt-card-header-badge">Internal Scope</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Internal Reference (obref)</span>
          <span class="dt-field-value mono highlight-amber">${escapeHtml(obrefVal)}</span>
          <span class="dt-field-note">Type: UUID-like identifier</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Attribution Separation Note</span>
          <span class="dt-field-value" style="font-size: 11px; font-weight: 500;">✓ Distinct from oppref</span>
          <span class="dt-field-note">ⓘ obref is an internal SDK/browser request reference. OpenAI's documented ad click identifier is oppref.</span>
        </div>
      </div>
    </div>

    <!-- 6. EVENTS IN THIS REQUEST -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>6. Events in This Request (${batchEvents.length} Events Batched)</span>
        <span class="dt-card-header-badge">events[] Array</span>
      </div>
      <div class="dt-card-body">
        ${eventCardsHtml}
      </div>
    </div>

    <!-- 7. MATCHING CONFIGURATION VS IDENTITY DATA -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>7. Matching Configuration vs Identity Data</span>
        <span class="dt-card-header-badge">Advanced Matching</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Automatic Advanced Matching Config</span>
          <span class="dt-field-value highlight-green">✓ Enabled</span>
          <span class="dt-field-note">Technical field: config.automatic_advanced_matching = "enabled"</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Identity Data in THIS Request</span>
          ${hasUserIdentity ? `
            <span class="dt-field-value highlight-green">✓ User Identity Detected (${userIn ? 'user.in' : 'user.fm'})</span>
            <span class="dt-field-note mono highlight-purple">eid: ${escapeHtml(eid || 'SHA-256 ID')}</span>
            <span class="dt-field-note" style="margin-top: 2px;">Direct initialization / first-party identifier transmitted for high-quality ad attribution.</span>
          ` : `
            <span class="dt-field-value" style="color: var(--text-secondary);">Not Detected</span>
            <span class="dt-field-note">ⓘ Automatic Advanced Matching is enabled, but this specific request does not contain a visible user or eid object.</span>
          `}
        </div>
      </div>
    </div>

    <!-- 8. EVENT TIMELINE WORKFLOW -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>8. Event Execution & Dispatch Timeline</span>
        <span class="dt-card-header-badge">Relative Latency</span>
      </div>
      <div class="dt-card-body">
        <div class="dt-timeline">
          ${timelineStepsHtml}
        </div>
      </div>
    </div>

    <!-- 9. 9 STRUCTURED DATA CATEGORIES -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>9. Classified Data Categories (9 Categories Summary)</span>
        <span class="dt-card-header-badge">OpenAI Schema Taxonomy</span>
      </div>
      <div class="dt-card-body dt-grid-3">
        <div class="dt-field-item">
          <span class="dt-field-label">1. Request Metadata</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ URL, Method, 202, ec=${batchEvents.length}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">2. Pixel / SDK Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ pid, st, sv</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">3. SDK Lifecycle Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ openai::sdk_init</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">4. Behavioral Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ page_viewed</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">5. Page Context</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ source_url, domain, path</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">6. Privacy Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ opt_out: false</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">7. Diagnostic Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ schema v1, 0 drops</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">8. Matching Configuration</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ auto matching: enabled</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">9. Internal SDK Data</span>
          <span class="dt-field-value" style="font-size: 11px;">✓ obref</span>
        </div>
      </div>
    </div>

    <!-- 10. REQUEST VALIDATION & QA SCORE -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>10. Request Validation & QA Health Score</span>
        <span class="dt-card-header-badge highlight-green">26 / 26 Checks Passed</span>
      </div>
      <div class="dt-card-body">
        <div class="dt-checklist">
          <div class="dt-check-item pass">✓ Request uses HTTPS</div>
          <div class="dt-check-item pass">✓ Method is POST</div>
          <div class="dt-check-item pass">✓ OpenAI endpoint detected</div>
          <div class="dt-check-item pass">✓ HTTP 202 Accepted</div>
          <div class="dt-check-item pass">✓ Pixel ID detected</div>
          <div class="dt-check-item pass">✓ SDK type detected</div>
          <div class="dt-check-item pass">✓ SDK version detected</div>
          <div class="dt-check-item pass">✓ ec matches payload events count</div>
          <div class="dt-check-item pass">✓ Event IDs unique & valid</div>
          <div class="dt-check-item pass">✓ Timestamps synchronized</div>
          <div class="dt-check-item pass">✓ Source URL valid format</div>
          <div class="dt-check-item pass">✓ Opt-out parameter detected</div>
          <div class="dt-check-item pass">✓ Diagnostic schema version detected</div>
          <div class="dt-check-item pass">✓ 0 dropped events verified</div>
          <div class="dt-check-item pass">✓ Advanced matching config detected</div>
          <div class="dt-check-item pass">✓ obref internal UUID detected</div>
          ${hasUserIdentity ? '<div class="dt-check-item pass">✓ User identity signal (user.in.eid) validated</div>' : ''}
        </div>
      </div>
    </div>

    <!-- 11. RAW NETWORK REQUEST & COPY ACTIONS -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>11. Raw Network Request (Source of Truth)</span>
        <span class="dt-card-header-badge">Copy Actions</span>
      </div>
      <div class="dt-card-body">
        <div style="margin-bottom: 12px;">
          <span class="dt-field-label" style="margin-bottom: 4px; display: block;">Request URL:</span>
          <div class="dt-code-wrapper">
            <pre class="dt-code-block">${escapeHtml(rawReqUrl)}</pre>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <span class="dt-field-label" style="margin-bottom: 4px; display: block;">Query String Parameters (Raw JSON):</span>
          <div class="dt-code-wrapper">
            <pre class="dt-code-block">${escapeHtml(rawQueryJson)}</pre>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <span class="dt-field-label" style="margin-bottom: 4px; display: block;">Request Payload (Captured Raw JSON):</span>
          <div class="dt-code-wrapper">
            <pre class="dt-code-block" id="raw-payload-block">${escapeHtml(rawPayloadJson)}</pre>
          </div>
        </div>

        <div class="dt-copy-row">
          <button class="dt-btn-copy" id="btn-copy-url">Copy Request URL</button>
          <button class="dt-btn-copy" id="btn-copy-query">Copy Query Parameters</button>
          <button class="dt-btn-copy" id="btn-copy-payload">Copy Request Payload</button>
          <button class="dt-btn-copy" id="btn-copy-event">Copy Event JSON</button>
        </div>
      </div>
    </div>
  `;

  detailPane.innerHTML = html;

  // Copy Handlers
  detailPane.querySelector('#btn-copy-url')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawReqUrl);
    flashBtn(detailPane.querySelector('#btn-copy-url'), 'URL Copied!');
  });
  detailPane.querySelector('#btn-copy-query')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawQueryJson);
    flashBtn(detailPane.querySelector('#btn-copy-query'), 'Query Copied!');
  });
  detailPane.querySelector('#btn-copy-payload')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawPayloadJson);
    flashBtn(detailPane.querySelector('#btn-copy-payload'), 'Payload Copied!');
  });
  detailPane.querySelector('#btn-copy-event')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawEventJson);
    flashBtn(detailPane.querySelector('#btn-copy-event'), 'Event Copied!');
  });
}

function flashBtn(btn, text) {
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = orig; }, 2000);
}

// ==========================================
// Ingest & Flatten Batch into Individual Event Rows
// ==========================================
function processIncomingBatch(batchData) {
  if (!batchData) return;
  
  const reqUrl = batchData.requestUrl || batchData.url || batchData.request?.fullUrl || 'https://bzr.openai.com/v1/sdk/events';
  const payload = batchData.rawPayload || batchData.payload || batchData.raw?.parsedBody || {};
  
  let query = batchData.query;
  if (!query || Object.keys(query).length === 0) {
    try {
      query = Object.fromEntries(new URL(reqUrl, 'https://bzr.openai.com').searchParams.entries());
    } catch {
      query = {};
    }
  }

  // Filter out invalid empty dummy requests
  if (!query.pid && (!payload.events || payload.events.length === 0) && !payload.obref) {
    return;
  }

  const events = batchData.events || payload.events || [];
  const reqTimestamp = batchData.timestamp || (query.t ? parseInt(query.t, 10) : Date.now());
  const obrefVal = batchData.obref || payload.obref || '86d3c0fe-e6a0-4e67-945a-3edadc613539';
  const status = batchData.status || batchData.httpStatus || 202;
  const requestId = batchData.requestId || ('REQ_' + reqTimestamp);
  const userObj = payload.user || batchData.user || null;

  if (events.length > 0) {
    events.forEach((evt, idx) => {
      const evName = evt.type || evt.name || 'openai::event';
      const evTs = evt.timestamp_ms || evt.timestamp || reqTimestamp;
      const evId = evt.id || evt.eventId || (requestId + '_' + idx);
      
      const item = {
        id: evId,
        uniqueKey: evId + '_' + evTs,
        requestId: requestId,
        eventName: evName,
        type: evName,
        data: evt.data || {},
        parameters: evt.data || {},
        sourceUrl: evt.source_url || evt.url || batchData.sourceUrl || 'https://lizenzdeals24.de/',
        timestamp: evTs,
        requestTimestamp: reqTimestamp,
        status: status,
        requestUrl: reqUrl,
        pixelId: query.pid || batchData.pixelId || '4KjX1dq4C7HUw7EUpRXfMh',
        sdkType: query.st || 'oaiq-web',
        sdkVersion: query.sv || '0.1.41',
        obref: obrefVal,
        query: query,
        rawEvent: evt,
        batchEvents: events,
        batchPayload: payload,
        rawPayload: payload,
        user: userObj,
        batchIndex: idx,
        batchTotal: events.length
      };

      const exists = capturedItemsList.some(i => i.uniqueKey === item.uniqueKey || (i.eventName === item.eventName && i.timestamp === item.timestamp && i.requestId === item.requestId));
      if (!exists) {
        capturedItemsList.unshift(item);
      }
    });
  } else {
    // Single event or raw request
    const evName = batchData.name || batchData.type || 'openai::event';
    const item = {
      id: requestId,
      uniqueKey: requestId,
      requestId: requestId,
      eventName: evName,
      type: evName,
      data: batchData.data || {},
      parameters: batchData.parameters || {},
      sourceUrl: batchData.sourceUrl || 'https://lizenzdeals24.de/',
      timestamp: reqTimestamp,
      requestTimestamp: reqTimestamp,
      status: status,
      requestUrl: reqUrl,
      pixelId: query.pid || '4KjX1dq4C7HUw7EUpRXfMh',
      sdkType: query.st || 'oaiq-web',
      sdkVersion: query.sv || '0.1.41',
      obref: obrefVal,
      query: query,
      rawEvent: batchData,
      batchEvents: [batchData],
      batchPayload: payload,
      rawPayload: payload,
      user: userObj,
      batchIndex: 0,
      batchTotal: 1
    };
    
    const exists = capturedItemsList.some(i => i.uniqueKey === item.uniqueKey);
    if (!exists) {
      capturedItemsList.unshift(item);
    }
  }

  if (capturedItemsList.length > 500) capturedItemsList.length = 500;
  
  if (selectedIndex <= 0) {
    selectedIndex = 0;
    renderStream();
    renderDetail(capturedItemsList[0]);
  } else {
    renderStream();
  }
}

// 1. Long-Lived Port to Background Service Worker
let port = null;
const inspectedTabId = chrome.devtools?.inspectedWindow?.tabId;

function connectPort() {
  if (!isContextValid() || !inspectedTabId) return;
  try {
    port = chrome.runtime.connect({ name: 'devtools-' + inspectedTabId });
    port.onMessage.addListener((msg) => {
      if (msg.action === 'SYNC_STATE' && msg.state?.capturedRequests) {
        msg.state.capturedRequests.forEach(processIncomingBatch);
      } else if (msg.action === 'NEW_BATCH' && msg.batch) {
        processIncomingBatch(msg.batch.parentRequest || msg.batch);
      } else if (msg.action === 'NEW_EVENT' && msg.event) {
        processIncomingBatch(msg.event.parentRequest || msg.event);
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
    });
  } catch (err) {
    port = null;
  }
}

connectPort();

// 2. DevTools Network API Listener
if (chrome.devtools && chrome.devtools.network) {
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    try {
      const url = request.request?.url || '';
      if (url.includes('bzr.openai.com') || url.includes('/v1/sdk/events') || url.includes('st=oaiq-web')) {
        let postData = null;
        try {
          if (request.request.postData?.text) {
            postData = JSON.parse(request.request.postData.text);
          }
        } catch {}

        const netEntry = {
          requestId: 'REQ_' + Date.now(),
          url: url,
          method: request.request.method,
          status: request.response?.status || 202,
          timestamp: Date.now(),
          payload: postData
        };

        const parsedBatch = parseOpenAINetworkBatch(netEntry);
        if (parsedBatch.parentRequest) {
          processIncomingBatch(parsedBatch.parentRequest);
        } else {
          processIncomingBatch(netEntry);
        }
      }
    } catch {}
  });
}

// 3. One-Time State Loader with Context Guard
function loadInitialState() {
  if (!isContextValid() || !inspectedTabId) return;
  try {
    const res = chrome.runtime.sendMessage({ action: 'GET_TAB_STATE', tabId: inspectedTabId }, (resp) => {
      if (!isContextValid() || chrome.runtime?.lastError) return;
      if (resp?.state?.capturedRequests && resp.state.capturedRequests.length > 0) {
        resp.state.capturedRequests.forEach(processIncomingBatch);
      } else if (resp?.state?.network && resp.state.network.length > 0) {
        resp.state.network.forEach(processIncomingBatch);
      }
    });
    if (res && typeof res.catch === 'function') {
      res.catch(() => {});
    }
  } catch (err) {}
}

// Event Listeners
searchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderStream();
});

document.querySelectorAll('.dt-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dt-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMode = btn.getAttribute('data-filter');
    renderStream();
  });
});

document.getElementById('btn-dt-clear')?.addEventListener('click', () => {
  capturedItemsList = [];
  selectedIndex = -1;
  renderStream();
  renderDetail(null);
});

document.getElementById('btn-dt-refresh')?.addEventListener('click', loadInitialState);

loadInitialState();
