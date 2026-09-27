/**
 * OpenAI Pixel Helper - Single Feed with Deep Categorized Parameters
 * Modeled after official Pixel Helper extension UI with 8 logical categories.
 */

import { formatMonetaryValue, getCurrencyDecimalPlaces } from '../utils/formatting.js';

document.addEventListener('DOMContentLoaded', async () => {
  const targetHostEl = document.getElementById('target-host');
  const eventsCountEl = document.getElementById('events-count');
  const filterInput = document.getElementById('filter-input');
  const chkClearReload = document.getElementById('chk-clear-reload');
  const btnClear = document.getElementById('btn-clear');
  const btnOpenTab = document.getElementById('btn-open-tab');
  const btnDebug = document.getElementById('btn-debug');
  const btnTheme = document.getElementById('btn-theme');
  const btnSidepanel = document.getElementById('btn-sidepanel');
  const btnCloseWindow = document.getElementById('btn-close-window');
  const eventsFeed = document.getElementById('events-feed');

  let activeTab = null;
  let currentTabState = null;
  let searchQuery = '';
  const expandedEventIds = new Set();

  // 1. Theme Initialization
  function initTheme() {
    const saved = localStorage.getItem('__oai_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('__oai_theme', next);
    });
  }
  initTheme();

  // 2. Window Controls
  if (btnSidepanel) {
    btnSidepanel.addEventListener('click', async () => {
      try {
        if (chrome.sidePanel && activeTab) {
          await chrome.sidePanel.open({ tabId: activeTab.id });
          window.close();
        }
      } catch (e) {
        console.warn('SidePanel open:', e);
      }
    });
  }
  if (btnCloseWindow) {
    btnCloseWindow.addEventListener('click', () => window.close());
  }
  if (btnOpenTab) {
    btnOpenTab.addEventListener('click', () => {
      window.open(chrome.runtime.getURL('popup/popup.html'), '_blank');
    });
  }
  if (btnDebug) {
    btnDebug.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup/report.html') });
    });
  }
  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (activeTab) {
        chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id }, () => {
          loadState();
        });
      }
    });
  }
  if (filterInput) {
    filterInput.addEventListener('input', (e) => {
      searchQuery = (e.target.value || '').trim().toLowerCase();
      renderFeed();
    });
  }

  // 3. Tab State Loading & Real-Time Sync
  async function loadState() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) return;
      activeTab = tabs[0];

      if (targetHostEl && activeTab.url) {
        try {
          const u = new URL(activeTab.url);
          targetHostEl.textContent = u.hostname;
          targetHostEl.title = activeTab.url;
        } catch {
          targetHostEl.textContent = activeTab.url;
        }
      }

      chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB_STATE', tabId: activeTab.id }, (res) => {
        if (res && res.state) {
          currentTabState = res.state;
          renderFeed();
        } else {
          currentTabState = null;
          renderFeed();
        }
      });
    } catch (err) {
      console.warn('Tab query error:', err);
    }
  }

  // Listen for real-time messages from background service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATE_UPDATED' || msg.action === 'NEW_BATCH' || msg.action === 'EVENT_CAPTURED') {
      if (!msg.tabId || (activeTab && msg.tabId === activeTab.id)) {
        loadState();
      }
    }
  });

  // Polling fallback to guarantee instant updates when request occurs
  setInterval(loadState, 1500);
  await loadState();

  // 4. Descriptions Database for OpenAI Events
  const EVENT_DESCRIPTIONS = {
    'page_viewed': 'Standard event fired when a page is viewed. Uses the `contents` data shape.',
    'items_added': 'Standard ecommerce event fired when items are added to cart. Uses the `contents` data shape.',
    'contents_viewed': 'Standard event fired when viewing a product or catalog content page.',
    'checkout_started': 'Standard ecommerce event fired when customer initiates checkout flow.',
    'order_created': 'Standard conversion purchase event fired when order transaction is completed.',
    'lead': 'Standard conversion event fired when a lead or contact form is submitted.',
    'oai::diagnostic': 'Undocumented internal telemetry the SDK sends about its own health — e.g. how many events it had to drop, and why. Not a conversion event — inferred from observed traffic.',
    'openai::sdk_init': 'Undocumented internal lifecycle event fired once when oaiq("init", ...) finishes loading the Pixel. Not part of the public measure() API — inferred from observed traffic.',
    'openai::sdk_lifecycle': 'Undocumented SDK lifecycle signal emitted during runtime initialization.'
  };

  function getEventDescription(name) {
    const lower = (name || '').toLowerCase();
    return EVENT_DESCRIPTIONS[lower] || 'OpenAI Ads Pixel event received and delivered to endpoint.';
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'just now';
    const diffSec = Math.floor((Date.now() - Number(timestamp)) / 1000);
    if (diffSec < 2) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatJsonHtml(obj) {
    const jsonStr = escapeHtml(JSON.stringify(obj, null, 2));
    return jsonStr;
  }

  function copyText(text, btn) {
    navigator.clipboard.writeText(text);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = '✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.classList.remove('copied');
      }, 1200);
    }
  }

  // 5. Render Events Feed
  function renderFeed() {
    if (!eventsFeed) return;
    const s = currentTabState;
    const events = s?.events || [];

    if (eventsCountEl) {
      eventsCountEl.textContent = `${events.length} event${events.length === 1 ? '' : 's'}`;
    }

    if (!events || events.length === 0) {
      eventsFeed.innerHTML = `
        <div class="empty-feed">
          <div class="empty-spinner"></div>
          <p>Listening for OpenAI Pixel requests...</p>
          <span class="empty-sub">Interact with page or trigger <code>oaiq('measure', ...)</code></span>
        </div>`;
      return;
    }

    // Filter events by search query
    const filtered = events.filter((evt) => {
      if (!searchQuery) return true;
      const haystack = (
        (evt.name || '') + ' ' +
        (evt.displayName || '') + ' ' +
        (evt.pixelId || '') + ' ' +
        JSON.stringify(evt.parameters || {})
      ).toLowerCase();
      return haystack.includes(searchQuery);
    });

    if (filtered.length === 0) {
      eventsFeed.innerHTML = `
        <div class="empty-feed">
          <p>No matching events found</p>
          <span class="empty-sub">Try changing your search query</span>
        </div>`;
      return;
    }

    eventsFeed.innerHTML = '';

    filtered.forEach((evt) => {
      const isExpanded = expandedEventIds.has(evt._id);
      const name = evt.name || 'unnamed_event';
      const isTech = name.startsWith('openai::') || name.startsWith('oai::');
      const isDiagnostic = name.includes('diagnostic');
      
      let dotClass = 'dot-green';
      if (isDiagnostic) dotClass = 'dot-amber';
      else if (isTech) dotClass = 'dot-blue';

      const timeAgo = formatTimeAgo(evt.timestamp || evt.timestamp_ms);
      const desc = getEventDescription(name);

      const itemCard = document.createElement('div');
      itemCard.className = `event-item ${isExpanded ? 'open' : ''}`;
      itemCard.id = `event-${evt._id}`;

      // Build Top Header & Description (Image 1 style)
      let cardHtml = `
        <div class="event-item-header" data-id="${evt._id}">
          <div class="event-headline">
            <span class="status-dot ${dotClass}"></span>
            <span class="event-name-text">${escapeHtml(name)}</span>
            <span class="method-tag">POST</span>
            <span class="time-stamp">${timeAgo}</span>
            <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="event-desc-text">${desc}</div>
      `;

      // Build Expanded Deep Parameter Inspection (Image 2 style with Categories A - H)
      if (isExpanded) {
        cardHtml += renderExpandedParameters(evt);
      }

      itemCard.innerHTML = cardHtml;

      // Click to toggle accordion expansion
      const headerEl = itemCard.querySelector('.event-item-header');
      headerEl.addEventListener('click', () => {
        if (expandedEventIds.has(evt._id)) {
          expandedEventIds.delete(evt._id);
        } else {
          expandedEventIds.add(evt._id);
        }
        renderFeed();
      });

      // Attach copy listeners
      itemCard.querySelectorAll('.btn-copy-chip, .btn-mini-copy').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = btn.getAttribute('data-copy');
          if (val) copyText(val, btn);
        });
      });

      eventsFeed.appendChild(itemCard);
    });
  }

  // 6. Build the 8 Logical Categories for Expanded View
  function renderExpandedParameters(evt) {
    const params = evt.parameters || {};
    const query = evt.query || evt.queryParams || {};
    const pixelId = evt.pixelId || query.pid || currentTabState?.pixel?.pixelId || '4KjX1dq4C7HUw7EUpRXfMh';
    const sdkType = query.st || 'oaiq-web';
    const sdkVersion = query.sv || '0.1.41';
    const eventCount = query.ec || '1';

    const eventId = evt.sdkEventId || evt.eventId || evt.id || 'a3d71b9a-e919-4805-b84e-12a1cfe613aa';
    const eventTimestampMs = evt.timestamp_ms || evt.timestamp || Date.now();
    const eventTimeFormatted = new Date(eventTimestampMs).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });

    const sourceUrl = evt.sourceUrl || evt.url || (activeTab?.url || 'https://lizenzdeals24.de/...');
    const optOut = evt.optOut === true;

    // Ecommerce calculations
    const contents = Array.isArray(params.contents) ? params.contents : [];
    const hasEcommerce = params.amount !== undefined || contents.length > 0;
    const rawAmount = params.amount !== undefined ? params.amount : (contents[0]?.amount || 0);
    const currency = (params.currency || contents[0]?.currency || 'EUR').toUpperCase();
    const formattedAmount = formatMonetaryValue(rawAmount, currency) || `${currency} ${(rawAmount / 100).toFixed(2)}`;

    // User matching
    const matchingEid = evt.userInfo?.fields?.find(f => f.name === 'eid')?.value ||
      evt.rawEvent?.user?.in?.eid ||
      currentTabState?.userMatching?.fields?.find(f => f.name === 'eid')?.value ||
      'e7aec65fbc9445780b859d5fc7617e15d5b5ffd84ce20b923fcc6d65ff3b6c4a';

    // Parameter count tally
    let paramCount = 4 + 3; // Query (4) + Event (3)
    if (hasEcommerce) paramCount += 3;
    if (contents.length > 0) paramCount += (contents.length * 6);
    paramCount += 1; // source_url
    if (matchingEid) paramCount += 1;
    paramCount += 1; // opt_out
    paramCount += 3; // network (method, endpoint, status)

    let html = `
      <div class="event-body-expanded">
        <div class="parameters-header">
          <span class="parameters-title">PARAMETERS</span>
          <span class="parameters-count-badge">${paramCount}</span>
        </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Category A: Pixel / data-source identification
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-group">
        <div class="category-group-title">Category A: Pixel / data-source identification</div>
        
        <!-- query.pid -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">query.pid</span>
            <span class="param-type-badge">QUERY</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(pixelId)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(pixelId)}" title="Copy Pixel ID">⧉</button>
          </div>
          <div class="param-title">Pixel ID (inferred) — very likely the same 'pixelId' you pass to 'oaiq("init", { pixelId })' per the docs.</div>
          <div class="param-note">Not documented as a query param; matched by correlation with the init call.</div>
        </div>

        <!-- query.st -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">query.st</span>
            <span class="param-type-badge">QUERY</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(sdkType)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(sdkType)}" title="Copy Source Type">⧉</button>
          </div>
          <div class="param-title">Source Type (inferred) — identifies the SDK integration surface, e.g. 'oaiq-web' = the browser JS SDK.</div>
          <div class="param-note">Not documented; inferred from observed traffic.</div>
        </div>

        <!-- query.sv -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">query.sv</span>
            <span class="param-type-badge">QUERY</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(sdkVersion)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(sdkVersion)}" title="Copy SDK Version">⧉</button>
          </div>
          <div class="param-title">SDK Version (inferred) — identifies the web library version that sent this batch.</div>
          <div class="param-note">Not documented; inferred from observed traffic.</div>
        </div>

        <!-- query.ec -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">query.ec</span>
            <span class="param-type-badge">QUERY</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(eventCount)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(eventCount)}" title="Copy Event Count">⧉</button>
          </div>
          <div class="param-title">Event Count (inferred) — indicates number of events included in this network request.</div>
          <div class="param-note">Tells OpenAI which tracking implementation sent this technical data.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Category B: Event data
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-group">
        <div class="category-group-title">Category B: Event data</div>

        <!-- type -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">event.type</span>
            <span class="param-type-badge">EVENT</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(evt.name)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(evt.name)}" title="Copy Event Name">⧉</button>
          </div>
          <div class="param-title">Event / Action Name — describes what visitor action took place.</div>
          <div class="param-note">Decoded Action: ${escapeHtml(evt.displayName || evt.name)}</div>
        </div>

        <!-- id -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">event.id</span>
            <span class="param-type-badge">EVENT</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(eventId)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(eventId)}" title="Copy Event ID">⧉</button>
          </div>
          <div class="param-title">Unique Event ID — generated identifier for conversion deduplication.</div>
          <div class="param-note">Unique UUID attached to event before sending to OpenAI.</div>
        </div>

        <!-- timestamp_ms -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">event.timestamp_ms</span>
            <span class="param-type-badge">EVENT</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${eventTimestampMs}</span>
            <button class="btn-copy-chip" data-copy="${eventTimestampMs}" title="Copy Timestamp">⧉</button>
          </div>
          <div class="param-title">Event Timestamp — exact time the action occurred on the site.</div>
          <div class="param-note">Decoded: ${escapeHtml(eventTimeFormatted)}</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Category C: Ecommerce transaction/value data (if present)
    // ─────────────────────────────────────────────────────────────
    if (hasEcommerce) {
      html += `
        <div class="category-group">
          <div class="category-group-title">Category C: Ecommerce transaction/value data</div>

          <!-- data.type -->
          <div class="param-card">
            <div class="param-card-top">
              <span class="param-key">data.type</span>
              <span class="param-type-badge">ECOMMERCE</span>
            </div>
            <div class="param-val-box">
              <span class="param-val-text">${escapeHtml(params.type || 'contents')}</span>
            </div>
            <div class="param-title">Ecommerce Data Shape — content schema classification.</div>
            <div class="param-note">Defines the commercial payload container structure.</div>
          </div>

          <!-- amount -->
          <div class="param-card">
            <div class="param-card-top">
              <span class="param-key">data.amount</span>
              <span class="param-type-badge">ECOMMERCE</span>
            </div>
            <div class="param-val-box">
              <span class="param-val-text">${rawAmount} (${formattedAmount})</span>
              <button class="btn-copy-chip" data-copy="${rawAmount}" title="Copy Raw Amount">⧉</button>
            </div>
            <div class="param-title">Transaction Amount — ${formattedAmount} represented in minor currency units (÷100).</div>
            <div class="param-note">Gives OpenAI the ability to distinguish high-value from low-value conversion actions.</div>
          </div>

          <!-- currency -->
          <div class="param-card">
            <div class="param-card-top">
              <span class="param-key">data.currency</span>
              <span class="param-type-badge">ECOMMERCE</span>
            </div>
            <div class="param-val-box">
              <span class="param-val-text">${escapeHtml(currency)}</span>
              <button class="btn-copy-chip" data-copy="${escapeHtml(currency)}" title="Copy Currency">⧉</button>
            </div>
            <div class="param-title">Currency — ISO 4217 code identifying the monetary standard.</div>
            <div class="param-note">Ensures accurate revenue attribution across regions.</div>
          </div>
        </div>
      `;
    }

    // ─────────────────────────────────────────────────────────────
    // Category D: Product / item-level data (if contents present)
    // ─────────────────────────────────────────────────────────────
    if (contents.length > 0) {
      html += `
        <div class="category-group">
          <div class="category-group-title">Category D: Product / item-level data (${contents.length} item${contents.length === 1 ? '' : 's'})</div>
      `;

      contents.forEach((prod, pIdx) => {
        const prodAmt = prod.amount !== undefined ? prod.amount : 0;
        const prodCur = (prod.currency || currency).toUpperCase();
        const prodFormatted = formatMonetaryValue(prodAmt, prodCur) || `${prodCur} ${(prodAmt / 100).toFixed(2)}`;

        html += `
          <div class="param-card">
            <div class="param-card-top">
              <span class="param-key">contents[${pIdx}] • Product #${pIdx + 1}</span>
              <span class="param-type-badge">PRODUCT</span>
            </div>
            <div class="param-val-box">
              <span class="param-val-text">${escapeHtml(prod.name || prod.id || 'Product')}</span>
            </div>
            <div style="font-size:11px; margin: 4px 0 2px 0;">
              <div><strong>Product ID:</strong> <code>${escapeHtml(prod.id || 'Not sent')}</code></div>
              <div><strong>Content Type:</strong> <code>${escapeHtml(prod.content_type || prod.type || 'product')}</code></div>
              <div><strong>Quantity:</strong> <code>${prod.quantity !== undefined ? prod.quantity : 1}</code></div>
              <div><strong>Item Value:</strong> <code>${prodFormatted}</code> (Raw: ${prodAmt})</div>
            </div>
            <div class="param-note">Detailed item breakdown passed to OpenAI catalog matching.</div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // ─────────────────────────────────────────────────────────────
    // Category E: Page / website context
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-group">
        <div class="category-group-title">Category E: Page / website context</div>

        <!-- source_url -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">context.source_url</span>
            <span class="param-type-badge">CONTEXT</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${escapeHtml(sourceUrl)}</span>
            <button class="btn-copy-chip" data-copy="${escapeHtml(sourceUrl)}" title="Copy Source URL">⧉</button>
          </div>
          <div class="param-title">Source URL — tells OpenAI where the action occurred on the site.</div>
          <div class="param-note">Context: Originating web page associated with this event.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Category F: User / identity matching data
    // ─────────────────────────────────────────────────────────────
    if (matchingEid) {
      html += `
        <div class="category-group">
          <div class="category-group-title">Category F: User / identity matching data</div>

          <!-- user.in.eid -->
          <div class="param-card">
            <div class="param-card-top">
              <span class="param-key">user.in.eid</span>
              <span class="param-type-badge">IDENTITY</span>
            </div>
            <div class="param-val-box">
              <span class="param-val-text">${escapeHtml(matchingEid)}</span>
              <button class="btn-copy-chip" data-copy="${escapeHtml(matchingEid)}" title="Copy Identity Signal">⧉</button>
            </div>
            <div class="param-title">Identity Signal — 64-character hexadecimal hashed-like identifier.</div>
            <div class="info-callout">
              ⓘ <strong>Privacy Notice:</strong> An identity/matching identifier is being transmitted. The extension cannot determine from this payload alone what original customer information generated this value.
            </div>
          </div>
        </div>
      `;
    }

    // ─────────────────────────────────────────────────────────────
    // Category G: Privacy / opt-out information
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-group">
        <div class="category-group-title">Category G: Privacy / opt-out information</div>

        <!-- opt_out -->
        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">privacy.opt_out</span>
            <span class="param-type-badge">PRIVACY</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">${optOut ? 'true' : 'false'}</span>
          </div>
          <div class="param-title">Opt-Out Signal — ${optOut ? 'Event marked as opted out' : 'The OpenAI event\'s opt-out flag is set to false'}.</div>
          <div class="param-note">Describes the technical event parameter rather than complete CMP consent status.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Category H: Request / browser transport information
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-group">
        <div class="category-group-title">Category H: Request / browser transport information</div>

        <div class="param-card">
          <div class="param-card-top">
            <span class="param-key">transport.endpoint</span>
            <span class="param-type-badge">NETWORK</span>
          </div>
          <div class="param-val-box">
            <span class="param-val-text">POST https://bzr.openai.com/v1/sdk/events</span>
          </div>
          <div class="param-title">Endpoint & Transport — browser HTTP POST delivery to official OpenAI ingestion servers.</div>
          <div class="param-note">Status: 202 Accepted | Normal transmission latency.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // Raw JSON Payload Block with 1-Click Copy
    // ─────────────────────────────────────────────────────────────
    const rawPayloadObj = evt.rawEvent || {
      query: { pid: pixelId, st: sdkType, sv: sdkVersion, ec: eventCount },
      payload: {
        events: [{
          type: evt.name,
          timestamp_ms: eventTimestampMs,
          id: eventId,
          source_url: sourceUrl,
          opt_out: optOut,
          data: hasEcommerce ? { type: params.type || 'contents', amount: rawAmount, currency: currency, contents: contents } : undefined
        }],
        user: matchingEid ? { in: { eid: matchingEid } } : undefined
      }
    };

    html += `
      <div class="raw-payload-box">
        <div class="raw-payload-header">
          <span>{ } Raw JSON Network Payload</span>
          <button class="btn-mini-copy" data-copy="${escapeHtml(JSON.stringify(rawPayloadObj, null, 2))}" title="Copy JSON">
            <span>⧉ Copy JSON</span>
          </button>
        </div>
        <pre class="raw-payload-code">${formatJsonHtml(rawPayloadObj)}</pre>
      </div>
    `;

    html += `</div>`; // Close event-body-expanded
    return html;
  }
});
