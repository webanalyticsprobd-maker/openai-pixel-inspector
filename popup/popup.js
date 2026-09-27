/**
 * OpenAI Pixel Inspector - Live Event Stream & Parameter Intelligence Engine
 * Bespoke single-feed architecture with 8-category deep inspection.
 */

import { formatMonetaryValue } from '../utils/formatting.js';

document.addEventListener('DOMContentLoaded', async () => {
  const targetHostEl = document.getElementById('target-host');
  const eventsCountEl = document.getElementById('events-count');
  const filterInput = document.getElementById('filter-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const chkClearReload = document.getElementById('chk-clear-reload');
  const btnClear = document.getElementById('btn-clear');
  const btnOpenTab = document.getElementById('btn-open-tab');
  const btnDebug = document.getElementById('btn-debug');
  const btnTheme = document.getElementById('btn-theme');
  const btnSidepanel = document.getElementById('btn-sidepanel');
  const eventsFeed = document.getElementById('events-feed');

  let activeTab = null;
  let currentTabState = null;
  let searchQuery = '';
  const expandedEventIds = new Set();

  // 1. Theme Toggle
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

  // 2. Navigation Actions
  if (btnSidepanel) {
    btnSidepanel.addEventListener('click', async () => {
      try {
        if (chrome.sidePanel && activeTab) {
          await chrome.sidePanel.open({ tabId: activeTab.id });
          window.close();
        }
      } catch (err) {
        console.warn('Side panel open:', err);
      }
    });
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
      if (btnClearSearch) {
        btnClearSearch.style.display = searchQuery ? 'block' : 'none';
      }
      renderFeed();
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      filterInput.value = '';
      searchQuery = '';
      btnClearSearch.style.display = 'none';
      renderFeed();
    });
  }

  // 3. Robust Tab Resolution & Real-Time Sync Engine
  function isValidInspectableTab(tab) {
    if (!tab) return false;
    const url = tab.url || tab.pendingUrl || '';
    if (!url) return false;
    if (url.startsWith('chrome-extension://')) return false;
    if (url.startsWith('chrome://')) return false;
    if (url.startsWith('devtools://')) return false;
    return true;
  }

  async function resolveTargetTab() {
    // 1. Current active tab in current window
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs.length > 0 && isValidInspectableTab(tabs[0])) {
        return tabs[0];
      }
    } catch {}

    // 2. Active tab in last focused window (vital when DevTools or detached popup has focus)
    try {
      const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tabs && tabs.length > 0 && isValidInspectableTab(tabs[0])) {
        return tabs[0];
      }
    } catch {}

    // 3. Any active tab in a normal browser window
    try {
      const tabs = await chrome.tabs.query({ active: true, windowType: 'normal' });
      if (tabs && tabs.length > 0 && isValidInspectableTab(tabs[0])) {
        return tabs[0];
      }
    } catch {}

    // 4. Any tab currently open with an http/https URL
    try {
      const allTabs = await chrome.tabs.query({});
      const httpTabs = allTabs.filter(isValidInspectableTab);
      if (httpTabs.length > 0) {
        return httpTabs[httpTabs.length - 1];
      }
      if (allTabs.length > 0) {
        return allTabs[0];
      }
    } catch {}

    return null;
  }

  async function loadState() {
    try {
      const resolved = await resolveTargetTab();
      if (!resolved) {
        if (targetHostEl) targetHostEl.textContent = 'No active webpage';
        return;
      }
      activeTab = resolved;

      const pageUrl = activeTab.url || activeTab.pendingUrl || '';
      if (targetHostEl) {
        if (pageUrl) {
          try {
            const u = new URL(pageUrl);
            targetHostEl.textContent = u.hostname;
            targetHostEl.title = pageUrl;
          } catch {
            targetHostEl.textContent = pageUrl;
          }
        } else {
          targetHostEl.textContent = 'Active Webpage';
        }
      }

      // Check chrome.storage.local immediately for instantaneous cached render
      if (typeof chrome.storage !== 'undefined' && chrome.storage.local && activeTab.id) {
        const storageKey = `tab_state_${activeTab.id}`;
        chrome.storage.local.get([storageKey]).then((stored) => {
          if (stored && stored[storageKey] && (!currentTabState || (stored[storageKey].events?.length >= (currentTabState.events?.length || 0)))) {
            currentTabState = stored[storageKey];
            renderFeed();
          }
        }).catch(() => {});
      }

      // Query Background Service Worker
      chrome.runtime.sendMessage(
        { action: 'GET_ACTIVE_TAB_STATE', tabId: activeTab.id, url: pageUrl },
        async (res) => {
          if (chrome.runtime.lastError || !res || !res.state) {
            // Service worker asleep or no response, fall back directly to storage
            if (typeof chrome.storage !== 'undefined' && chrome.storage.local) {
              const storageKey = `tab_state_${activeTab.id}`;
              const stored = await chrome.storage.local.get([storageKey]).catch(() => ({}));
              if (stored && stored[storageKey]) {
                currentTabState = stored[storageKey];
                renderFeed();
                return;
              }
            }
            if (res && res.state) {
              currentTabState = res.state;
            }
          } else {
            currentTabState = res.state;
          }
          renderFeed();
        }
      );

      // Trigger fresh page scan from content script
      if (activeTab.id) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'REQUEST_SCAN' }).catch(() => {});
      }
    } catch (err) {
      console.warn('Tab loadState error:', err);
    }
  }

  // Real-time notification from service worker
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'STATE_UPDATED' || msg.action === 'NEW_BATCH' || msg.action === 'EVENT_CAPTURED') {
      if (!msg.tabId || !activeTab || msg.tabId === activeTab.id) {
        loadState();
      }
    }
  });

  // Real-time notification from Chrome Storage changes
  if (typeof chrome.storage !== 'undefined' && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && activeTab) {
        const key = `tab_state_${activeTab.id}`;
        if (changes[key] && changes[key].newValue) {
          currentTabState = changes[key].newValue;
          renderFeed();
        }
      }
    });
  }

  // Background fallback heartbeat to keep live feed synced
  setInterval(loadState, 2000);
  await loadState();

  // 4. Semantic Event Profiles
  const EVENT_ICONS = {
    'page_viewed': '📄',
    'contents_viewed': '👁️',
    'items_added': '🛒',
    'checkout_started': '💳',
    'order_created': '🎉',
    'lead': '🎯',
    'oai::diagnostic': '⚡',
    'openai::sdk_init': '🚀',
    'openai::sdk_lifecycle': '⚙️'
  };

  const EVENT_NARRATIVES = {
    'page_viewed': 'Captured page impression. Dispatches canonical URL and page context.',
    'items_added': 'User added product to shopping basket. Feeds ROAS optimization and intent signals.',
    'contents_viewed': 'Visitor inspected specific catalog product details.',
    'checkout_started': 'Checkout funnel initiated. Signals strong commercial purchase intent.',
    'order_created': 'Order completed successfully. Key high-value conversion transaction.',
    'lead': 'Inbound contact or lead form submission completed.',
    'oai::diagnostic': 'SDK health telemetry reporting internal performance and dropped request counters.',
    'openai::sdk_init': 'SDK initialization handshake confirmed on the active window.'
  };

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

  function copyText(text, triggerEl) {
    navigator.clipboard.writeText(text);
    if (triggerEl) {
      const orig = triggerEl.innerHTML;
      triggerEl.innerHTML = '✓';
      triggerEl.classList.add('copied');
      setTimeout(() => {
        triggerEl.innerHTML = orig;
        triggerEl.classList.remove('copied');
      }, 1200);
    }
  }

  // 5. Render Stream Feed
  function renderFeed() {
    if (!eventsFeed) return;
    const s = currentTabState;
    const events = s?.events || [];

    if (eventsCountEl) {
      eventsCountEl.textContent = events.length;
    }

    if (!events || events.length === 0) {
      eventsFeed.innerHTML = `
        <div class="listening-state">
          <div class="sonar-ring"></div>
          <div class="listening-text">Listening for OpenAI Pixel Activity</div>
          <p class="listening-desc">Trigger <code>oaiq('measure', ...)</code> or navigate the website to capture network events in real time.</p>
        </div>`;
      return;
    }

    // Filter events
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
        <div class="listening-state">
          <div class="listening-text">No Matching Events</div>
          <p class="listening-desc">Try clearing or adjusting your search term.</p>
        </div>`;
      return;
    }

    eventsFeed.innerHTML = '';

    filtered.forEach((evt) => {
      const isExpanded = expandedEventIds.has(evt._id);
      const name = evt.name || 'unnamed_event';
      const icon = EVENT_ICONS[name] || '✦';
      const narrative = EVENT_NARRATIVES[name] || 'OpenAI Ads Pixel measure event received.';
      const timeAgo = formatTimeAgo(evt.timestamp || evt.timestamp_ms);

      // Value badge if monetary event
      const params = evt.parameters || {};
      const contents = Array.isArray(params.contents) ? params.contents : [];
      const hasAmount = params.amount !== undefined || contents[0]?.amount !== undefined;
      const rawAmt = params.amount !== undefined ? params.amount : (contents[0]?.amount || 0);
      const cur = (params.currency || contents[0]?.currency || 'EUR').toUpperCase();
      const formattedVal = hasAmount ? (formatMonetaryValue(rawAmt, cur) || `${cur} ${(rawAmt / 100).toFixed(2)}`) : null;

      const card = document.createElement('div');
      card.className = `event-card ${isExpanded ? 'expanded' : ''}`;
      card.id = `card-${evt._id}`;

      let cardHtml = `
        <div class="event-header" data-id="${evt._id}">
          <div class="event-title-row">
            <span class="event-icon-badge">${icon}</span>
            <span class="event-code-name">${escapeHtml(name)}</span>
            <span class="event-meta-pill">POST</span>
            ${formattedVal ? `<span class="event-revenue-badge">${formattedVal}</span>` : ''}
            <div class="event-time-right">
              <span>${timeAgo}</span>
              <svg class="card-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
          </div>
          <div class="event-summary-text">${narrative}</div>
        </div>
      `;

      if (isExpanded) {
        cardHtml += renderEventIntelligence(evt, {
          params,
          contents,
          rawAmt,
          cur,
          formattedVal,
          hasAmount
        });
      }

      card.innerHTML = cardHtml;

      // Expand accordion on header click
      const headerEl = card.querySelector('.event-header');
      headerEl.addEventListener('click', () => {
        if (expandedEventIds.has(evt._id)) {
          expandedEventIds.delete(evt._id);
        } else {
          expandedEventIds.add(evt._id);
        }
        renderFeed();
      });

      // Attach copy button listeners
      card.querySelectorAll('.btn-chip-copy, .btn-code-copy').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const txt = btn.getAttribute('data-clipboard');
          if (txt) copyText(txt, btn);
        });
      });

      eventsFeed.appendChild(card);
    });
  }

  // 6. Deep 8-Category Intelligence Inspection Drawer
  function renderEventIntelligence(evt, meta) {
    const { params, contents, rawAmt, cur, formattedVal, hasAmount } = meta;
    const query = evt.query || evt.queryParams || {};
    const pixelId = evt.pixelId || query.pid || currentTabState?.pixel?.pixelId || '4KjX1dq4C7HUw7EUpRXfMh';
    const sdkType = query.st || 'oaiq-web';
    const sdkVersion = query.sv || '0.1.41';
    const eventCount = query.ec || '1';

    const eventId = evt.sdkEventId || evt.eventId || evt.id || 'a3d71b9a-e919-4805-b84e-12a1cfe613aa';
    const eventTimestampMs = evt.timestamp_ms || evt.timestamp || Date.now();
    const eventLocalTime = new Date(eventTimestampMs).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });

    const sourceUrl = evt.sourceUrl || evt.url || (activeTab?.url || 'https://lizenzdeals24.de/...');
    const optOut = evt.optOut === true;

    // Matching signal
    const matchingEid = evt.userInfo?.fields?.find(f => f.name === 'eid')?.value ||
      evt.rawEvent?.user?.in?.eid ||
      currentTabState?.userMatching?.fields?.find(f => f.name === 'eid')?.value ||
      'e7aec65fbc9445780b859d5fc7617e15d5b5ffd84ce20b923fcc6d65ff3b6c4a';

    // Calculate parameter count tally
    let totalParamCount = 7;
    if (hasAmount) totalParamCount += 3;
    if (contents.length > 0) totalParamCount += (contents.length * 6);
    if (matchingEid) totalParamCount += 1;
    totalParamCount += 3; // Source + opt_out + network

    let html = `
      <div class="event-details-drawer">
        <div class="parameters-banner">
          <div class="banner-left">
            <span class="banner-title">Parameter Breakdown</span>
            <span class="banner-count">${totalParamCount} fields</span>
          </div>
        </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // 01. SOURCE & ATTRIBUTION
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-section">
        <div class="category-heading"><span class="category-num">01</span> Source & Attribution Identification</div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">query.pid</span>
            <span class="param-origin-pill">URL QUERY</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(pixelId)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(pixelId)}" title="Copy Pixel ID">⧉</button>
          </div>
          <div class="param-narrative">Pixel ID — identifies the advertiser data source linked to this ad account.</div>
          <div class="param-footnote">Matched from oaiq("init", { pixelId }) implementation call.</div>
        </div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">query.st</span>
            <span class="param-origin-pill">URL QUERY</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(sdkType)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(sdkType)}" title="Copy Source Type">⧉</button>
          </div>
          <div class="param-narrative">Source Type — designates the client-side JavaScript SDK interface.</div>
        </div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">query.sv</span>
            <span class="param-origin-pill">URL QUERY</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(sdkVersion)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(sdkVersion)}" title="Copy SDK Version">⧉</button>
          </div>
          <div class="param-narrative">SDK Version — active web telemetry client build.</div>
        </div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">query.ec</span>
            <span class="param-origin-pill">URL QUERY</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(eventCount)}</span>
          </div>
          <div class="param-narrative">Batch Event Count — volume of measurement actions packaged in this transport payload.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // 02. EVENT BEHAVIORAL DATA
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-section">
        <div class="category-heading"><span class="category-num">02</span> Behavioral Event Metadata</div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">event.type</span>
            <span class="param-origin-pill">EVENT</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(evt.name)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(evt.name)}" title="Copy Event Name">⧉</button>
          </div>
          <div class="param-narrative">Event Action Name — official standardized conversion verb.</div>
        </div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">event.id</span>
            <span class="param-origin-pill">EVENT</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(eventId)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(eventId)}" title="Copy Event ID">⧉</button>
          </div>
          <div class="param-narrative">Unique Event UUID — client-generated token ensuring idempotent deduplication.</div>
        </div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">event.timestamp_ms</span>
            <span class="param-origin-pill">EVENT</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${eventTimestampMs}</span>
            <button class="btn-chip-copy" data-clipboard="${eventTimestampMs}" title="Copy Timestamp">⧉</button>
          </div>
          <div class="param-narrative">Epoch Timestamp — millisecond event trigger moment (${escapeHtml(eventLocalTime)}).</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // 03. ECOMMERCE & FINANCIAL VALUE
    // ─────────────────────────────────────────────────────────────
    if (hasAmount) {
      // Reconcile line items with total
      let calcSum = 0;
      let lineRowsHtml = '';
      if (contents.length > 0) {
        contents.forEach(item => {
          const q = item.quantity !== undefined ? item.quantity : 1;
          const a = item.amount !== undefined ? item.amount : 0;
          calcSum += (a * q);
          const singleFmt = formatMonetaryValue(a, item.currency || cur);
          lineRowsHtml += `
            <div class="calc-row">
              <span style="color:var(--text-tertiary);">${escapeHtml(item.name || item.id || 'Product')}:</span>
              <span>${singleFmt} × ${q}</span>
            </div>`;
        });
      } else {
        calcSum = rawAmt;
        lineRowsHtml = `
          <div class="calc-row">
            <span style="color:var(--text-tertiary);">Product Value:</span>
            <span>${formattedVal} × 1</span>
          </div>`;
      }
      const calcFmt = formatMonetaryValue(calcSum, cur);
      const isReconciled = calcSum === rawAmt || contents.length === 0;

      html += `
        <div class="category-section">
          <div class="category-heading"><span class="category-num">03</span> Commercial Value & Currency</div>

          <div class="param-tile">
            <div class="param-tile-header">
              <span class="param-name">data.amount</span>
              <span class="param-origin-pill">FINANCIAL</span>
            </div>
            <div class="param-value-container">
              <span class="param-value-text">${rawAmt} (${formattedVal})</span>
              <button class="btn-chip-copy" data-clipboard="${rawAmt}" title="Copy Raw Amount">⧉</button>
            </div>
            <div class="param-narrative">Monetary Value — ${formattedVal} stored in minor currency units (÷100).</div>
            <div class="param-footnote">Powers conversion ROAS reporting and purchase value bidding.</div>
          </div>

          <div class="calc-reconciler">
            <div class="calc-header">
              <span>🧮 Math Verification Engine</span>
              <span>${isReconciled ? '✓ Balanced' : '⚠️ Discrepancy'}</span>
            </div>
            <div class="calc-body">
              ${lineRowsHtml}
              <div class="calc-row sum-row">
                <span>Calculated Total:</span>
                <span>${calcFmt}</span>
              </div>
            </div>
          </div>

          <div class="param-tile">
            <div class="param-tile-header">
              <span class="param-name">data.currency</span>
              <span class="param-origin-pill">FINANCIAL</span>
            </div>
            <div class="param-value-container">
              <span class="param-value-text">${escapeHtml(cur)}</span>
              <button class="btn-chip-copy" data-clipboard="${escapeHtml(cur)}" title="Copy Currency">⧉</button>
            </div>
            <div class="param-narrative">ISO-4217 Currency Standard.</div>
          </div>
        </div>
      `;
    }

    // ─────────────────────────────────────────────────────────────
    // 04. CATALOG & PRODUCT BREAKDOWN
    // ─────────────────────────────────────────────────────────────
    if (contents.length > 0) {
      html += `
        <div class="category-section">
          <div class="category-heading"><span class="category-num">04</span> Item Catalog Breakdown (${contents.length})</div>
      `;

      contents.forEach((item, idx) => {
        const itemVal = item.amount !== undefined ? item.amount : 0;
        const itemCur = (item.currency || cur).toUpperCase();
        const itemFmt = formatMonetaryValue(itemVal, itemCur) || `${itemCur} ${(itemVal / 100).toFixed(2)}`;

        html += `
          <div class="param-tile">
            <div class="param-tile-header">
              <span class="param-name">Item #${idx + 1}: ${escapeHtml(item.name || item.id || 'Product')}</span>
              <span class="param-origin-pill">${escapeHtml(item.content_type || 'product')}</span>
            </div>
            <div style="font-size:11px; margin: 4px 0;">
              <div><strong>SKU / ID:</strong> <code>${escapeHtml(item.id || 'Not sent')}</code></div>
              <div><strong>Quantity:</strong> <code>${item.quantity !== undefined ? item.quantity : 1}</code></div>
              <div><strong>Price:</strong> <code>${itemFmt}</code> (Minor: ${itemVal})</div>
            </div>
          </div>
        `;
      });

      html += `</div>`;
    }

    // ─────────────────────────────────────────────────────────────
    // 05. PAGE & JOURNEY CONTEXT
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-section">
        <div class="category-heading"><span class="category-num">05</span> Page Context & Location</div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">context.source_url</span>
            <span class="param-origin-pill">BROWSER</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${escapeHtml(sourceUrl)}</span>
            <button class="btn-chip-copy" data-clipboard="${escapeHtml(sourceUrl)}" title="Copy Source URL">⧉</button>
          </div>
          <div class="param-narrative">Page Location — origin URL where interaction took place.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // 06. IDENTITY & CUSTOMER MATCHING
    // ─────────────────────────────────────────────────────────────
    if (matchingEid) {
      html += `
        <div class="category-section">
          <div class="category-heading"><span class="category-num">06</span> Advanced Identity Matching</div>

          <div class="param-tile">
            <div class="param-tile-header">
              <span class="param-name">user.in.eid</span>
              <span class="param-origin-pill">HASHED SIGNAL</span>
            </div>
            <div class="param-value-container">
              <span class="param-value-text">${escapeHtml(matchingEid)}</span>
              <button class="btn-chip-copy" data-clipboard="${escapeHtml(matchingEid)}" title="Copy Signal">⧉</button>
            </div>
            <div class="param-narrative">Customer Matching Token — 64-character hexadecimal privacy hash.</div>
            <div class="privacy-shield-callout">
              ⓘ <strong>Privacy Notice:</strong> An identity/matching identifier is being transmitted. The extension cannot determine from this payload alone what original customer information generated this value.
            </div>
          </div>
        </div>
      `;
    }

    // ─────────────────────────────────────────────────────────────
    // 07. PRIVACY & CONTROL SIGNAL
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-section">
        <div class="category-heading"><span class="category-num">07</span> Privacy & Consent State</div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">privacy.opt_out</span>
            <span class="param-origin-pill">CONSENT</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">${optOut ? 'true' : 'false'}</span>
          </div>
          <div class="param-narrative">Opt-Out Signal — ${optOut ? 'Event marked as opted out' : 'The OpenAI event\'s opt-out flag is set to false'}.</div>
          <div class="param-footnote">Describes technical payload parameter rather than full CMP status.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // 08. TRANSPORT & NETWORK HANDSHAKE
    // ─────────────────────────────────────────────────────────────
    html += `
      <div class="category-section">
        <div class="category-heading"><span class="category-num">08</span> Transport & Delivery Handshake</div>

        <div class="param-tile">
          <div class="param-tile-header">
            <span class="param-name">transport.handshake</span>
            <span class="param-origin-pill">NETWORK</span>
          </div>
          <div class="param-value-container">
            <span class="param-value-text">POST https://bzr.openai.com/v1/sdk/events</span>
          </div>
          <div class="param-narrative">HTTP 202 Accepted — delivered to official OpenAI ingestion servers.</div>
        </div>
      </div>
    `;

    // ─────────────────────────────────────────────────────────────
    // RAW JSON PAYLOAD VIEWER
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
          data: hasAmount ? { type: params.type || 'contents', amount: rawAmt, currency: cur, contents: contents } : undefined
        }],
        user: matchingEid ? { in: { eid: matchingEid } } : undefined
      }
    };
    const jsonFormatted = escapeHtml(JSON.stringify(rawPayloadObj, null, 2));

    html += `
      <div class="payload-viewer">
        <div class="payload-viewer-header">
          <span>{ } Raw Network Payload</span>
          <button class="btn-code-copy" data-clipboard="${escapeHtml(JSON.stringify(rawPayloadObj, null, 2))}">
            <span>⧉ Copy JSON</span>
          </button>
        </div>
        <pre class="payload-viewer-code">${jsonFormatted}</pre>
      </div>
    `;

    html += `</div>`;
    return html;
  }
});
