/**
 * OpenAI Ads Pixel Inspector - On-Page Floating HUD & Request Drawer
 * 
 * Injected into the webpage context via isolated Shadow DOM (#openai-pixel-hud-root)
 * to provide a zero-interference, real-time in-browser debugger.
 */

(function () {
  'use strict';

  if (window.__OPENAI_PIXEL_HUD_INITIALIZED__) return;
  window.__OPENAI_PIXEL_HUD_INITIALIZED__ = true;

  // Configuration & State
  let isVisible = true;
  let isDrawerOpen = false;
  let viewMode = 'client'; // 'client' or 'technical'
  let filterMode = 'all';  // 'all', 'conversion', 'error', 'system'

  let capturedRequests = [];
  let capturedEvents = [];
  let detectedPixels = [];
  let selectedEventIndex = -1;

  // Create Container & Isolated Shadow DOM
  const host = document.createElement('div');
  host.id = 'openai-pixel-hud-host';
  host.style.cssText = 'all: initial; position: absolute; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
  
  const shadow = host.attachShadow({ mode: 'open' });
  const attachToDom = () => {
    if (document.body) {
      document.body.appendChild(host);
    } else if (document.documentElement) {
      document.documentElement.appendChild(host);
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachToDom);
  } else {
    attachToDom();
  }

  // Inject Styles into Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .hud-container {
      pointer-events: auto;
      position: fixed;
      z-index: 2147483647;
      font-size: 13px;
      color: #0f172a;
    }

    /* Floating Pill Badge */
    .hud-pill {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #0f172a;
      color: #ffffff;
      border-radius: 30px;
      padding: 8px 16px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      backdrop-filter: blur(8px);
    }

    .hud-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px -4px rgba(0, 0, 0, 0.35);
      border-color: #10a37f;
    }

    .hud-pill-logo {
      width: 20px;
      height: 20px;
      background: #10a37f;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-weight: 700;
      font-size: 10px;
      letter-spacing: -0.5px;
    }

    .hud-pill-title {
      font-weight: 600;
      font-size: 12px;
      letter-spacing: 0.2px;
    }

    .hud-pill-badge {
      background: rgba(255, 255, 255, 0.18);
      border-radius: 12px;
      padding: 2px 7px;
      font-size: 11px;
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .hud-pill-badge.has-errors {
      background: #ef4444;
      color: #ffffff;
    }

    .hud-pill-badge.has-warnings {
      background: #f59e0b;
      color: #0f172a;
    }

    .hud-pill-badge.is-valid {
      background: #10a37f;
      color: #ffffff;
    }

    /* In-Browser Slide-Out Drawer */
    .hud-drawer {
      position: fixed;
      bottom: 70px;
      right: 20px;
      width: 480px;
      max-width: calc(100vw - 40px);
      height: 560px;
      max-height: calc(100vh - 100px);
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.08);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: hudSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 2147483647;
    }

    @keyframes hudSlideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .hud-header {
      background: #0f172a;
      color: #ffffff;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .hud-header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .hud-header-title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.2px;
      color: #ffffff;
    }

    .hud-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-btn-icon {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #e2e8f0;
      border-radius: 6px;
      padding: 5px 8px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.15s;
    }

    .hud-btn-icon:hover {
      background: rgba(255, 255, 255, 0.2);
      color: #ffffff;
    }

    /* Subheader & Controls */
    .hud-subheader {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .hud-view-toggle {
      display: flex;
      background: #e2e8f0;
      border-radius: 6px;
      padding: 2px;
    }

    .hud-view-btn {
      border: none;
      background: transparent;
      padding: 4px 10px;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      border-radius: 4px;
      cursor: pointer;
    }

    .hud-view-btn.active {
      background: #ffffff;
      color: #0f172a;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .hud-filter-group {
      display: flex;
      gap: 4px;
    }

    .hud-filter-btn {
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #475569;
      padding: 3px 8px;
      font-size: 11px;
      border-radius: 4px;
      cursor: pointer;
    }

    .hud-filter-btn.active {
      background: #0f172a;
      color: #ffffff;
      border-color: #0f172a;
    }

    /* Main Body & Event List */
    .hud-body {
      flex: 1;
      overflow-y: auto;
      padding: 10px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      background: #fdfdfd;
    }

    .hud-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      text-align: center;
      padding: 24px;
      gap: 8px;
    }

    .hud-empty-title {
      font-weight: 600;
      color: #64748b;
    }

    /* Event & Request Cards */
    .hud-event-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .hud-event-card:hover {
      border-color: #cbd5e1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .hud-event-card.selected {
      border-color: #10a37f;
      background: #f0fdf9;
    }

    .hud-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .hud-event-name-group {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-event-name {
      font-weight: 700;
      font-size: 12px;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    .hud-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .hud-badge-success { background: #dcfce7; color: #15803d; }
    .hud-badge-warning { background: #fef3c7; color: #b45309; }
    .hud-badge-error { background: #fee2e2; color: #b91c1c; }
    .hud-badge-neutral { background: #f1f5f9; color: #475569; }

    .hud-card-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #64748b;
    }

    .hud-card-desc {
      font-size: 11.5px;
      color: #334155;
      line-height: 1.4;
      background: #f8fafc;
      padding: 6px 8px;
      border-radius: 6px;
      border-left: 3px solid #10a37f;
    }

    /* Technical JSON preview */
    .hud-tech-payload {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 11px;
      background: #0f172a;
      color: #38bdf8;
      padding: 8px 10px;
      border-radius: 6px;
      overflow-x: auto;
      max-height: 160px;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .hud-footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 8px 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
    }

    .hud-footer-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .hud-status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10a37f;
    }
  `;
  shadow.appendChild(style);

  // Main UI Wrapper
  const container = document.createElement('div');
  container.className = 'hud-container';
  shadow.appendChild(container);

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function getHumanDescription(evt) {
    const name = evt.name || evt.type || '';
    const p = evt.parameters || evt.data || {};
    const curr = p.currency || 'USD';
    const amt = typeof p.amount === 'number' ? (p.amount / 100).toFixed(2) : null;

    if (name === 'openai::sdk_init') {
      return 'SDK initialized. Browser connected to OpenAI Ads.';
    }
    if (name === 'page_viewed') {
      return 'Page view tracked. Tells OpenAI the visitor loaded this URL.';
    }
    if (name === 'item_viewed') {
      const title = p.contents?.[0]?.name || p.title || 'Product';
      return `Viewed item "${title}" ${amt ? '(' + curr + ' ' + amt + ')' : ''}.`;
    }
    if (name === 'items_added') {
      return `Added item to cart ${amt ? '(' + curr + ' ' + amt + ')' : ''}.`;
    }
    if (name === 'checkout_started') {
      return `Checkout initiated with ${p.contents?.length || 1} item(s) ${amt ? 'totaling ' + curr + ' ' + amt : ''}.`;
    }
    if (name === 'order_created') {
      return `Conversion completed! Order placed ${amt ? 'for ' + curr + ' ' + amt : ''}.`;
    }
    return `Event "${name}" sent to OpenAI with ${Object.keys(p).length} parameters.`;
  }

  function render() {
    container.innerHTML = '';

    // 1. Floating Pill
    const pill = document.createElement('div');
    pill.className = 'hud-pill';
    pill.title = 'OpenAI Ads Pixel Live In-Browser Debugger (Click to toggle)';

    let errCount = 0;
    let warnCount = 0;
    capturedEvents.forEach(e => {
      if (e.validation?.status === 'error') errCount++;
      else if (e.validation?.status === 'warning') warnCount++;
    });

    let badgeClass = 'is-valid';
    let badgeText = `${capturedEvents.length} evt (${capturedRequests.length} req)`;
    if (errCount > 0) {
      badgeClass = 'has-errors';
      badgeText = `${errCount} err / ${capturedEvents.length} evt`;
    } else if (warnCount > 0) {
      badgeClass = 'has-warnings';
      badgeText = `${warnCount} warn / ${capturedEvents.length} evt`;
    } else if (capturedEvents.length === 0) {
      badgeText = detectedPixels.length > 0 ? `Pixel: ${detectedPixels[0].slice(0, 8)}...` : 'Scanning...';
    }

    pill.innerHTML = `
      <div class="hud-pill-logo">AI</div>
      <div class="hud-pill-title">OpenAI Pixel</div>
      <div class="hud-pill-badge ${badgeClass}">${badgeText}</div>
    `;

    pill.addEventListener('click', () => {
      isDrawerOpen = !isDrawerOpen;
      render();
    });

    container.appendChild(pill);

    // 2. Expandable Drawer
    if (isDrawerOpen) {
      const drawer = document.createElement('div');
      drawer.className = 'hud-drawer';

      // Header
      const header = document.createElement('div');
      header.className = 'hud-header';
      header.innerHTML = `
        <div class="hud-header-left">
          <div class="hud-pill-logo">AI</div>
          <div class="hud-header-title">In-Browser Request Inspector</div>
        </div>
        <div class="hud-header-actions">
          <button class="hud-btn-icon" id="hud-btn-clear" title="Clear captured list">Clear</button>
          <button class="hud-btn-icon" id="hud-btn-close" title="Close drawer">✕</button>
        </div>
      `;

      // Subheader (Client vs Tech toggle + Filters)
      const subheader = document.createElement('div');
      subheader.className = 'hud-subheader';
      subheader.innerHTML = `
        <div class="hud-view-toggle">
          <button class="hud-view-btn ${viewMode === 'client' ? 'active' : ''}" data-view="client">Client Mode</button>
          <button class="hud-view-btn ${viewMode === 'technical' ? 'active' : ''}" data-view="technical">Technical Mode</button>
        </div>
        <div class="hud-filter-group">
          <button class="hud-filter-btn ${filterMode === 'all' ? 'active' : ''}" data-filter="all">All (${capturedEvents.length})</button>
          <button class="hud-filter-btn ${filterMode === 'conversion' ? 'active' : ''}" data-filter="conversion">Conversion</button>
          <button class="hud-filter-btn ${filterMode === 'error' ? 'active' : ''}" data-filter="error">Errors</button>
        </div>
      `;

      // Body (List of Events/Requests)
      const body = document.createElement('div');
      body.className = 'hud-body';

      const filteredEvents = capturedEvents.filter(e => {
        if (filterMode === 'error') return e.validation?.status === 'error';
        if (filterMode === 'conversion') {
          const n = (e.name || e.type || '');
          return ['page_viewed', 'item_viewed', 'items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n);
        }
        return true;
      });

      if (filteredEvents.length === 0) {
        body.innerHTML = `
          <div class="hud-empty">
            <div class="hud-empty-title">${capturedEvents.length === 0 ? 'No OpenAI requests yet' : 'No matching events for this filter'}</div>
            <p style="font-size: 11px;">Interact with the website or navigate between pages to inspect live pixel transmissions.</p>
          </div>
        `;
      } else {
        filteredEvents.forEach((evt, idx) => {
          const card = document.createElement('div');
          card.className = `hud-event-card ${selectedEventIndex === idx ? 'selected' : ''}`;

          const status = evt.validation?.status || 'valid';
          const badgeStyle = status === 'error' ? 'hud-badge-error' : (status === 'warning' ? 'hud-badge-warning' : 'hud-badge-success');
          const eventName = evt.name || evt.type || 'unknown_event';
          const timestampStr = formatTime(evt.timestamp_ms || evt.timestamp);

          if (viewMode === 'client') {
            card.innerHTML = `
              <div class="hud-card-top">
                <div class="hud-event-name-group">
                  <span class="hud-event-name">${eventName}</span>
                  <span class="hud-badge ${badgeStyle}">${status}</span>
                </div>
                <span style="font-size: 10.5px; color: #94a3b8; font-family: monospace;">${timestampStr}</span>
              </div>
              <div class="hud-card-desc">${getHumanDescription(evt)}</div>
            `;
          } else {
            // Technical Mode
            const rawObj = evt.rawPayload || evt.parameters || evt.data || {};
            card.innerHTML = `
              <div class="hud-card-top">
                <div class="hud-event-name-group">
                  <span class="hud-event-name">${eventName}</span>
                  <span class="hud-badge ${badgeStyle}">${status}</span>
                </div>
                <span style="font-size: 10.5px; color: #94a3b8; font-family: monospace;">${timestampStr}</span>
              </div>
              <div class="hud-card-meta">
                <span>Pixel: <b>${evt.pixelId || 'Query pid'}</b></span>
                <span>Type: <b>${evt.data?.type || evt.parameters?.type || 'standard'}</b></span>
              </div>
              <div class="hud-tech-payload">${JSON.stringify(rawObj, null, 2)}</div>
            `;
          }

          card.addEventListener('click', () => {
            selectedEventIndex = selectedEventIndex === idx ? -1 : idx;
            render();
          });

          body.appendChild(card);
        });
      }

      // Footer
      const footer = document.createElement('div');
      footer.className = 'hud-footer';
      footer.innerHTML = `
        <div class="hud-footer-status">
          <span class="hud-status-dot"></span>
          <span>Live In-Browser Inspector Active</span>
        </div>
        <div>Total Requests: <b>${capturedRequests.length}</b></div>
      `;

      drawer.appendChild(header);
      drawer.appendChild(subheader);
      drawer.appendChild(body);
      drawer.appendChild(footer);

      // Event Listeners inside Drawer
      header.querySelector('#hud-btn-close').addEventListener('click', (e) => {
        e.stopPropagation();
        isDrawerOpen = false;
        render();
      });

      header.querySelector('#hud-btn-clear').addEventListener('click', (e) => {
        e.stopPropagation();
        capturedEvents = [];
        capturedRequests = [];
        selectedEventIndex = -1;
        render();
      });

      subheader.querySelectorAll('.hud-view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          viewMode = btn.getAttribute('data-view');
          render();
        });
      });

      subheader.querySelectorAll('.hud-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          filterMode = btn.getAttribute('data-filter');
          render();
        });
      });

      container.appendChild(drawer);
    }
  }

  // Public API to ingest events from content.js
  window.__OPENAI_PIXEL_HUD_API__ = {
    addEvent: function (eventData) {
      if (!eventData) return;
      capturedEvents.unshift(eventData);
      if (capturedEvents.length > 200) capturedEvents.pop();
      render();
    },
    addNetworkRequest: function (reqData) {
      if (!reqData) return;
      capturedRequests.unshift(reqData);
      if (capturedRequests.length > 100) capturedRequests.pop();
      render();
    },
    setPixels: function (pixels) {
      if (Array.isArray(pixels)) detectedPixels = pixels;
      render();
    },
    toggleVisibility: function (forceState) {
      isVisible = typeof forceState === 'boolean' ? forceState : !isVisible;
      host.style.display = isVisible ? 'block' : 'none';
    },
    clear: function () {
      capturedEvents = [];
      capturedRequests = [];
      render();
    }
  };

  // Initial render
  render();
})();
