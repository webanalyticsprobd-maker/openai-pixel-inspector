/**
 * OpenAI Ads Pixel Inspector - Popup Controller
 * 
 * Features:
 * - Generic Schema-Driven Parameter Validation Engine
 * - 4-Level Parameter Severity: ✅ Valid, ⚠️ Warning, ❌ Error, ℹ️ Info
 * - Network Monitor: Inspects observable HTTP POST requests & safe headers to bzr.openai.com
 * - 5-Stage Lifecycle Separation (Pixel Fired, Network Sent, Server Status, Parameters, Validation)
 * - Session Journey Timeline & Deduplication Audit
 * - CSV, JSON, and Markdown Report Export
 * - Chrome Side Panel & Theme Persistence
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport } from '../core/scanner.js';
import { computeEventLifecycle } from '../core/normalizer.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const targetHostEl = document.getElementById('target-host');
  const badgeTabIdEl = document.getElementById('badge-tab-id');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');
  const btnTheme = document.getElementById('btn-theme');
  const themeIcon = document.getElementById('theme-icon');
  const btnSidepanel = document.getElementById('btn-sidepanel');

  // Overview Tab elements
  const nodeBridge = document.getElementById('node-bridge');
  const nodeContent = document.getElementById('node-content');
  const nodeWorker = document.getElementById('node-worker');
  const bridgeStatusText = document.getElementById('bridge-status-text');
  const contentStatusText = document.getElementById('content-status-text');
  const workerStatusText = document.getElementById('worker-status-text');
  const pipelineStatusBadge = document.getElementById('pipeline-status-badge');

  const pixelStatusBadge = document.getElementById('pixel-status-badge');
  const valPixelDetected = document.getElementById('val-pixel-detected');
  const valPixelId = document.getElementById('val-pixel-id');
  const valSessionId = document.getElementById('val-session-id');
  const valOppref = document.getElementById('val-oppref');

  const metricTotalEvents = document.getElementById('metric-total-events');
  const metricStandardEvents = document.getElementById('metric-standard-events');
  const metricCustomEvents = document.getElementById('metric-custom-events');
  const metricIssuesEvents = document.getElementById('metric-issues-events');
  const latestEventContent = document.getElementById('latest-event-content');
  const latestEventTime = document.getElementById('latest-event-time');

  const tabCountEvents = document.getElementById('tab-count-events');
  const tabCountNetwork = document.getElementById('tab-count-network');
  const tabCountIssues = document.getElementById('tab-count-issues');

  // Events Tab elements
  const eventSearchInput = document.getElementById('event-search-input');
  const filterChips = document.querySelectorAll('.filter-chip');
  const eventsListContainer = document.getElementById('events-list-container');

  // Network Tab elements
  const networkListContainer = document.getElementById('network-list-container');
  const networkCountBadge = document.getElementById('network-count-badge');

  // Attribution Tab elements
  const opprefStatusBadge = document.getElementById('oppref-status-badge');
  const attrUrlVal = document.getElementById('attr-url-val');
  const attrCookieVal = document.getElementById('attr-cookie-val');
  const attrStorageVal = document.getElementById('attr-storage-val');
  const attrActiveKey = document.getElementById('attr-active-key');

  // Issues Tab elements
  const issuesListContainer = document.getElementById('issues-list-container');

  // Audit Tab elements
  const auditScoreBadge = document.getElementById('audit-score-badge');
  const auditSummaryBox = document.getElementById('audit-summary-box');
  const journeyTableContainer = document.getElementById('journey-table-container');
  const eventSummaryTableContainer = document.getElementById('event-summary-table-container');
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // Modal elements
  const rawModal = document.getElementById('raw-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalJsonContent = document.getElementById('modal-json-content');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalEventTitle = document.getElementById('modal-event-title');

  let activeTab = null;
  let currentTabState = null;
  let currentFilter = 'all';
  let searchQuery = '';
  let activeModalJson = '';
  const expandedEventIds = new Set();

  // ==========================================
  // 1. Theme Management (Dark / Light)
  // ==========================================
  let currentTheme = localStorage.getItem('openai_pixel_inspector_theme') || 'dark';

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    localStorage.setItem('openai_pixel_inspector_theme', theme);
  }

  applyTheme(currentTheme);

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // ==========================================
  // 2. Side Panel Opener (Wide View Mode)
  // ==========================================
  if (btnSidepanel) {
    btnSidepanel.addEventListener('click', async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (chrome.sidePanel && chrome.sidePanel.open) {
          await chrome.sidePanel.open({ windowId: currentWindow.id });
          window.close();
        } else {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
        }
      } catch (err) {
        console.warn('[OpenAI Pixel Inspector] SidePanel open error:', err);
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
      }
    });
  }

  // ==========================================
  // 3. Navigation Tabs
  // ==========================================
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      navTabs.forEach((t) => t.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(`pane-${tab.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // ==========================================
  // 4. Filter Chips & Search
  // ==========================================
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderEvents();
    });
  });

  eventSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderEvents();
  });

  // ==========================================
  // 5. Modal Handling
  // ==========================================
  modalCloseBtn.addEventListener('click', () => {
    rawModal.classList.add('hidden');
  });

  modalCopyBtn.addEventListener('click', () => {
    if (activeModalJson) {
      navigator.clipboard.writeText(activeModalJson);
      modalCopyBtn.textContent = 'Copied!';
      setTimeout(() => { modalCopyBtn.textContent = 'Copy JSON'; }, 1500);
    }
  });

  function openRawModal(title, dataObj) {
    activeModalJson = JSON.stringify(dataObj, null, 2);
    modalEventTitle.textContent = title;
    modalJsonContent.textContent = activeModalJson;
    rawModal.classList.remove('hidden');
  }

  // ==========================================
  // 6. Diagnostics Helper
  // ==========================================
  function setNodeStatus(nodeEl, textEl, isConnected, text) {
    if (!nodeEl || !textEl) return;
    nodeEl.classList.remove('node-connected', 'node-disconnected');
    nodeEl.classList.add(isConnected ? 'node-connected' : 'node-disconnected');
    textEl.textContent = text;
  }

  async function getActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs && tabs.length > 0 ? tabs[0] : null;
    } catch {
      return null;
    }
  }

  async function updateState() {
    activeTab = await getActiveTab();
    if (!activeTab) return;

    try {
      const urlObj = new URL(activeTab.url);
      targetHostEl.textContent = urlObj.hostname || activeTab.url;
    } catch {
      targetHostEl.textContent = activeTab.url || 'Internal page';
    }
    badgeTabIdEl.textContent = `Tab #${activeTab.id}`;

    // Background Service Worker Health
    try {
      const bgResp = await chrome.runtime.sendMessage({ action: 'PING_BACKGROUND' });
      if (bgResp && bgResp.status === 'ok') {
        setNodeStatus(nodeWorker, workerStatusText, true, 'Active');
      }
    } catch {
      setNodeStatus(nodeWorker, workerStatusText, false, 'Offline');
    }

    // Content Script & Bridge Health
    try {
      const csResp = await chrome.tabs.sendMessage(activeTab.id, { action: 'PING_CONTENT_SCRIPT' });
      if (csResp && csResp.status === 'ok') {
        setNodeStatus(nodeContent, contentStatusText, true, 'Attached');
        setNodeStatus(nodeBridge, bridgeStatusText, csResp.isBridgeConnected, csResp.isBridgeConnected ? 'Bridged' : 'Pending');
      } else {
        setNodeStatus(nodeContent, contentStatusText, false, 'Not injected');
        setNodeStatus(nodeBridge, bridgeStatusText, false, 'Disconnected');
      }
    } catch {
      setNodeStatus(nodeContent, contentStatusText, false, 'Reload needed');
      setNodeStatus(nodeBridge, bridgeStatusText, false, 'Disconnected');
    }

    // Get Tab State
    try {
      const stateResp = await chrome.runtime.sendMessage({
        action: 'GET_ACTIVE_TAB_STATE',
        tabId: activeTab.id
      });

      if (stateResp && stateResp.state) {
        currentTabState = stateResp.state;
        renderAll();
      }
    } catch (err) {
      console.warn('[OpenAI Pixel Inspector] Tab state query error:', err);
    }
  }

  // ==========================================
  // 7. Rendering Engine
  // ==========================================
  function renderAll() {
    if (!currentTabState) return;
    renderOverview();
    renderEvents();
    renderNetwork();
    renderAttribution();
    renderIssues();
    renderAudit();
  }

  function renderOverview() {
    const pixel = currentTabState.pixel || {};
    const attribution = currentTabState.attribution || {};
    const stats = currentTabState.stats || {};
    const events = currentTabState.events || [];
    const network = currentTabState.network || [];

    if (pixel.detected) {
      valPixelDetected.textContent = `✅ Detected (${pixel.confidence || 'high'})`;
      pixelStatusBadge.textContent = 'Active';
      pixelStatusBadge.className = 'badge badge-success';
    } else {
      valPixelDetected.textContent = '❌ Not Detected';
      pixelStatusBadge.textContent = 'Missing';
      pixelStatusBadge.className = 'badge badge-error';
    }

    valPixelId.textContent = (pixel.pixelIds && pixel.pixelIds.length > 0) ? pixel.pixelIds.join(', ') : 'None';
    valSessionId.textContent = currentTabState.sessionId || 'SESSION_' + activeTab?.id;
    valOppref.textContent = attribution.oppref ? `✅ ${truncateString(attribution.oppref, 18)}` : '⚠️ Not detected';

    metricTotalEvents.textContent = stats.totalEvents || 0;
    metricStandardEvents.textContent = stats.standardEvents || 0;
    metricCustomEvents.textContent = stats.customEvents || 0;
    metricIssuesEvents.textContent = (stats.errorEvents || 0) + (stats.duplicateEvents || 0);

    tabCountEvents.textContent = stats.totalEvents || 0;
    tabCountNetwork.textContent = network.length || 0;
    tabCountIssues.textContent = (stats.errorEvents || 0) + (stats.duplicateEvents || 0);

    if (events.length > 0) {
      const latest = events[events.length - 1];
      latestEventTime.textContent = formatTimestamp(latest.timestamp);
      latestEventContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="event-badge-type ${latest.validation.isCustom ? 'event-badge-custom' : 'event-badge-std'}">
              ${latest.validation.isCustom ? 'Custom' : 'Standard'}
            </span>
            <strong>${escapeHtml(latest.displayName || latest.name)}</strong>
          </div>
          <span class="badge ${latest.isDuplicate ? 'badge-error' : (latest.validation.status === 'valid' ? 'badge-success' : 'badge-warning')}">
            ${latest.isDuplicate ? 'DOUBLE FIRED' : latest.validation.status.toUpperCase()}
          </span>
        </div>
        <div style="font-size: 11px; font-family: monospace; color: var(--text-secondary); margin-top: 6px;">
          ${Object.keys(latest.parameters).length} parameter(s) • Page: ${escapeHtml(latest.pathname || '/')} • ID: ${latest.eventId ? escapeHtml(latest.eventId) : '<span style="color:var(--text-muted)">Not Sent</span>'}
        </div>
      `;
    } else {
      latestEventContent.innerHTML = '<div class="empty-state-sm">No events detected yet.</div>';
      latestEventTime.textContent = '--:--:--';
    }
  }

  function renderEvents() {
    if (!currentTabState) return;
    const events = currentTabState.events || [];

    const filtered = events.filter((evt) => {
      if (currentFilter === 'standard' && evt.validation.isCustom) return false;
      if (currentFilter === 'custom' && !evt.validation.isCustom) return false;
      if (currentFilter === 'duplicates' && !evt.isDuplicate) return false;
      if (currentFilter === 'errors' && evt.validation.status !== 'error') return false;
      if (currentFilter === 'warnings' && evt.validation.status !== 'warning') return false;
      if (currentFilter === 'network' && !evt.network.detected) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (evt.displayName || evt.name).toLowerCase().includes(q);
        const urlMatch = (evt.url || evt.pathname || '').toLowerCase().includes(q);
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters).toLowerCase().includes(q);
        return nameMatch || urlMatch || idMatch || paramsMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      eventsListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📡</span>
          <p class="empty-text">No matching OpenAI Pixel events observed.</p>
          <span class="empty-subtext">Trigger tracking actions on the page or across the user journey.</span>
        </div>
      `;
      return;
    }

    eventsListContainer.innerHTML = '';
    filtered.slice().reverse().forEach((evt, idx) => {
      const item = document.createElement('div');
      const itemKey = evt._id || `evt_${idx}`;
      const isExpanded = expandedEventIds.has(itemKey);
      item.className = `event-item ${isExpanded ? 'open' : ''}`;

      const isCustom = evt.validation.isCustom;
      let statusBadgeHtml = '';

      if (evt.isDuplicate) {
        statusBadgeHtml = `<span class="badge badge-error">❌ Double Fired</span>`;
      } else if (evt.requestCount > 1) {
        statusBadgeHtml = `<span class="badge badge-error">❌ Fired ${evt.requestCount}x</span>`;
      } else {
        const statusClass = evt.validation.status === 'valid' ? 'badge-success' : (evt.validation.status === 'warning' ? 'badge-warning' : 'badge-error');
        statusBadgeHtml = `<span class="badge ${statusClass}">${evt.validation.status}</span>`;
      }

      // Compute Separate 5-Stage Lifecycle
      const lifecycle = computeEventLifecycle(evt);

      // Build Parameter Table Rows with 4-Level Severity Badges
      let paramRows = '';
      const params = evt.parameters || {};
      for (const [key, val] of Object.entries(params)) {
        const valRes = (evt.validation.parameterResults && evt.validation.parameterResults[key]) || {};
        
        let paramStatusBadge = '';
        if (valRes.severity === 'valid' || valRes.valid) {
          paramStatusBadge = '<span class="badge badge-success">✅ Valid</span>';
        } else if (valRes.severity === 'warning') {
          paramStatusBadge = `<span class="badge badge-warning" title="${escapeHtml(valRes.message || 'Warning')}">⚠️ Warning</span>`;
        } else if (valRes.severity === 'error') {
          paramStatusBadge = `<span class="badge badge-error" title="${escapeHtml(valRes.message || 'Error')}">❌ Error</span>`;
        } else if (valRes.severity === 'info') {
          paramStatusBadge = `<span class="badge badge-neutral" title="${escapeHtml(valRes.message || 'Info')}">ℹ️ Info</span>`;
        } else {
          paramStatusBadge = '<span class="badge badge-success">✅ Valid</span>';
        }

        let displayVal = '';
        if (typeof val === 'object' && val !== null) {
          displayVal = `<div class="param-json-block">${escapeHtml(JSON.stringify(val, null, 2))}</div>`;
        } else if (key === 'amount' && typeof val === 'number') {
          const curr = (params.currency || 'USD').toString().toUpperCase();
          const decimals = (curr === 'JPY' || curr === 'KRW' || curr === 'VND') ? 0 : ((curr === 'KWD' || curr === 'BHD' || curr === 'OMR') ? 3 : 2);
          const majorEquiv = (val / Math.pow(10, decimals)).toFixed(decimals);
          displayVal = `<code>${val}</code> <span style="font-size:10px; color:var(--text-muted); margin-left:4px;">(≡ ${majorEquiv} ${curr})</span>`;
        } else {
          displayVal = escapeHtml(String(val));
        }

        paramRows += `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${displayVal}</td>
            <td style="text-align:center;">${paramStatusBadge}</td>
          </tr>
        `;
      }

      if (Object.keys(params).length === 0) {
        paramRows = '<tr><td colspan="3" style="color:var(--text-muted); text-align:center;">No parameters passed</td></tr>';
      }

      // Strictly real Event ID rendering (no fake IDs)
      const eventIdDisplay = evt.eventId ? `<code>${escapeHtml(evt.eventId)}</code>` : '<span style="color:var(--text-muted); font-style: italic;">Not Sent</span>';

      item.innerHTML = `
        <div class="event-header">
          <div class="event-name-group">
            <span class="event-badge-type ${isCustom ? 'event-badge-custom' : 'event-badge-std'}">
              ${isCustom ? 'Custom' : 'Standard'}
            </span>
            <span class="event-name">${escapeHtml(evt.displayName || evt.name)}</span>
          </div>
          <div class="event-meta-group">
            ${statusBadgeHtml}
            <span class="event-time">${formatTimestamp(evt.timestamp)}</span>
          </div>
        </div>
        <div class="event-details-drawer">
          <!-- Lifecycle Verification Box -->
          <div class="lifecycle-box">
            <div class="lifecycle-row">
              <span class="lifecycle-label">Pixel Call:</span>
              <span class="lifecycle-val" style="color:var(--color-emerald);">${lifecycle.pixelCall.label}</span>
            </div>
            <div class="lifecycle-row">
              <span class="lifecycle-label">Parameters:</span>
              <span class="lifecycle-val" style="color:${lifecycle.parametersStatus.status === 'valid' ? 'var(--color-emerald)' : (lifecycle.parametersStatus.status === 'warning' ? 'var(--color-amber)' : 'var(--color-rose)')};">
                ${lifecycle.parametersStatus.label}
              </span>
            </div>
            <div class="lifecycle-row">
              <span class="lifecycle-label">Validation:</span>
              <span class="lifecycle-val" style="color:${lifecycle.validationStatus.status === 'passed' ? 'var(--color-emerald)' : (lifecycle.validationStatus.status === 'warning' ? 'var(--color-amber)' : 'var(--color-rose)')};">
                ${lifecycle.validationStatus.label}
              </span>
            </div>
          </div>

          <div style="margin-bottom:6px; color:var(--text-secondary); font-size:10px; line-height: 1.6;">
            <div><strong>Page Path:</strong> <code>${escapeHtml(evt.pathname || evt.url || '/')}</code></div>
            <div><strong>Event ID:</strong> ${eventIdDisplay} ${evt.pixelId ? ` | <strong>Pixel:</strong> <code>${escapeHtml(evt.pixelId)}</code>` : ''}</div>
            ${evt.duplicateReason ? `<div style="color:var(--color-rose); margin-top:2px;">⚠️ <strong>Duplicate Reason:</strong> ${escapeHtml(evt.duplicateReason)}</div>` : ''}
          </div>

          <table class="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th style="text-align:center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${paramRows}
            </tbody>
          </table>

          <div class="drawer-actions">
            <button class="btn btn-secondary btn-xs btn-inspect-raw">Inspect Raw JSON</button>
          </div>
        </div>
      `;

      // Toggle drawer accordion & preserve open state
      const header = item.querySelector('.event-header');
      header.addEventListener('click', () => {
        if (expandedEventIds.has(itemKey)) {
          expandedEventIds.delete(itemKey);
          item.classList.remove('open');
        } else {
          expandedEventIds.add(itemKey);
          item.classList.add('open');
        }
      });

      // Raw button
      const rawBtn = item.querySelector('.btn-inspect-raw');
      rawBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRawModal(`Event: ${evt.displayName || evt.name}`, evt);
      });

      eventsListContainer.appendChild(item);
    });
  }

  // ==========================================
  // 8. Network Monitor Renderer
  // ==========================================
  function renderNetwork() {
    if (!currentTabState) return;
    const networkRequests = currentTabState.network || [];
    networkCountBadge.textContent = `${networkRequests.length} request(s)`;

    if (networkRequests.length === 0) {
      networkListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🌐</span>
          <p class="empty-text">No OpenAI Pixel network transmissions captured.</p>
          <span class="empty-subtext">Requests to bzr.openai.com or bzrcdn.openai.com will appear here in real time.</span>
        </div>
      `;
      return;
    }

    networkListContainer.innerHTML = '';
    networkRequests.slice().reverse().forEach((req, idx) => {
      const card = document.createElement('div');
      card.className = 'network-card';

      const method = req.method || 'POST';
      let statusBadge = '<span class="badge badge-warning">⏳ Pending</span>';
      if (req.status === 200) {
        statusBadge = '<span class="badge badge-success">HTTP 200</span>';
      } else if (req.status && req.status > 0) {
        statusBadge = `<span class="badge badge-error">HTTP ${req.status}</span>`;
      } else if (req.status === 0 || req.error) {
        statusBadge = `<span class="badge badge-error">Blocked / Net Err</span>`;
      }

      // Extract Event Name if present in payload
      const evtName = req.payload?.name || req.payload?.event_name || req.payload?.event || 'Measurement Signal';
      const cleanUrl = req.url ? truncateString(req.url.replace(/^https?:\/\//, ''), 45) : 'bzr.openai.com/v1/sdk/events';

      card.innerHTML = `
        <div class="network-header">
          <div class="network-method-group">
            <span class="badge-post">${escapeHtml(method)}</span>
            <span style="font-weight: 600; font-size: 11px;">${escapeHtml(evtName)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${statusBadge}
            <span class="text-muted font-mono" style="font-size: 10px;">${formatTimestamp(req.timestamp)}</span>
          </div>
        </div>
        <div class="network-url">${escapeHtml(cleanUrl)}</div>
        <div class="network-meta">
          <span>Source: <code>${escapeHtml(req.source || 'webRequest')}</code></span>
          <span>Payload: ${req.payload ? Object.keys(req.payload).length + ' fields' : 'None'}</span>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
          <button class="btn btn-secondary btn-xs btn-inspect-net-raw">Inspect Payload</button>
        </div>
      `;

      const netRawBtn = card.querySelector('.btn-inspect-net-raw');
      netRawBtn.addEventListener('click', () => {
        openRawModal(`Network Request: ${evtName}`, {
          method: method,
          url: req.url,
          status: req.status,
          timestamp: new Date(req.timestamp).toISOString(),
          headers: {
            'Content-Type': 'application/json',
            'Safe-Origin': targetHostEl.textContent
          },
          payload: req.payload || 'No payload body'
        });
      });

      networkListContainer.appendChild(card);
    });
  }

  function renderAttribution() {
    if (!currentTabState) return;
    const attribution = currentTabState.attribution || {};

    if (attribution.oppref) {
      opprefStatusBadge.textContent = 'Active';
      opprefStatusBadge.className = 'badge badge-success';
    } else {
      opprefStatusBadge.textContent = 'Not detected';
      opprefStatusBadge.className = 'badge badge-neutral';
    }

    attrUrlVal.textContent = attribution.urlDetected ? attribution.details.urlParam : 'Not present in URL';
    attrCookieVal.textContent = attribution.cookieDetected ? attribution.details.cookieValue : 'Not found in cookies';
    attrStorageVal.textContent = attribution.storageDetected ? attribution.details.localStorage : 'Not found in storage';
    attrActiveKey.textContent = attribution.oppref || 'None';
  }

  function renderIssues() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const issues = report.issues || [];

    if (issues.length === 0) {
      issuesListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✅</span>
          <p class="empty-text">No implementation issues, double fires, or warnings found!</p>
          <span class="empty-subtext">All parameters, journey actions, and tracking calls match OpenAI specifications.</span>
        </div>
      `;
      return;
    }

    issuesListContainer.innerHTML = '';
    issues.forEach((iss) => {
      const card = document.createElement('div');
      card.className = `issue-card issue-card-${iss.severity || 'warning'}`;
      card.innerHTML = `
        <div class="issue-header">
          <span class="issue-code">${escapeHtml(iss.code)}</span>
          <span class="badge ${iss.severity === 'critical' || iss.severity === 'error' ? 'badge-error' : (iss.severity === 'warning' ? 'badge-warning' : 'badge-neutral')}">
            ${(iss.severity || 'warning').toUpperCase()}
          </span>
        </div>
        <p class="issue-msg">${escapeHtml(iss.message)}</p>
        ${iss.recommendation ? `<div class="issue-rec">💡 <strong>Recommendation:</strong> ${escapeHtml(iss.recommendation)}</div>` : ''}
      `;
      issuesListContainer.appendChild(card);
    });
  }

  function renderAudit() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);

    if (report.overallStatus === 'pass') {
      auditScoreBadge.textContent = 'Healthy (Pass)';
      auditScoreBadge.className = 'badge badge-success';
    } else if (report.overallStatus === 'warning') {
      auditScoreBadge.textContent = 'Warnings / Duplicates';
      auditScoreBadge.className = 'badge badge-warning';
    } else {
      auditScoreBadge.textContent = 'Errors Detected';
      auditScoreBadge.className = 'badge badge-error';
    }

    // Top Summary Box
    auditSummaryBox.innerHTML = `
      <div><strong>Session ID:</strong> <code>${escapeHtml(report.sessionId || 'SESSION')}</code></div>
      <div><strong>Target Host:</strong> ${escapeHtml(report.hostname || 'Unknown')}</div>
      <div><strong>Visited Pages:</strong> ${report.scores.pagesVisitedCount} page(s) in session</div>
      <div><strong>Total Events Recorded:</strong> ${report.scores.totalEvents} (${report.scores.standardEvents} Standard, ${report.scores.customEvents} Custom)</div>
      <div><strong>Duplicate / Double Fires:</strong> ${report.scores.duplicateEvents > 0 ? `<span style="color:var(--color-rose); font-weight:bold;">${report.scores.duplicateEvents} detected</span>` : '<span style="color:var(--color-emerald)">0 (Clean)</span>'}</div>
      <div><strong>Issues Count:</strong> ${report.issues.length} (${report.scores.errorEvents} errors, ${report.scores.warningEvents} warnings)</div>
    `;

    // 1. Render Journey Timeline Table
    if (report.journeyTable && report.journeyTable.length > 0) {
      let journeyRows = '';
      report.journeyTable.forEach((row) => {
        const isDup = row.duplicateStatus.includes('Double Fired') || row.duplicateStatus.includes('Duplicate');
        const statusColor = isDup ? 'var(--color-rose)' : 'var(--color-emerald)';
        const pathDisplay = row.pathname || row.url || '/';

        journeyRows += `
          <tr>
            <td>${row.step}</td>
            <td><strong>${escapeHtml(row.name)}</strong></td>
            <td title="${escapeHtml(row.url || pathDisplay)}"><code>${escapeHtml(pathDisplay)}</code></td>
            <td>${row.count}</td>
            <td style="color: ${statusColor}; font-weight: 600;">${escapeHtml(row.duplicateStatus)}</td>
          </tr>
        `;
      });

      journeyTableContainer.innerHTML = `
        <table class="journey-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Event</th>
              <th>Page URL</th>
              <th style="text-align: center;">Count</th>
              <th>Duplicate Status</th>
            </tr>
          </thead>
          <tbody>
            ${journeyRows}
          </tbody>
        </table>
      `;
    } else {
      journeyTableContainer.innerHTML = '<div class="empty-state-sm">No journey steps recorded yet.</div>';
    }

    // 2. Render Event Health Summary Table
    if (report.eventSummaries && report.eventSummaries.length > 0) {
      let summaryRows = '';
      report.eventSummaries.forEach((sum) => {
        const isDup = sum.duplicates > 0;
        summaryRows += `
          <tr>
            <td><strong>${escapeHtml(sum.displayName || sum.name)}</strong></td>
            <td>${sum.detected}</td>
            <td style="color: ${isDup ? 'var(--color-rose)' : 'var(--color-emerald)'}; font-weight: 600;">
              ${escapeHtml(sum.audit)}
            </td>
          </tr>
        `;
      });

      eventSummaryTableContainer.innerHTML = `
        <table class="summary-table">
          <thead>
            <tr>
              <th>Event</th>
              <th style="text-align: center;">Detected</th>
              <th>Audit Assessment</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows}
          </tbody>
        </table>
      `;
    } else {
      eventSummaryTableContainer.innerHTML = '<div class="empty-state-sm">No events to summarize.</div>';
    }
  }

  // ==========================================
  // 9. Action Handlers
  // ==========================================
  btnRefresh.addEventListener('click', async () => {
    btnRefresh.style.transform = 'rotate(180deg)';
    setTimeout(() => { btnRefresh.style.transform = 'none'; }, 300);
    if (activeTab) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'REQUEST_SCAN' }).catch(() => {});
    }
    await updateState();
  });

  btnClear.addEventListener('click', async () => {
    if (activeTab) {
      expandedEventIds.clear();
      await chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id });
      await updateState();
    }
  });

  btnCopyMarkdown.addEventListener('click', () => {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const md = [
      `# OpenAI Ads Pixel Tracking & Journey Audit Report`,
      `**Session ID:** ${report.sessionId || 'SESSION'}`,
      `**Website:** ${report.hostname || report.website}`,
      `**Generated:** ${report.generatedAt}`,
      `**Status:** ${report.overallStatus.toUpperCase()}`,
      ``,
      `## 1. Pixel & Attribution Health`,
      `- **Pixel Installed:** ${report.scores.pixelInstalled ? 'Yes' : 'No'}`,
      `- **Pixel ID(s):** ${(report.scores.pixelIds || []).join(', ') || 'None'}`,
      `- **Initialized:** ${report.scores.initialized ? 'Yes' : 'No'}`,
      `- **oppref Detected:** ${report.scores.opprefPresent ? 'Yes' : 'No'}`,
      ``,
      `## 2. Event Journey Summary`,
      `- **Total Events:** ${report.scores.totalEvents}`,
      `- **Standard Events:** ${report.scores.standardEvents}`,
      `- **Custom Events:** ${report.scores.customEvents}`,
      `- **Duplicate / Double Fires:** ${report.scores.duplicateEvents}`,
      `- **Pages Visited:** ${report.scores.pagesVisitedCount}`,
      ``,
      `## 3. Journey Steps Audit Table`,
      `| Step | Event Name | Page Path | Request Count | Duplicate Status |`,
      `|---|---|---|---|---|`,
      ...(report.journeyTable || []).map((j) => `| ${j.step} | ${j.name} | ${j.pathname} | ${j.count} | ${j.duplicateStatus} |`),
      ``,
      `## 4. Event Health Breakdown`,
      `| Event Name | Detected | Audit Assessment |`,
      `|---|---|---|`,
      ...(report.eventSummaries || []).map((s) => `| ${s.displayName || s.name} | ${s.detected} | ${s.audit} |`),
      ``,
      `## 5. Issues & Recommendations`,
      report.issues.length === 0 ? `*No issues found. Tracking implementation is clean!*` : report.issues.map((i) => `- **[${i.severity.toUpperCase()}] ${i.code}**: ${i.message}\n  *Recommendation:* ${i.recommendation || 'N/A'}`).join('\n')
    ].join('\n');

    navigator.clipboard.writeText(md);
    btnCopyMarkdown.textContent = '✅ Copied!';
    setTimeout(() => { btnCopyMarkdown.innerHTML = '<span>📋 Copy Markdown</span>'; }, 2000);
  });

  btnExportCsv.addEventListener('click', () => {
    if (!currentTabState || !currentTabState.events) return;
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
    currentTabState.events.forEach((evt, idx) => {
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

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((e) => e.join(',')).join('\n'));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', csvContent);
    dlAnchor.setAttribute('download', `openai_pixel_journey_audit_${Date.now()}.csv`);
    dlAnchor.click();
  });

  btnExportJson.addEventListener('click', () => {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({
      report: report,
      sessionState: currentTabState
    }, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `openai_pixel_session_audit_${Date.now()}.json`);
    dlAnchor.click();
  });

  // Initial Load and Polling interval
  await updateState();
  setInterval(updateState, 1500);
});
