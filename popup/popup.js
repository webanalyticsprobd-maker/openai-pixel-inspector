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
  // SVG Icon System (Professional & Zero Emojis)
  // ==========================================
  const ICONS = {
    check: '<svg class="badge-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>',
    cross: '<svg class="badge-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>',
    warn: '<svg class="badge-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"/></svg>',
    info: '<svg class="badge-icon" viewBox="0 0 16 16" fill="currentColor"><path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/></svg>',
    sun: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    moon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    emptyEvents: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
    emptyNet: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    emptyCheck: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
  };

  function renderStatusBadge(severity, label, titleText) {
    const safeTitle = titleText ? ` title="${escapeHtml(titleText)}"` : '';
    if (severity === 'valid' || severity === 'pass' || severity === 'success') {
      return `<span class="badge badge-success"${safeTitle}>${ICONS.check} ${label || 'Valid'}</span>`;
    } else if (severity === 'error' || severity === 'critical' || severity === 'fail') {
      return `<span class="badge badge-error"${safeTitle}>${ICONS.cross} ${label || 'Error'}</span>`;
    } else if (severity === 'warning') {
      return `<span class="badge badge-warning"${safeTitle}>${ICONS.warn} ${label || 'Warning'}</span>`;
    } else {
      return `<span class="badge badge-neutral"${safeTitle}>${ICONS.info} ${label || 'Info'}</span>`;
    }
  }

  // ==========================================
  // 1. Theme Management (Dark / Light)
  // ==========================================
  let currentTheme = localStorage.getItem('openai_pixel_inspector_theme') || 'dark';

  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    if (themeIcon) {
      themeIcon.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
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
      valPixelDetected.innerHTML = `<span style="color:var(--color-emerald); font-weight:600;">Detected (${escapeHtml(pixel.confidence || 'high')})</span>`;
      pixelStatusBadge.textContent = 'Active';
      pixelStatusBadge.className = 'badge badge-success';
    } else {
      valPixelDetected.innerHTML = '<span style="color:var(--color-rose); font-weight:600;">Not Detected</span>';
      pixelStatusBadge.textContent = 'Missing';
      pixelStatusBadge.className = 'badge badge-error';
    }

    valPixelId.textContent = (pixel.pixelIds && pixel.pixelIds.length > 0) ? pixel.pixelIds.join(', ') : 'None';
    valSessionId.textContent = currentTabState.sessionId || 'SESSION_' + activeTab?.id;
    valOppref.innerHTML = attribution.oppref ? `<span style="color:var(--color-emerald); font-weight:600;">${truncateString(attribution.oppref, 18)}</span>` : '<span style="color:var(--text-muted);">Not detected</span>';

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
        <div style="font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); margin-top: 6px;">
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
          <span class="empty-icon">${ICONS.emptyEvents}</span>
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
        statusBadgeHtml = renderStatusBadge('error', 'Double Fired');
      } else if (evt.requestCount > 1) {
        statusBadgeHtml = renderStatusBadge('error', `Fired ${evt.requestCount}x`);
      } else {
        const statusLabel = evt.validation.status === 'valid' ? 'Valid' : (evt.validation.status === 'warning' ? 'Warning' : 'Error');
        statusBadgeHtml = renderStatusBadge(evt.validation.status, statusLabel);
      }

      // Compute Separate 5-Stage Lifecycle
      const lifecycle = computeEventLifecycle(evt);

      // Build Parameter Table Rows with Clean Severity Badges
      let paramRows = '';
      const params = evt.parameters || {};
      for (const [key, val] of Object.entries(params)) {
        const valRes = (evt.validation.parameterResults && evt.validation.parameterResults[key]) || {};
        
        let paramSeverity = 'valid';
        let paramLabel = 'Valid';
        if (valRes.severity === 'error' || valRes.valid === false) {
          paramSeverity = 'error';
          paramLabel = 'Error';
        } else if (valRes.severity === 'warning') {
          paramSeverity = 'warning';
          paramLabel = 'Warning';
        } else if (valRes.severity === 'info') {
          paramSeverity = 'info';
          paramLabel = 'Info';
        }

        const paramStatusBadge = renderStatusBadge(paramSeverity, paramLabel, valRes.message);

        let displayVal = '';
        if (typeof val === 'object' && val !== null) {
          displayVal = `<div class="param-json-block">${escapeHtml(JSON.stringify(val, null, 2))}</div>`;
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

          <div style="margin-bottom:8px; color:var(--text-secondary); font-size:12px; line-height: 1.6;">
            <div><strong>Page Path:</strong> <code>${escapeHtml(evt.pathname || evt.url || '/')}</code></div>
            <div><strong>Event ID:</strong> ${eventIdDisplay} ${evt.pixelId ? ` | <strong>Pixel:</strong> <code>${escapeHtml(evt.pixelId)}</code>` : ''}</div>
            ${evt.duplicateReason ? `<div style="color:var(--color-rose); margin-top:3px;"><strong>Duplicate:</strong> ${escapeHtml(evt.duplicateReason)}</div>` : ''}
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
          <span class="empty-icon">${ICONS.emptyNet}</span>
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
      let statusBadge = '<span class="badge badge-warning">Pending</span>';
      if (req.status === 200) {
        statusBadge = '<span class="badge badge-success">HTTP 200</span>';
      } else if (req.status && req.status > 0) {
        statusBadge = `<span class="badge badge-error">HTTP ${req.status}</span>`;
      } else if (req.status === 0 || req.error) {
        statusBadge = `<span class="badge badge-error">Blocked</span>`;
      }

      // Extract Event Name if present in payload
      const evtName = req.payload?.name || req.payload?.event_name || req.payload?.event || 'Measurement Signal';
      const cleanUrl = req.url ? truncateString(req.url.replace(/^https?:\/\//, ''), 45) : 'bzr.openai.com/v1/sdk/events';

      card.innerHTML = `
        <div class="network-header">
          <div class="network-method-group">
            <span class="badge-post">${escapeHtml(method)}</span>
            <span style="font-weight: 600; font-size: 13px;">${escapeHtml(evtName)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${statusBadge}
            <span class="text-muted font-mono" style="font-size: 11.5px;">${formatTimestamp(req.timestamp)}</span>
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
          <span class="empty-icon">${ICONS.emptyCheck}</span>
          <p class="empty-text">No implementation issues, double fires, or warnings found.</p>
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
        ${iss.recommendation ? `<div class="issue-rec"><strong>Recommendation:</strong> ${escapeHtml(iss.recommendation)}</div>` : ''}
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
      <div><strong>Duplicate / Double Fires:</strong> ${report.scores.duplicateEvents > 0 ? `<span style="color:var(--color-rose); font-weight:600;">${report.scores.duplicateEvents} detected</span>` : '<span style="color:var(--color-emerald); font-weight:600;">0 (Clean)</span>'}</div>
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
    btnCopyMarkdown.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> <span>Copied!</span>`;
    setTimeout(() => {
      btnCopyMarkdown.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> <span>Copy Markdown</span>`;
    }, 2000);
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
        `"${evt.duplicateStatus || 'Correct'}"`,
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
