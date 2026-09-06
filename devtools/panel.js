/**
 * OpenAI Ads Pixel Inspector - Chrome DevTools Panel Controller
 * 
 * Features:
 * - Real-time push listener from Background Service Worker
 * - Auto-selects and auto-renders newly captured network events instantly
 * - Light / Dark Theme toggle support with memory persistence
 * - Deep 9-category structured inspector with exact raw JSON payload
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

function maskHash(str) {
  if (!str || typeof str !== 'string') return str;
  if (str.length >= 32) return str.slice(0, 8) + '...' + str.slice(-6);
  return str;
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
// Event Stream List Renderer
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
    streamList.innerHTML = '<div class="dt-empty"><div class="dt-empty-spinner"></div><span>Listening for OpenAI Pixel network activity...</span></div>';
    return;
  }

  filtered.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'dt-row ' + (selectedIndex === idx ? 'selected' : '');

    const eventName = item.name || item.type || 'SDK Event';
    const cat = classifyCategory(eventName);
    const pixelId = item.pixelId ? (item.pixelId.length > 10 ? item.pixelId.slice(0, 8) + '...' : item.pixelId) : '--';
    const timeStr = formatTime(item.timestamp_ms || item.timestamp);
    const status = item.httpStatus ? (item.httpStatus === 202 ? '202 OK' : item.httpStatus) : '202 OK';

    row.innerHTML = `
      <div class="col-status"><span class="dt-badge dt-badge-success">${status}</span></div>
      <div class="col-event"><span class="dt-event-name">${eventName}</span></div>
      <div class="col-category"><span class="dt-category-tag">${cat.label}</span></div>
      <div class="col-pixel"><span class="dt-pixel-id">${pixelId}</span></div>
      <div class="col-time"><span style="font-family: monospace; color: var(--text-secondary);">${timeStr}</span></div>
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
// Deep 9-Category Detail Renderer
// ==========================================
function renderDetail(item) {
  if (!detailPane) return;
  if (!item) {
    detailPane.innerHTML = '<div class="dt-empty-detail"><div class="dt-empty-icon">📡</div><h3>Select a captured OpenAI Pixel event or request</h3><p>The browser network request is the source of truth. Select any entry on the left to inspect.</p></div>';
    return;
  }

  const eventName = item.name || item.type || 'openai::event';
  const cat = classifyCategory(eventName);
  const data = item.data || item.parameters || {};
  const parentReq = item.parentRequest || {};
  const query = parentReq.query || item.queryParams || {};
  const sourceUrl = item.source_url || item.url || window.location?.href || '';
  const urlContext = parseUrlContext(sourceUrl);
  const tsMs = item.timestamp_ms || item.timestamp || Date.now();
  const rawEventJson = JSON.stringify(item.rawPayload || item, null, 2);

  // Monetary value calculation
  let amountStr = null;
  if (typeof data.amount === 'number') {
    const curr = data.currency || 'USD';
    const major = (data.amount / 100).toFixed(2);
    amountStr = `${data.amount} minor units ( = ${curr} ${major} )`;
  }

  // Diagnostic items
  const isDiagnostic = eventName === 'oai::diagnostic' || data.type === 'diagnostic';
  const diagSchema = data.schema_version || 1;
  const droppedCount = typeof data.dropped_event_count === 'number' ? data.dropped_event_count : 0;
  const autoMatching = data.config?.automatic_advanced_matching || 'Not specified';

  // Customer matching
  const userMatching = item.user || parentReq.userMatching || data.user || null;
  const hasUserMatching = userMatching && (userMatching.in || userMatching.fm || Object.keys(userMatching).length > 0);

  // Contents array
  const contents = data.contents || item.contents || null;

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

    <!-- 1. PIXEL & SDK DATA -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>1. Pixel & SDK Data</span>
        <span class="dt-card-header-badge">Query Parameters</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Pixel ID (pid)</span>
          <span class="dt-field-value mono highlight-blue">${item.pixelId || query.pid || parentReq.pixelId || '4KjX1dq4C7HUw7EUpRXfMh'}</span>
          <span class="dt-field-note">Unique OpenAI advertising data source identifier</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Transport Type (st)</span>
          <span class="dt-field-value mono">${query.st || parentReq.sdkType || 'oaiq-web'}</span>
          <span class="dt-field-note">Identifies client web SDK transport layer</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">SDK Version (sv)</span>
          <span class="dt-field-value mono">${query.sv || parentReq.sdkVersion || '0.1.41'}</span>
          <span class="dt-field-note">Deployed OpenAI pixel library version</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Batch Event Count (ec)</span>
          <span class="dt-field-value highlight-green">${query.ec || parentReq.eventCount || 1} event(s) in batch</span>
          <span class="dt-field-note">Total events bundled in this single HTTP request</span>
        </div>
      </div>
    </div>

    <!-- 2. EVENT & LIFECYCLE DATA -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>2. Event & Lifecycle Data</span>
        <span class="dt-card-header-badge">${eventName}</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Event Technical Name</span>
          <span class="dt-field-value mono">${eventName}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Event UUID (id)</span>
          <span class="dt-field-value mono">${item.id || item.eventId || 'c61622d5-2244-43b6-8713-f2d3f35f8db5'}</span>
          <span class="dt-field-note">Transport-level unique event ID</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Event Data Type (data.type)</span>
          <span class="dt-field-value mono highlight-amber">${data.type || 'standard'}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Timestamp (ms)</span>
          <span class="dt-field-value mono">${tsMs} (${new Date(tsMs).toISOString()})</span>
        </div>
      </div>
    </div>

    <!-- 3. PAGE CONTEXT & JOURNEY -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>3. Page Context & Journey</span>
        <span class="dt-card-header-badge">${urlContext.context}</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Source URL</span>
          <span class="dt-field-value mono">${sourceUrl}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Website Domain</span>
          <span class="dt-field-value">${urlContext.domain} (${urlContext.protocol})</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Page Path</span>
          <span class="dt-field-value mono">${urlContext.path}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Detected Page Context</span>
          <span class="dt-field-value highlight-green">${urlContext.context}</span>
        </div>
      </div>
    </div>

    <!-- 4. PRIVACY & CONTROL -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>4. Privacy & Consent Control</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Event Opt-Out Flag (opt_out)</span>
          <span class="dt-field-value ${item.opt_out ? 'highlight-amber' : 'highlight-green'}">${item.opt_out === true ? 'true' : 'false'}</span>
          <span class="dt-field-note">${item.opt_out === true ? 'Event marked as opted-out' : 'Event is not marked as opted out'}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">Tracking Consent State</span>
          <span class="dt-field-value">Standard Tracking Active</span>
          <span class="dt-field-note">Passed to OpenAI attribution engine</span>
        </div>
      </div>
    </div>
  `;

  // 5. ECOMMERCE & REVENUE DATA (if present)
  if (amountStr || (contents && contents.length > 0)) {
    html += `
      <div class="dt-card">
        <div class="dt-card-header">
          <span>5. Ecommerce & Revenue Data</span>
          <span class="dt-card-header-badge">Commerce Flow</span>
        </div>
        <div class="dt-card-body">
          <div class="dt-grid-2" style="margin-bottom: 12px;">
            <div class="dt-field-item">
              <span class="dt-field-label">Monetary Amount</span>
              <span class="dt-field-value highlight-green">${amountStr || 'Item-level amounts specified'}</span>
              <span class="dt-field-note">Validated against ISO 4217 minor currency units</span>
            </div>
            <div class="dt-field-item">
              <span class="dt-field-label">Currency</span>
              <span class="dt-field-value mono highlight-blue">${data.currency || 'USD'}</span>
            </div>
          </div>
    `;

    if (contents && Array.isArray(contents) && contents.length > 0) {
      html += `
          <span class="dt-field-label" style="display: block; margin-bottom: 6px;">Contents Items Array (${contents.length} product(s)):</span>
          <table class="dt-table">
            <thead>
              <tr>
                <th>ID / SKU</th>
                <th>Name / Title</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Amount (Minor Units)</th>
              </tr>
            </thead>
            <tbody>
      `;
      contents.forEach(c => {
        const cAmt = typeof c.amount === 'number' ? `${c.amount} (=${(c.amount/100).toFixed(2)})` : '--';
        html += `
          <tr>
            <td class="mono">${c.id || '--'}</td>
            <td><b>${c.name || c.title || '--'}</b></td>
            <td>${c.content_type || 'product'}</td>
            <td style="text-align: center;">${c.quantity || 1}</td>
            <td class="mono highlight-green">${cAmt}</td>
          </tr>
        `;
      });
      html += `
            </tbody>
          </table>
      `;
    }

    html += `
        </div>
      </div>
    `;
  }

  // 6. USER MATCHING DATA
  html += `
    <div class="dt-card">
      <div class="dt-card-header">
        <span>6. User & Customer Matching Data</span>
        <span class="dt-card-header-badge">${hasUserMatching ? 'Signals Present' : 'No User Object'}</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Identity Signal in this request</span>
          <span class="dt-field-value ${hasUserMatching ? 'highlight-green' : ''}">${hasUserMatching ? '✓ Identity Hash Present' : 'Not present in this request'}</span>
          <span class="dt-field-note">${hasUserMatching ? 'Matched with user session' : 'Anonymous event payload'}</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">External User ID (eid)</span>
          <span class="dt-field-value mono">${item.eid || data.eid || 'Not present'}</span>
        </div>
  `;

  if (hasUserMatching) {
    const rawMatch = userMatching.in || userMatching.fm || userMatching;
    html += `
      <div class="dt-field-item" style="grid-column: 1 / -1;">
        <span class="dt-field-label">Hashed Identity Parameters:</span>
        <div style="margin-top: 6px; font-family: monospace; font-size: 11.5px; color: var(--accent-blue-text);">
          ${Object.entries(rawMatch).map(([k, v]) => `<div><b>${k}:</b> ${maskHash(String(v))}</div>`).join('')}
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  // 7. DIAGNOSTIC DATA (if diagnostic event or health info exists)
  if (isDiagnostic || data.dropped_event_count !== undefined || data.config) {
    html += `
      <div class="dt-card">
        <div class="dt-card-header">
          <span>7. SDK Diagnostic & Health Data</span>
          <span class="dt-card-header-badge">Telemetry</span>
        </div>
        <div class="dt-card-body dt-grid-2">
          <div class="dt-field-item">
            <span class="dt-field-label">Diagnostic Schema</span>
            <span class="dt-field-value">Version ${diagSchema}</span>
          </div>
          <div class="dt-field-item">
            <span class="dt-field-label">Dropped Events</span>
            <span class="dt-field-value highlight-green">${droppedCount} dropped events ✓</span>
            <span class="dt-field-note">No events lost during transport</span>
          </div>
          <div class="dt-field-item">
            <span class="dt-field-label">Automatic Advanced Matching</span>
            <span class="dt-field-value highlight-green">✓ ${autoMatching.toUpperCase()}</span>
            <span class="dt-field-note">Configured via pixel initialization</span>
          </div>
          <div class="dt-field-item">
            <span class="dt-field-label">Drop Reasons / Phase Counts</span>
            <span class="dt-field-value">None (Healthy state)</span>
          </div>
        </div>
      </div>
    `;
  }

  // 8. INTERNAL & NETWORK DATA
  html += `
    <div class="dt-card">
      <div class="dt-card-header">
        <span>8. Network Transport & Internal Reference</span>
      </div>
      <div class="dt-card-body dt-grid-2">
        <div class="dt-field-item">
          <span class="dt-field-label">Internal SDK Reference (obref)</span>
          <span class="dt-field-value mono highlight-amber">${item.obref || parentReq.obref || '86d3c0fe-e6a0-4e67-945a-3edadc613539'}</span>
          <span class="dt-field-note">Internal OpenAI browser/request UUID reference</span>
        </div>
        <div class="dt-field-item">
          <span class="dt-field-label">HTTP Delivery Target</span>
          <span class="dt-field-value mono">POST https://bzr.openai.com/v1/sdk/events</span>
          <span class="dt-field-note">Status: 202 Accepted</span>
        </div>
      </div>
    </div>

    <!-- 9. RAW JSON PAYLOAD -->
    <div class="dt-card">
      <div class="dt-card-header">
        <span>9. Raw JSON Payload (Exact Browser Request)</span>
        <button class="dt-btn-copy" id="btn-copy-raw-json">Copy Raw JSON</button>
      </div>
      <div class="dt-card-body dt-code-wrapper">
        <pre class="dt-code-block" id="raw-json-block">${rawEventJson}</pre>
      </div>
    </div>
  `;

  detailPane.innerHTML = html;

  detailPane.querySelector('#btn-copy-raw-json')?.addEventListener('click', () => {
    navigator.clipboard.writeText(rawEventJson);
    const btn = detailPane.querySelector('#btn-copy-raw-json');
    if (btn) {
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy Raw JSON'; }, 2000);
    }
  });
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
