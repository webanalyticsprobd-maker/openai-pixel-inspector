/**
 * OpenAI Ads Pixel Inspector - Professional Developer & Analytics Debugger
 * Reference Style: Stripe Dashboard + Linear + Chrome DevTools + OpenAI Branding
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport } from '../core/scanner.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation elements
  const allNavTabs = document.querySelectorAll('.nav-tab, .nav-tab-secondary');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const targetHostEl = document.getElementById('target-host');
  const btnCopyHost = document.getElementById('btn-copy-host');
  const badgeTabIdEl = document.getElementById('badge-tab-id');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');
  const btnTheme = document.getElementById('btn-theme');
  const themeIcon = document.getElementById('theme-icon');
  const btnSidepanel = document.getElementById('btn-sidepanel');

  // Overview Tab elements
  const pixelStatusBadge = document.getElementById('pixel-status-badge');
  const healthStatusBadge = document.getElementById('health-status-badge');
  const healthOverallLabel = document.getElementById('health-overall-label');
  const valPixelDetected = document.getElementById('val-pixel-detected');
  const valPixelId = document.getElementById('val-pixel-id');
  const valSessionId = document.getElementById('val-session-id');
  const valOppref = document.getElementById('val-oppref');
  const valServersideStatus = document.getElementById('val-serverside-status');

  const metricTotalEvents = document.getElementById('metric-total-events');
  const metricStandardEvents = document.getElementById('metric-standard-events');
  const metricCustomEvents = document.getElementById('metric-custom-events');
  const metricIssuesEvents = document.getElementById('metric-issues-events');
  const latestEventContent = document.getElementById('latest-event-content');
  const latestEventTime = document.getElementById('latest-event-time');

  // Tab counters
  const tabCountEvents = document.getElementById('tab-count-events');
  const tabCountFunnel = document.getElementById('tab-count-funnel');
  const tabCountDatalayer = document.getElementById('tab-count-datalayer');
  const tabCountIssues = document.getElementById('tab-count-issues');

  // Events Tab elements
  const eventSearchInput = document.getElementById('event-search-input');
  const filterChips = document.querySelectorAll('.filter-chip');
  const eventsListContainer = document.getElementById('events-list-container');

  // Funnel Tab elements
  const funnelRateBadge = document.getElementById('funnel-rate-badge');
  const funnelPipelineContainer = document.getElementById('funnel-pipeline-container');

  // Data Layer Tab elements
  const gtmContainerBadge = document.getElementById('gtm-container-badge');
  const gtmContainerPills = document.getElementById('gtm-container-pills');
  const datalayerListContainer = document.getElementById('datalayer-list-container');

  // Attribution Tab elements
  const opprefStatusBadge = document.getElementById('oppref-status-badge');
  const attrUrlVal = document.getElementById('attr-url-val');
  const attrCookieVal = document.getElementById('attr-cookie-val');
  const attrStorageVal = document.getElementById('attr-storage-val');
  const attrActiveKey = document.getElementById('attr-active-key');

  // Issues Tab elements
  const issuesStatusBadge = document.getElementById('issues-status-badge');
  const issuesSummarySubtitle = document.getElementById('issues-summary-subtitle');
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
  const expandedPayloadEventIds = new Set();
  const expandedDlIndices = new Set();

  // ==========================================
  // SVG Icon System (Professional & Zero Emojis)
  // ==========================================
  const ICONS = {
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warn: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    sun: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    moon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    copy: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    emptyCheck: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    emptyEvents: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  function renderStatusBadge(severity, label, titleText) {
    const safeTitle = titleText ? ` title="${escapeHtml(titleText)}"` : '';
    if (severity === 'valid' || severity === 'pass' || severity === 'success' || severity === 'detected' || severity === 'triggered') {
      return `<span class="badge badge-success"${safeTitle}>${ICONS.check} ${label || 'Triggered'}</span>`;
    } else if (severity === 'error' || severity === 'critical' || severity === 'fail' || severity === 'duplicate') {
      return `<span class="badge badge-error"${safeTitle}>${ICONS.cross} ${label || 'Error'}</span>`;
    } else if (severity === 'warning') {
      return `<span class="badge badge-warning"${safeTitle}>${ICONS.warn} ${label || 'Warning'}</span>`;
    } else if (severity === 'info') {
      return `<span class="badge badge-info"${safeTitle}>${ICONS.info} ${label || 'Info'}</span>`;
    } else {
      return `<span class="badge badge-neutral"${safeTitle}>${label || 'Not detected'}</span>`;
    }
  }

  // Copy with Visual Feedback
  function copyToClipboard(text, triggerBtn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      if (triggerBtn) {
        const originalHtml = triggerBtn.innerHTML;
        triggerBtn.innerHTML = ICONS.check;
        triggerBtn.style.color = 'var(--status-success)';
        setTimeout(() => {
          triggerBtn.innerHTML = originalHtml;
          triggerBtn.style.color = '';
        }, 1500);
      }
    });
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
  // 3. Navigation System (Option B: Primary + Secondary)
  // ==========================================
  allNavTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      
      allNavTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      tabPanes.forEach((pane) => {
        if (pane.id === `pane-${targetId}`) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });

  // Search Filter Handler
  eventSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderEvents();
  });

  // Filter Chips Handler
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderEvents();
    });
  });

  // Copy Hostname Button
  if (btnCopyHost) {
    btnCopyHost.addEventListener('click', () => {
      if (activeTab && activeTab.url) {
        try {
          const urlObj = new URL(activeTab.url);
          copyToClipboard(urlObj.hostname, btnCopyHost);
        } catch (_) {
          copyToClipboard(activeTab.url, btnCopyHost);
        }
      }
    });
  }

  // ==========================================
  // 4. Modal Handlers
  // ==========================================
  function openRawModal(title, jsonData) {
    modalEventTitle.textContent = title;
    activeModalJson = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
    modalJsonContent.textContent = activeModalJson;
    rawModal.classList.remove('hidden');
  }

  modalCloseBtn.addEventListener('click', () => {
    rawModal.classList.add('hidden');
  });

  rawModal.addEventListener('click', (e) => {
    if (e.target === rawModal) rawModal.classList.add('hidden');
  });

  modalCopyBtn.addEventListener('click', () => {
    copyToClipboard(activeModalJson, modalCopyBtn);
    modalCopyBtn.textContent = 'Copied!';
    setTimeout(() => { modalCopyBtn.textContent = 'Copy JSON'; }, 1500);
  });

  // ==========================================
  // 5. Active Tab & Session Sync
  // ==========================================
  async function getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0] || null;
  }

  async function updateState() {
    activeTab = await getActiveTab();
    if (!activeTab) {
      targetHostEl.textContent = 'No active tab';
      return;
    }

    try {
      const urlObj = new URL(activeTab.url);
      targetHostEl.textContent = urlObj.hostname || activeTab.url;
      badgeTabIdEl.textContent = `Tab #${activeTab.id}`;
    } catch (_) {
      targetHostEl.textContent = activeTab.url || 'Internal page';
      badgeTabIdEl.textContent = `Tab #${activeTab.id}`;
    }

    // Proactively request scan from content script
    if (activeTab && activeTab.id) {
      chrome.tabs.sendMessage(activeTab.id, { action: 'REQUEST_SCAN' }).catch(() => {});
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GET_TAB_STATE',
        tabId: activeTab.id
      });
      if (response && response.state) {
        currentTabState = response.state;
        renderAll();
      }
    } catch (err) {
      console.warn('[OpenAI Pixel Inspector] Background sync error:', err);
    }
  }

  function renderAll() {
    renderOverview();
    renderEvents();
    renderFunnel();
    renderDataLayer();
    renderAttribution();
    renderIssues();
    renderAudit();
  }

  // ==========================================
  // 6. Overview Renderer (Tracking Health Dashboard)
  // ==========================================
  function renderOverview() {
    if (!currentTabState) return;

    const pixel = currentTabState.pixel || {};
    const stats = currentTabState.stats || {};
    const attribution = currentTabState.attribution || {};
    const dataLayer = currentTabState.dataLayer || [];
    const events = currentTabState.events || [];
    const report = generateAuditReport(currentTabState);

    // Overall Health Status Badge
    if (report.overallStatus === 'pass') {
      pixelStatusBadge.textContent = 'Active';
      pixelStatusBadge.className = 'badge badge-success';
      healthStatusBadge.textContent = 'Healthy (Pass)';
      healthStatusBadge.className = 'badge badge-success';
      healthOverallLabel.textContent = 'All tracking criteria verified';
    } else if (report.overallStatus === 'warning') {
      pixelStatusBadge.textContent = 'Warnings';
      pixelStatusBadge.className = 'badge badge-warning';
      healthStatusBadge.textContent = 'Needs Attention';
      healthStatusBadge.className = 'badge badge-warning';
      healthOverallLabel.textContent = 'Suboptimal tracking parameters';
    } else {
      pixelStatusBadge.textContent = 'Errors';
      pixelStatusBadge.className = 'badge badge-error';
      healthStatusBadge.textContent = 'Errors Detected';
      healthStatusBadge.className = 'badge badge-error';
      healthOverallLabel.textContent = 'Critical issues need resolution';
    }

    // Health Table Rows
    if (pixel.installed) {
      valPixelDetected.innerHTML = '<span style="color:var(--status-success); font-weight:600;">Detected</span>';
    } else {
      valPixelDetected.innerHTML = '<span style="color:var(--text-muted);">Not detected</span>';
    }

    if (pixel.pixelIds && pixel.pixelIds.length > 0) {
      valPixelId.innerHTML = `<span style="color:var(--status-success); font-weight:600;">Detected</span> <span class="mono" style="color:var(--text-secondary); font-size:11.5px;">(${escapeHtml(pixel.pixelIds.join(', '))})</span>`;
    } else {
      valPixelId.innerHTML = '<span style="color:var(--text-muted);">None</span>';
    }

    valSessionId.textContent = currentTabState.sessionId || 'SESSION_' + activeTab?.id;

    if (attribution.oppref) {
      valOppref.innerHTML = `<span style="color:var(--status-success); font-weight:600;">Detected</span> <span class="mono" style="color:var(--text-secondary); font-size:11px;">(${escapeHtml(truncateString(attribution.oppref, 14))})</span>`;
    } else {
      valOppref.innerHTML = '<span style="color:var(--text-muted);">Not detected</span>';
    }

    // Server-Side Activity Check
    const hasCapi = currentTabState.events?.some(e => e.isCapi || e.requestOrigin === 'server' || e.url?.includes('/api/')) || false;
    if (hasCapi) {
      valServersideStatus.innerHTML = '<span style="color:var(--status-success); font-weight:600;">Detected</span> <span style="color:var(--text-secondary); font-size:11.5px;">(First-party endpoint)</span>';
    } else {
      valServersideStatus.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No server-side activity detected during this session</span>';
    }

    // Metric Counters
    metricTotalEvents.textContent = stats.totalEvents || 0;
    metricStandardEvents.textContent = stats.standardEvents || 0;
    metricCustomEvents.textContent = stats.customEvents || 0;
    
    const issuesCount = (stats.errorEvents || 0) + (stats.duplicateEvents || 0) + (report.scores.piiViolationsCount || 0) + (report.issues?.length || 0);
    metricIssuesEvents.textContent = issuesCount;
    if (issuesCount === 0) {
      metricIssuesEvents.className = 'metric-num text-muted';
    } else {
      metricIssuesEvents.className = 'metric-num text-rose';
    }

    // Navigation Tab Count Badges
    tabCountEvents.textContent = stats.totalEvents || 0;
    tabCountFunnel.textContent = `${report.funnel.completedCount}/5`;
    tabCountDatalayer.textContent = dataLayer.length || 0;
    tabCountIssues.textContent = issuesCount;

    // Latest Observed Event Snapshot
    if (events.length > 0) {
      const latest = events[events.length - 1];
      latestEventTime.textContent = formatTimestamp(latest.timestamp);
      const paramCount = Object.keys(latest.parameters || {}).length;
      latestEventContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="event-type-badge ${latest.validation?.isCustom ? 'event-type-custom' : 'event-type-std'}">
              ${latest.validation?.isCustom ? 'Custom' : 'Standard'}
            </span>
            <strong style="font-size: 13.5px; color: var(--text-main); font-weight: 600;">${escapeHtml(latest.displayName || latest.name)}</strong>
          </div>
          ${latest.isDuplicate ? renderStatusBadge('duplicate', 'Double Fired') : renderStatusBadge('triggered', 'Triggered')}
        </div>
        <div class="event-meta-line" style="margin-top: 5px; font-size: 11.5px; color: var(--text-secondary);">
          <span>${paramCount} parameter(s) &bull; <code class="mono" style="font-size: 11px;">${escapeHtml(latest.pathname || '/')}</code></span>
          <span style="font-size: 11px; color: var(--text-muted);">ID: ${latest.eventId ? `<code>${escapeHtml(latest.eventId)}</code>` : '<em>Not Sent</em>'}</span>
        </div>
      `;
    } else {
      latestEventContent.innerHTML = '<div class="empty-state-sm">No events detected yet.</div>';
      latestEventTime.textContent = '--:--:--';
    }
  }

  // ==========================================
  // 7. Events Timeline Renderer (Separation of Trigger & Validation)
  // ==========================================
  function renderEvents() {
    if (!currentTabState) return;
    const events = currentTabState.events || [];

    const filtered = events.filter((evt) => {
      if (currentFilter === 'standard' && evt.validation.isCustom) return false;
      if (currentFilter === 'custom' && !evt.validation.isCustom) return false;
      if (currentFilter === 'duplicates' && !evt.isDuplicate) return false;
      if (currentFilter === 'errors' && evt.validation.status !== 'error') return false;
      if (currentFilter === 'warnings' && evt.validation.status !== 'warning') return false;

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
          <p class="empty-text">No matching events observed.</p>
          <span class="empty-subtext">Trigger tracking interactions on the target page.</span>
        </div>
      `;
      return;
    }

    eventsListContainer.innerHTML = '';
    filtered.slice().reverse().forEach((evt, idx) => {
      const item = document.createElement('div');
      const itemKey = evt._id || `evt_${idx}`;
      const isExpanded = expandedEventIds.has(itemKey);
      const isCustom = evt.validation.isCustom;

      // 1. Separation of Trigger vs Validation
      let triggerBadgeHtml = '';
      if (evt.isDuplicate) {
        triggerBadgeHtml = renderStatusBadge('duplicate', 'Double Fired');
      } else if (evt.requestCount > 1) {
        triggerBadgeHtml = renderStatusBadge('duplicate', `Fired ${evt.requestCount}x`);
      } else {
        triggerBadgeHtml = renderStatusBadge('triggered', 'Triggered');
      }

      // 2. Actionable Parameter Errors Box
      let issueBannerHtml = '';
      const params = evt.parameters || {};
      const validation = evt.validation || {};
      const valResults = validation.parameterResults || {};
      
      const errorKeys = Object.keys(valResults).filter(k => valResults[k].severity === 'error' || valResults[k].valid === false);
      const warningKeys = Object.keys(valResults).filter(k => valResults[k].severity === 'warning');

      if (errorKeys.length > 0) {
        const errDetails = errorKeys.map(k => {
          const res = valResults[k];
          return `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(res.message || 'Invalid parameter format')}</div>`;
        }).join('');
        issueBannerHtml = `
          <div class="event-issue-banner">
            <div><strong>${errorKeys.length} parameter error(s):</strong></div>
            ${errDetails}
          </div>
        `;
      } else if (warningKeys.length > 0) {
        const warnDetails = warningKeys.map(k => {
          const res = valResults[k];
          return `<div><strong>${escapeHtml(k)}:</strong> ${escapeHtml(res.message || 'Suboptimal parameter')}</div>`;
        }).join('');
        issueBannerHtml = `
          <div class="event-issue-banner" style="background: var(--status-warning-bg); border-left-color: var(--status-warning); color: var(--status-warning);">
            <div><strong>${warningKeys.length} parameter warning(s):</strong></div>
            ${warnDetails}
          </div>
        `;
      }

      // 3. Parameter Table Rows
      let paramRows = '';
      for (const [key, val] of Object.entries(params)) {
        const valRes = valResults[key] || {};
        let piiBadge = '';
        if (valRes.pii && valRes.piiDetails) {
          piiBadge = `<span class="badge badge-error" style="font-size:10px; padding:1px 4px; margin-left:4px;">PII: ${valRes.piiDetails.type}</span>`;
        }

        let statusText = 'Valid';
        let statusSev = 'valid';
        if (valRes.severity === 'error' || valRes.valid === false) {
          statusText = 'Error';
          statusSev = 'error';
        } else if (valRes.severity === 'warning') {
          statusText = 'Warning';
          statusSev = 'warning';
        } else if (valRes.severity === 'info') {
          statusText = 'Info';
          statusSev = 'info';
        }

        let displayVal = '';
        if (typeof val === 'object' && val !== null) {
          const formattedJson = JSON.stringify(val, null, 2);
          const itemCount = Array.isArray(val) ? `${val.length} item(s)` : `${Object.keys(val).length} field(s)`;
          displayVal = `
            <div class="param-code-container">
              <span class="param-code-tag">${itemCount}</span>
              <pre class="param-code-block">${escapeHtml(formattedJson)}</pre>
            </div>
          `;
        } else {
          displayVal = `<span class="param-scalar-val">${escapeHtml(String(val))}</span>`;
        }

        paramRows += `
          <tr>
            <td class="param-name-cell"><strong>${escapeHtml(key)}</strong>${piiBadge}</td>
            <td class="param-val-cell">${displayVal}</td>
            <td class="param-status-cell">${renderStatusBadge(statusSev, statusText, valRes.message)}</td>
          </tr>
        `;
      }

      if (Object.keys(params).length === 0) {
        paramRows = '<tr><td colspan="3" style="color:var(--text-muted); text-align:center; padding:8px;">No parameters passed</td></tr>';
      }

      const eventIdDisplay = evt.eventId ? `<code>${escapeHtml(evt.eventId)}</code>` : '<span style="color:var(--text-muted); font-style:italic;">Not Sent</span>';

      const isPayloadOpen = expandedPayloadEventIds.has(itemKey);

      item.className = `event-card ${isExpanded ? 'open' : ''}`;
      item.innerHTML = `
        <div class="event-card-header">
          <div class="event-card-top">
            <div class="event-title-group">
              <span class="event-type-badge ${isCustom ? 'event-type-custom' : 'event-type-std'}">
                ${isCustom ? 'Custom' : 'Standard'}
              </span>
              <span class="event-name">${escapeHtml(evt.displayName || evt.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              ${triggerBadgeHtml}
              <span class="event-time-text">${formatTimestamp(evt.timestamp)}</span>
            </div>
          </div>
          <div class="event-meta-line">
            <span class="event-path-text truncate">${escapeHtml(evt.pathname || evt.url || '/')}</span>
            <span style="font-size: 11.5px; color: var(--text-secondary);">${Object.keys(params).length} parameter(s)</span>
          </div>
        </div>

        ${issueBannerHtml}

        <div class="event-details-drawer">
          <div class="event-spec-grid">
            <div class="event-spec-item">
              <span class="event-spec-label">Event ID</span>
              <span class="event-spec-val">${eventIdDisplay}</span>
            </div>
            <div class="event-spec-item">
              <span class="event-spec-label">Pixel ID</span>
              <span class="event-spec-val">${evt.pixelId ? `<code>${escapeHtml(evt.pixelId)}</code>` : '<span style="color:var(--text-muted)">Default</span>'}</span>
            </div>
          </div>

          <table class="param-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Value</th>
                <th style="text-align:right;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${paramRows}
            </tbody>
          </table>

          <details class="payload-details" ${isPayloadOpen ? 'open' : ''}>
            <summary>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
              <span>View JSON Payload</span>
            </summary>
            <pre class="payload-code">${escapeHtml(JSON.stringify(evt.parameters, null, 2))}</pre>
          </details>
        </div>
      `;

      // Accordion click handler on header
      const header = item.querySelector('.event-card-header');
      header.addEventListener('click', () => {
        if (expandedEventIds.has(itemKey)) {
          expandedEventIds.delete(itemKey);
          item.classList.remove('open');
        } else {
          expandedEventIds.add(itemKey);
          item.classList.add('open');
        }
      });

      // Stop propagation inside details drawer so interacting with table / JSON never closes the card
      const drawer = item.querySelector('.event-details-drawer');
      if (drawer) {
        drawer.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      // Track payload details open state persistently
      const payloadDetails = item.querySelector('.payload-details');
      if (payloadDetails) {
        payloadDetails.addEventListener('toggle', () => {
          if (payloadDetails.open) {
            expandedPayloadEventIds.add(itemKey);
          } else {
            expandedPayloadEventIds.delete(itemKey);
          }
        });
      }

      eventsListContainer.appendChild(item);
    });
  }

  // ==========================================
  // 8. Funnel Journey Renderer (Vertical Flow)
  // ==========================================
  function renderFunnel() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const funnel = report.funnel;

    funnelRateBadge.textContent = `${funnel.completionPercentage}% Completed (${funnel.completedCount}/5)`;
    funnelRateBadge.className = funnel.completionPercentage === 100 ? 'badge badge-success' : (funnel.completionPercentage > 0 ? 'badge badge-warning' : 'badge badge-neutral');

    let funnelHtml = '';
    funnel.steps.forEach((step) => {
      const isTriggered = step.detected;
      const statusBadge = isTriggered ? renderStatusBadge('triggered', 'Triggered') : renderStatusBadge('neutral', 'Not triggered');
      const timeStr = step.latestTimestamp ? formatTimestamp(step.latestTimestamp) : '';

      funnelHtml += `
        <div class="funnel-step-row ${isTriggered ? 'completed' : 'pending'}">
          <div class="funnel-step-disc">${step.stepNumber}</div>
          <div class="funnel-step-content">
            <span class="funnel-step-title">${escapeHtml(step.label)}</span>
            <span class="funnel-step-sub">
              ${isTriggered ? `Event ID: ${step.hasEventId ? `<code>${escapeHtml(step.eventId)}</code>` : 'Not sent'} ${step.hasAmount ? ' • Amount set' : ''}` : 'Action pending in session'}
            </span>
          </div>
          <div class="funnel-step-meta">
            ${timeStr ? `<span class="mono" style="font-size: 11px; color: var(--text-muted);">${timeStr}</span>` : ''}
            ${statusBadge}
          </div>
        </div>
      `;
    });
    funnelPipelineContainer.innerHTML = funnelHtml;
  }

  // ==========================================
  // 9. Data Layer Developer Feed Renderer
  // ==========================================
  function renderDataLayer() {
    if (!currentTabState) return;
    const gtmContainers = currentTabState.gtmContainers || [];
    const dataLayerEvents = currentTabState.dataLayer || [];

    if (gtmContainers.length > 0) {
      gtmContainerBadge.textContent = `${gtmContainers.length} Detected`;
      gtmContainerBadge.className = 'badge badge-success';
      gtmContainerPills.innerHTML = gtmContainers.map((gId) => `
        <span class="gtm-pill">
          <span>${escapeHtml(gId)}</span>
          <button class="btn-copy-inline" data-gtm="${escapeHtml(gId)}" title="Copy GTM ID">${ICONS.copy}</button>
        </span>
      `).join(' ');

      gtmContainerPills.querySelectorAll('.btn-copy-inline').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          copyToClipboard(btn.dataset.gtm, btn);
        });
      });
    } else {
      gtmContainerBadge.textContent = 'None Detected';
      gtmContainerBadge.className = 'badge badge-neutral';
      gtmContainerPills.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No Google Tag Manager containers detected.</span>';
    }

    if (dataLayerEvents.length === 0) {
      datalayerListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${ICONS.emptyEvents}</span>
          <p class="empty-text">No window.dataLayer pushes recorded.</p>
          <span class="empty-subtext">Events pushed to window.dataLayer appear here in real time.</span>
        </div>
      `;
      return;
    }

    datalayerListContainer.innerHTML = '';
    dataLayerEvents.slice().reverse().forEach((dl, idx) => {
      const isExpanded = expandedDlIndices.has(idx);
      const evtName = dl.event || dl.data?.event || 'dataLayer.push';
      const timeStr = formatTimestamp(dl.timestamp);

      const row = document.createElement('div');
      row.className = `dl-row ${isExpanded ? 'open' : ''}`;
      row.innerHTML = `
        <div class="dl-row-header">
          <div class="dl-row-left">
            <span class="dl-time">${timeStr}</span>
            <span class="dl-badge">GTM DL</span>
            <span class="dl-name">${escapeHtml(evtName)}</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">${Object.keys(dl.data || {}).length} keys</span>
        </div>
        <div class="dl-drawer">
          <pre class="payload-code">${escapeHtml(JSON.stringify(dl.data || dl, null, 2))}</pre>
        </div>
      `;

      row.addEventListener('click', () => {
        if (expandedDlIndices.has(idx)) {
          expandedDlIndices.delete(idx);
          row.classList.remove('open');
        } else {
          expandedDlIndices.add(idx);
          row.classList.add('open');
        }
      });

      datalayerListContainer.appendChild(row);
    });
  }

  // ==========================================
  // 10. Attribution (oppref) Renderer
  // ==========================================
  function renderAttribution() {
    if (!currentTabState) return;
    const attribution = currentTabState.attribution || {};

    if (attribution.oppref) {
      opprefStatusBadge.textContent = 'Detected';
      opprefStatusBadge.className = 'badge badge-success';
    } else {
      opprefStatusBadge.textContent = 'Not detected';
      opprefStatusBadge.className = 'badge badge-neutral';
    }

    attrUrlVal.innerHTML = attribution.urlDetected ? `<span style="color:var(--status-success); font-weight:600;">${escapeHtml(attribution.details.urlParam)}</span>` : '<span style="color:var(--text-muted);">Not found</span>';
    attrCookieVal.innerHTML = attribution.cookieDetected ? `<span style="color:var(--status-success); font-weight:600;">${escapeHtml(attribution.details.cookieValue)}</span>` : '<span style="color:var(--text-muted);">Not found</span>';
    attrStorageVal.innerHTML = attribution.storageDetected ? `<span style="color:var(--status-success); font-weight:600;">${escapeHtml(attribution.details.localStorage)}</span>` : '<span style="color:var(--text-muted);">Not found</span>';
    attrActiveKey.innerHTML = attribution.oppref ? `<span style="color:var(--status-success); font-weight:600;">${escapeHtml(attribution.oppref)}</span>` : '<span style="color:var(--text-muted);">None</span>';
  }

  // ==========================================
  // 11. Issues & Diagnostics Renderer
  // ==========================================
  function renderIssues() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const issues = report.issues || [];

    const errorCount = issues.filter(i => i.severity === 'critical' || i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    issuesStatusBadge.textContent = `${issues.length} Issue${issues.length === 1 ? '' : 's'}`;
    issuesStatusBadge.className = errorCount > 0 ? 'badge badge-error' : (warningCount > 0 ? 'badge badge-warning' : 'badge badge-neutral');
    issuesSummarySubtitle.textContent = `${errorCount} Error${errorCount === 1 ? '' : 's'} · ${warningCount} Warning${warningCount === 1 ? '' : 's'} · ${infoCount} Info`;

    if (issues.length === 0) {
      issuesListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${ICONS.emptyCheck}</span>
          <p class="empty-text">No implementation issues found.</p>
          <span class="empty-subtext">All observed tracking calls match OpenAI Pixel specifications.</span>
        </div>
      `;
      return;
    }

    issuesListContainer.innerHTML = '';
    issues.forEach((iss) => {
      const card = document.createElement('div');
      const sev = iss.severity || 'warning';
      card.className = `issue-item issue-item-${sev}`;

      // Map human-readable headline
      let headline = iss.title || iss.code;
      if (iss.code === 'PARAM_CONTENTS_ITEM_ERROR') headline = 'Invalid Item Amount Minor Units';
      else if (iss.code === 'PII_LEAK_DETECTED') headline = 'PII Data Privacy Violation';
      else if (iss.code === 'DOUBLE_FIRING_DETECTED') headline = 'Duplicate Event Double Fired';
      else if (iss.code === 'OPPREF_NOT_DETECTED') headline = 'No Attribution Identifier (Direct Visit)';
      else if (iss.code === 'PIXEL_NOT_INITIALIZED') headline = 'Pixel SDK Not Initialized';

      card.innerHTML = `
        <div class="issue-item-top">
          <span class="issue-headline">${escapeHtml(headline)}</span>
          ${renderStatusBadge(sev, sev.toUpperCase())}
        </div>
        <span class="issue-code-meta">${escapeHtml(iss.code)}</span>
        <p class="issue-desc">${escapeHtml(iss.message)}</p>
        ${iss.recommendation ? `<div class="issue-action-box"><strong>Fix:</strong> ${escapeHtml(iss.recommendation)}</div>` : ''}
      `;
      issuesListContainer.appendChild(card);
    });
  }

  // ==========================================
  // 12. Audit Summary & Export Renderer
  // ==========================================
  function renderAudit() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);

    if (report.overallStatus === 'pass') {
      auditScoreBadge.textContent = 'Healthy (Pass)';
      auditScoreBadge.className = 'badge badge-success';
    } else if (report.overallStatus === 'warning') {
      auditScoreBadge.textContent = 'Needs Attention';
      auditScoreBadge.className = 'badge badge-warning';
    } else {
      auditScoreBadge.textContent = 'Errors Detected';
      auditScoreBadge.className = 'badge badge-error';
    }

    // 4 Logical Executive Cards
    auditSummaryBox.innerHTML = `
      <div class="audit-stat-card">
        <span class="audit-stat-label">Session</span>
        <span class="audit-stat-val mono truncate">${escapeHtml(report.sessionId || 'SESSION')}</span>
      </div>
      <div class="audit-stat-card">
        <span class="audit-stat-label">Journey</span>
        <span class="audit-stat-val">${report.scores.pagesVisitedCount} page(s) · ${report.scores.totalEvents} events · ${report.funnel.completionPercentage}% funnel</span>
      </div>
      <div class="audit-stat-card">
        <span class="audit-stat-label">Data Quality</span>
        <span class="audit-stat-val ${report.scores.duplicateEvents > 0 ? 'text-rose' : 'text-emerald'}">${report.scores.duplicateEvents} duplicate(s) · ${report.scores.piiViolationsCount} PII</span>
      </div>
      <div class="audit-stat-card">
        <span class="audit-stat-label">Issues</span>
        <span class="audit-stat-val ${report.scores.errorEvents > 0 ? 'text-rose' : 'text-emerald'}">${report.scores.errorEvents} error(s) · ${report.scores.warningEvents} warning(s)</span>
      </div>
    `;

    // Stacked Journey List
    if (report.journeyTable && report.journeyTable.length > 0) {
      let rowsHtml = '';
      report.journeyTable.forEach((row) => {
        const isDup = row.duplicateStatus.includes('Double Fired') || row.duplicateStatus.includes('Duplicate');
        rowsHtml += `
          <div class="audit-stacked-row">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="mono" style="color: var(--text-muted); font-size: 11px;">#${row.step}</span>
              <strong style="color: var(--text-main);">${escapeHtml(row.name)}</strong>
              <span class="mono truncate" style="color: var(--text-secondary); max-width: 140px; font-size: 11px;">${escapeHtml(row.pathname || '/')}</span>
            </div>
            <div>
              ${isDup ? renderStatusBadge('duplicate', 'Duplicate') : renderStatusBadge('success', 'Clean')}
            </div>
          </div>
        `;
      });
      journeyTableContainer.innerHTML = `<div class="audit-stacked-list">${rowsHtml}</div>`;
    } else {
      journeyTableContainer.innerHTML = '<div class="empty-state-sm">No journey steps recorded yet.</div>';
    }

    // Event Summary Breakdown
    if (report.eventSummaries && report.eventSummaries.length > 0) {
      let sumHtml = '';
      report.eventSummaries.forEach((sum) => {
        sumHtml += `
          <div class="audit-stacked-row">
            <div>
              <strong style="color: var(--text-main);">${escapeHtml(sum.displayName || sum.name)}</strong>
              <span style="color: var(--text-muted); font-size: 11px; margin-left: 6px;">(${sum.detected} observed)</span>
            </div>
            <span style="font-size: 11.5px; font-weight: 600; color: ${sum.duplicates > 0 ? 'var(--status-error)' : 'var(--status-success)'};">
              ${escapeHtml(sum.audit)}
            </span>
          </div>
        `;
      });
      eventSummaryTableContainer.innerHTML = `<div class="audit-stacked-list">${sumHtml}</div>`;
    } else {
      eventSummaryTableContainer.innerHTML = '<div class="empty-state-sm">No events to summarize.</div>';
    }
  }

  // ==========================================
  // 13. Action Handlers
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
      expandedDlIndices.clear();
      await chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id }).catch(() => {});
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
      `- **GTM Containers:** ${(report.gtmContainers || []).join(', ') || 'None'}`,
      ``,
      `## 2. E-Commerce Funnel Completion`,
      `- **Funnel Completion:** ${report.funnel.completionPercentage}% (${report.funnel.completedCount}/5 steps)`,
      `- **PII Privacy Violations:** ${report.scores.piiViolationsCount}`,
      ``,
      `## 3. Event Journey Summary`,
      `- **Total Events:** ${report.scores.totalEvents}`,
      `- **Standard Events:** ${report.scores.standardEvents}`,
      `- **Custom Events:** ${report.scores.customEvents}`,
      `- **Duplicate / Double Fires:** ${report.scores.duplicateEvents}`,
      `- **Pages Visited:** ${report.scores.pagesVisitedCount}`,
      ``,
      `## 4. Issues & Recommendations`,
      report.issues.length === 0 ? `*No issues found. Tracking implementation is clean!*` : report.issues.map((i) => `- **[${i.severity.toUpperCase()}] ${i.code}**: ${i.message}\n  *Recommendation:* ${i.recommendation || 'N/A'}`).join('\n')
    ].join('\n');

    copyToClipboard(md, btnCopyMarkdown);
  });

  btnExportCsv.addEventListener('click', () => {
    if (!currentTabState || !currentTabState.events) return;
    const headers = [
      'Step',
      'Timestamp',
      'Event Name',
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
        `"${evt.pathname || ''}"`,
        `"${evt.eventId || 'Not Sent'}"`,
        `"${evt.pixelId || ''}"`,
        `"${evt.duplicateStatus || 'Clean'}"`,
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
    dlAnchor.setAttribute('download', `openai_pixel_audit_${Date.now()}.csv`);
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
    dlAnchor.setAttribute('download', `openai_pixel_audit_${Date.now()}.json`);
    dlAnchor.click();
  });

  // Initial Load and Polling interval
  await updateState();
  setInterval(updateState, 1500);
});
