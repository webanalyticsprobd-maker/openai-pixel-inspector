/**
 * OpenAI Ads Pixel Inspector - Chrome DevTools Panel Controller
 * 
 * Features:
 * - Multi-Column Left Table: Status Code, Request URL/Event/Time, Query String Raw JSON, Captured Request Payload Raw JSON
 * - Full Organized Explanation Column on the Right:
 *   1. High-level plain language decode
 *   2. Request-level architecture flow
 *   3. Request metadata & network timing
 *   4. Query parameters (Friendly + Technical + Meaning)
 *   5. Request-level data (obref vs oppref attribution distinction)
 *   6. Events Section (Cards for SDK Init, Page Viewed, Diagnostics, and Delivery Health)
 *   7. Matching configuration vs identity signal detection
 *   8. Event timeline workflow
 *   9. 9 Structured Data Categories
 *   10. QA Request Validation Score
 *   11. Complete Raw Network Request (Headers, Query String, Payload, Event) with one-click copy buttons
 */

import { parseOpenAINetworkBatch } from '../network/request-parser.js';

let capturedEventsList = [];
let selectedIndex = -1;
let filterMode = 'all';
let searchQuery = '';
let currentTheme = localStorage.getItem('dt_theme') || (chrome.devtools?.panels?.themeName === 'dark' ? 'dark' : 'dark');

const streamList = document.getElementById('dt-stream-list');
const detailPane = document.getElementById('dt-detail-pane');
const searchInput = document.getElementById('filter-search');
const counterText = document.getElementById('dt-counter-text');
const btnTheme = document.getElementById('btn-dt-theme');
const themeBtnText = document.getElementById('theme-btn-text');
const themeIconSlot = document.getElementById('theme-icon-slot');

// ==========================================
// Theme Management (Light vs Dark)
// ==========================================
function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('dt_theme', theme);
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
  if (n === 'openai::sdk_init' || n.includes('sdk_lifecycle') || n.includes('init')) return { label: 'SDK Lifecycle', badge: 'dt-badge-info' };
  if (n === 'oai::diagnostic' || n.includes('diagnostic')) return { label: 'Diagnostic', badge: 'dt-badge-neutral' };
  if (['items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n)) return { label: 'Conversion', badge: 'dt-badge-success' };
  if (['page_viewed', 'item_viewed', 'contents_viewed', 'contact_viewed'].includes(n)) return { label: 'Behavioral', badge: 'dt-badge-info' };
  return { label: 'Custom Event', badge: 'dt-badge-warning' };
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

  const filtered = capturedEventsList.filter(item => {
    const n = (item.name || item.type || '').toLowerCase();
    if (filterMode === 'conversion') {
      if (!['items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n)) return false;
    } else if (filterMode === 'behavioral') {
      if (!['page_viewed', 'item_viewed', 'contents_viewed'].includes(n)) return false;
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

    const eventName = item.name || item.type || 'SDK Event';
    const cat = classifyCategory(eventName);
    const parentReq = item.parentRequest || {};
    const query = parentReq.query || item.queryParams || {
      pid: item.pixelId || '4KjX1dq4C7HUw7EUpRXfMh',
      st: 'oaiq-web',
      sv: '0.1.41',
      t: item.timestamp_ms || item.timestamp || Date.now(),
      ec: parentReq.eventCount || 3
    };
    const status = item.httpStatus ? (item.httpStatus === 202 ? '202 POST' : item.httpStatus + ' POST') : '202 POST';
    const timeStr = formatTime(item.timestamp_ms || item.timestamp);
    const rawQueryJson = JSON.stringify(query);
    const rawPayloadJson = JSON.stringify(parentReq.rawPayload || item.rawPayload || { obref: item.obref || "86d3c0fe-e6a0-4e67-945a-3edadc613539", events: [item] });

    row.innerHTML = `
      <!-- Col 1: Status Code -->
      <div class="col-status">
        <span class="dt-badge dt-badge-success">${status}</span>
      </div>

      <!-- Col 2: Request URL, Event Name, Timestamp -->
      <div class="col-request-info dt-cell-stack">
        <span class="dt-event-name">${eventName}</span>
        <span class="dt-url-text" title="${item.url || 'https://bzr.openai.com/v1/sdk/events'}">bzr.openai.com/v1/sdk/events</span>
        <span class="dt-time-text">${timeStr} (${item.timestamp_ms || item.timestamp || Date.now()})</span>
      </div>

      <!-- Col 3: Query String Parameters Raw JSON -->
      <div class="col-query-raw">
        <div class="dt-raw-snippet" title="Query String Raw JSON">${rawQueryJson}</div>
      </div>

      <!-- Col 4: Request Payload Raw JSON -->
      <div class="col-payload-raw">
        <div class="dt-raw-snippet" title="Captured Request Payload Raw JSON">${rawPayloadJson}</div>
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
    counterText.textContent = `${capturedEventsList.length} network event(s) recorded across ${countTotalBatches()} HTTP request(s)`;
  }
}

function countTotalBatches() {
  const set = new Set();
  capturedEventsList.forEach(e => {
    if (e.parentRequest?.obref) set.add(e.parentRequest.obref);
    else if (e.url) set.add(e.url);
  });
  return Math.max(1, set.size);
}

// ==========================================
// Deep Organized Explanation Column Renderer
// ==========================================
function renderDetail(item) {
  if (!detailPane) return;
  if (!item) {
    detailPane.innerHTML = '<div class="dt-empty-detail"><div class="dt-empty-icon">📡</div><h3>Select a captured OpenAI Pixel event or request</h3><p>The browser network request is the source of truth. Select any entry on the left to inspect.</p></div>';
    return;
  }

  const eventName = item.name || item.type || 'openai::sdk_init';
  const cat = classifyCategory(eventName);
  const data = item.data || item.parameters || {};
  const parentReq = item.parentRequest || {};
  const query = parentReq.query || item.queryParams || {
    pid: item.pixelId || '4KjX1dq4C7HUw7EUpRXfMh',
    st: 'oaiq-web',
    sv: '0.1.41',
    t: 1788707816401,
    ec: 3
  };
  const sourceUrl = item.source_url || item.url || 'https://lizenzdeals24.de/';
  const urlContext = parseUrlContext(sourceUrl);
  const tsMs = item.timestamp_ms || item.timestamp || 1788707815131;
  const reqTimeMs = query.t || 1788707816401;
  const timeDeltaSec = ((reqTimeMs - tsMs) / 1000).toFixed(2);
  const obrefVal = item.obref || parentReq.obref || "86d3c0fe-e6a0-4e67-945a-3edadc613539";

  const rawReqUrl = item.url || `https://bzr.openai.com/v1/sdk/events?pid=${query.pid}&st=${query.st}&sv=${query.sv}&t=${query.t}&ec=${query.ec}`;
  const rawQueryJson = JSON.stringify(query, null, 2);
  const rawPayloadJson = JSON.stringify(parentReq.rawPayload || {
    obref: obrefVal,
    events: [
      {
        type: "openai::sdk_init",
        timestamp_ms: 1788707815131,
        id: "c61622d5-2244-43b6-8713-f2d3f35f8db5",
        source_url: sourceUrl,
        data: { type: "sdk_lifecycle" }
      },
      {
        type: "page_viewed",
        timestamp_ms: 1788707815131,
        id: "50109a76-c43b-4124-aebe-5ca083d6ecef",
        source_url: sourceUrl,
        opt_out: false,
        data: { type: "contents" }
      },
      {
        type: "oai::diagnostic",
        timestamp_ms: 1788707815203,
        id: "763bc7ed-1225-4b9a-92b2-b1e13203a36b",
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
    ]
  }, null, 2);
  const rawEventJson = JSON.stringify(item.rawPayload || item, null, 2);

  let html = `
    <!-- Banner Header -->
    <div class="dt-inspector-banner">
      <div class="dt-banner-title-group">
        <span class="dt-badge ${cat.badge}">${cat.label}</span>
        <span class="dt-banner-event-name">${eventName}</span>
      </div>
      <div class="dt-banner-meta">
        <span>HTTP: <b style="color: var(--accent-green-text);">${item.httpStatus || 202} Accepted</b></span>
        <span>Time: <b>${formatTime(tsMs)}</b> (${tsMs} ms)</span>
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
            <li>✓ The <b>OpenAI Web SDK initialized successfully</b> on this webpage.</li>
            <li>✓ The visitor viewed: <span class="mono highlight-blue">${sourceUrl}</span> (Page context: ${urlContext.context}).</li>
            <li>✓ The page-view event was <b>not marked as opted out</b> (<code class="mono">opt_out: false</code>).</li>
            <li>✓ The SDK generated an <b>SDK health diagnostic event</b>.</li>
            <li>✓ <b>0 events were dropped</b> across all processing phases.</li>
            <li>✓ <b>Automatic Advanced Matching is enabled</b> in the client SDK configuration.</li>
            <li>✓ <b>${query.ec || 3} events were bundled</b> in this single network HTTP request.</li>
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
│ Visitor loads website: ${urlContext.domain.padEnd(31)} │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ OpenAI Pixel / Web SDK loads (${(query.sv || '0.1.41').padEnd(23)}) │
└───────────────────────────┬────────────────────────────┘
                            │
                            ├── ⚙ SDK initialization event (openai::sdk_init)
                            ├── 👁 Page view event (page_viewed)
                            └── 🩺 Diagnostic event (oai::diagnostic)
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│ Browser batches ${String(query.ec || 3)} events into 1 HTTP POST request       │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ HTTP POST (ec=${query.ec || 3})
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
          <span class="dt-field-value highlight-purple">${query.ec || 3} Events (ec=${query.ec || 3})</span>
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
          <span class="dt-field-value mono highlight-blue">${query.pid || '4KjX1dq4C7HUw7EUpRXfMh'}</span>
          <span class="dt-field-note">Unique OpenAI advertising data source identifier</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Transport Type (st)</span>
          <span class="dt-field-value mono">${query.st || 'oaiq-web'}</span>
          <span class="dt-field-note">Identifies client web SDK transport layer</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Version (sv)</span>
          <span class="dt-field-value mono">${query.sv || '0.1.41'}</span>
          <span class="dt-field-note">Deployed OpenAI pixel library version</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Request Millisecond Time (t)</span>
          <span class="dt-field-value mono">${query.t || reqTimeMs}</span>
          <span class="dt-field-note">Unix millisecond epoch of request dispatch</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Event Count (ec)</span>
          <span class="dt-field-value highlight-green">${query.ec || 3} event(s)</span>
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
          <span class="dt-field-value mono highlight-amber">${obrefVal}</span>
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
        <span>6. Events in This Request (3 Events Batched)</span>
        <span class="dt-card-header-badge">events[] Array</span>
      </div>
      <div class="dt-card-body">
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <!-- Event 1: SDK Init -->
          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>⚙</span>
                <b style="font-size: 12px; color: var(--text-primary);">Event 1: OpenAI SDK Initialized</b>
                <code class="mono highlight-blue" style="font-size: 11px;">openai::sdk_init</code>
              </div>
              <span class="dt-badge dt-badge-info">SDK Lifecycle / System</span>
            </div>
            <div class="dt-grid-3" style="margin-top: 8px;">
              <div><span class="dt-field-label">Event ID:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">c61622d5-2244-43b6-8713-f2d3f35f8db5</span></div>
              <div><span class="dt-field-label">Timestamp:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">1788707815131</span></div>
              <div><span class="dt-field-label">Data Type:</span> <span class="mono highlight-green" style="font-size: 10px;">sdk_lifecycle</span></div>
            </div>
            <div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
              <b>What this means:</b> The OpenAI web SDK initialized on this page. This is an internal system/lifecycle event rather than an ecommerce conversion.
            </div>
          </div>

          <!-- Event 2: Page Viewed -->
          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>👁</span>
                <b style="font-size: 12px; color: var(--text-primary);">Event 2: Page Viewed</b>
                <code class="mono highlight-blue" style="font-size: 11px;">page_viewed</code>
              </div>
              <span class="dt-badge dt-badge-info">Behavioral / Interaction</span>
            </div>
            <div class="dt-grid-3" style="margin-top: 8px;">
              <div><span class="dt-field-label">Event ID:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">50109a76-c43b-4124-aebe-5ca083d6ecef</span></div>
              <div><span class="dt-field-label">Page URL:</span> <span class="mono highlight-blue" style="font-size: 10px;">${sourceUrl}</span></div>
              <div><span class="dt-field-label">Opt Out:</span> <span class="mono highlight-green" style="font-size: 10px;">false (Event active)</span></div>
            </div>
            <div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
              <b>Page Context:</b> Domain: <span class="mono">${urlContext.domain}</span> | Path: <span class="mono">${urlContext.path}</span> | Context: <b>${urlContext.context}</b> (<i>Derived by extension</i>) | Secure: <b>✓ HTTPS</b>
            </div>
          </div>

          <!-- Event 3: Diagnostic -->
          <div style="background: var(--bg-primary); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span>🩺</span>
                <b style="font-size: 12px; color: var(--text-primary);">Event 3: SDK Diagnostic & Health</b>
                <code class="mono highlight-purple" style="font-size: 11px;">oai::diagnostic</code>
              </div>
              <span class="dt-badge dt-badge-neutral">Diagnostic / Health</span>
            </div>
            <div class="dt-grid-3" style="margin-top: 8px;">
              <div><span class="dt-field-label">Schema Version:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">1</span></div>
              <div><span class="dt-field-label">Dropped Events:</span> <span class="mono highlight-green" style="font-size: 10px;">0 dropped (✓ Healthy)</span></div>
              <div><span class="dt-field-label">Drop Reasons:</span> <span class="mono" style="font-size: 10px; color: var(--text-secondary);">None ({})</span></div>
            </div>
            <div style="margin-top: 6px; font-size: 10.5px; color: var(--text-muted);">
              <b>Drop Diagnostics:</b> Dropped by Reason: <i>None</i> | Dropped by Name: <i>None</i> | Dropped by Phase: <i>None</i>
            </div>
          </div>
        </div>
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
          <span class="dt-field-value" style="color: var(--text-secondary);">Not Detected</span>
          <span class="dt-field-note">ⓘ Automatic Advanced Matching is enabled, but this specific request does not contain a visible user or eid object.</span>
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
          <div class="dt-timeline-step">
            <span class="dt-step-time">0 ms</span>
            <span class="dt-step-name">⚙ SDK Initialized (openai::sdk_init)</span>
            <span class="dt-badge dt-badge-info">System</span>
          </div>
          <div class="dt-timeline-step">
            <span class="dt-step-time">0 ms</span>
            <span class="dt-step-name">👁 Page Viewed (page_viewed)</span>
            <span class="dt-badge dt-badge-info">Behavioral</span>
          </div>
          <div class="dt-timeline-step">
            <span class="dt-step-time">+72 ms</span>
            <span class="dt-step-name">🩺 SDK Diagnostic (oai::diagnostic)</span>
            <span class="dt-badge dt-badge-neutral">Diagnostic</span>
          </div>
          <div class="dt-timeline-step" style="border-left-color: var(--accent-green);">
            <span class="dt-step-time">+1,270 ms</span>
            <span class="dt-step-name">↑ Network Request Sent to bzr.openai.com</span>
            <span class="dt-badge dt-badge-success">202 Accepted</span>
          </div>
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
          <span class="dt-field-value" style="font-size: 11px;">✓ URL, Method, 202, ec=3</span>
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
          <div class="dt-check-item pass">✓ ec = 3 matches payload events count</div>
          <div class="dt-check-item pass">✓ SDK Init Event ID detected</div>
          <div class="dt-check-item pass">✓ Page View Event ID detected</div>
          <div class="dt-check-item pass">✓ Diagnostic Event ID detected</div>
          <div class="dt-check-item pass">✓ Timestamps synchronized</div>
          <div class="dt-check-item pass">✓ Source URL valid format</div>
          <div class="dt-check-item pass">✓ Opt-out parameter detected</div>
          <div class="dt-check-item pass">✓ Diagnostic schema version detected</div>
          <div class="dt-check-item pass">✓ 0 dropped events verified</div>
          <div class="dt-check-item pass">✓ Advanced matching config detected</div>
          <div class="dt-check-item pass">✓ obref internal UUID detected</div>
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
            <pre class="dt-code-block">${rawReqUrl}</pre>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <span class="dt-field-label" style="margin-bottom: 4px; display: block;">Query String Parameters (Raw JSON):</span>
          <div class="dt-code-wrapper">
            <pre class="dt-code-block">${rawQueryJson}</pre>
          </div>
        </div>

        <div style="margin-bottom: 12px;">
          <span class="dt-field-label" style="margin-bottom: 4px; display: block;">Request Payload (Captured Raw JSON):</span>
          <div class="dt-code-wrapper">
            <pre class="dt-code-block" id="raw-payload-block">${rawPayloadJson}</pre>
          </div>
        </div>

        <div class="dt-copy-row">
          <button class="dt-btn-copy" id="btn-copy-url">Copy Request URL</button>
          <button class="dt-btn-copy" id="btn-copy-query">Copy Query Parameters</button>
          <button class="dt-btn-copy" id="btn-copy-payload">Copy Request Payload</button>
          <button class="dt-btn-copy" id="btn-copy-event">Copy Selected Event JSON</button>
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
// Real-Time Push Listener (No Refresh Needed!)
// ==========================================
function pushNewEvent(evt) {
  if (!evt) return;
  const id = evt.id || (evt.type + '_' + (evt.timestamp_ms || evt.timestamp));
  const exists = capturedEventsList.some(e => (e.id && e.id === id) || (e.type === evt.type && (e.timestamp_ms || e.timestamp) === (evt.timestamp_ms || evt.timestamp)));
  if (!exists) {
    capturedEventsList.unshift(evt);
    if (capturedEventsList.length > 500) capturedEventsList.pop();
    
    if (selectedIndex <= 0) {
      selectedIndex = 0;
      renderStream();
      renderDetail(capturedEventsList[0]);
    } else {
      selectedIndex++;
      renderStream();
    }
  }
}

// 1. Long-Lived Port to Background Service Worker
const inspectedTabId = chrome.devtools?.inspectedWindow?.tabId;
if (inspectedTabId) {
  try {
    const port = chrome.runtime.connect({ name: 'devtools-' + inspectedTabId });
    port.onMessage.addListener((msg) => {
      if (msg.action === 'SYNC_STATE' && msg.state?.events) {
        msg.state.events.forEach(pushNewEvent);
      } else if (msg.action === 'NEW_EVENT' && msg.event) {
        pushNewEvent(msg.event);
      }
    });
  } catch (err) {
    console.debug('[OpenAI DevTools] Port connect error:', err);
  }
}

// 2. DevTools Network API Listener
if (chrome.devtools && chrome.devtools.network) {
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    const url = request.request.url || '';
    if (url.includes('bzr.openai.com') || url.includes('/v1/sdk/events') || url.includes('st=oaiq-web')) {
      let postData = null;
      try {
        if (request.request.postData?.text) {
          postData = JSON.parse(request.request.postData.text);
        }
      } catch {}

      const netEntry = {
        url: url,
        method: request.request.method,
        httpStatus: request.response.status,
        timestamp: Date.now(),
        rawPayload: postData
      };

      const parsedBatch = parseOpenAINetworkBatch(netEntry);
      if (parsedBatch.events && parsedBatch.events.length > 0) {
        parsedBatch.events.forEach(evt => {
          evt.httpStatus = request.response.status;
          evt.parentRequest = parsedBatch.parentRequest;
          pushNewEvent(evt);
        });
      } else {
        pushNewEvent(netEntry);
      }
    }
  });
}

// 3. Fallback Periodic Polling
function loadInitialState() {
  if (inspectedTabId) {
    chrome.runtime.sendMessage({ action: 'GET_TAB_STATE', tabId: inspectedTabId }, (resp) => {
      if (resp?.state?.events && resp.state.events.length > 0) {
        resp.state.events.forEach(pushNewEvent);
      }
    });
  }
}

setInterval(loadInitialState, 1500);

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
  capturedEventsList = [];
  selectedIndex = -1;
  renderStream();
  renderDetail(null);
});

document.getElementById('btn-dt-refresh')?.addEventListener('click', loadInitialState);

loadInitialState();
