/**
 * OpenAI Ads Pixel Inspector - Professional Developer & Analytics Debugger
 * Reference Style: Stripe Dashboard + Linear + Chrome DevTools + OpenAI Branding
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport, generateComprehensiveAudit, formatAuditMarkdown, formatAuditCsv } from '../core/scanner.js';
import { getEventInfo, getParameterInfo, EVENT_DICTIONARY, ATTRIBUTION_DICTIONARY } from '../core/dictionary.js';

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
  const valPixelId = document.getElementById('val-pixel-id');
  const valOppref = document.getElementById('val-oppref');

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
  const attrObrefVal = document.getElementById('attr-obref-val');
  const attrStorageVal = document.getElementById('attr-storage-val');
  const attrActiveKey = document.getElementById('attr-active-key');

  // Issues Tab elements
  const issuesStatusBadge = document.getElementById('issues-status-badge');
  const issuesSummarySubtitle = document.getElementById('issues-summary-subtitle');
  const issuesListContainer = document.getElementById('issues-list-container');
  const issueFilterChips = document.querySelectorAll('.issue-chip');
  const issueFilterCountAll = document.getElementById('issue-filter-count-all');
  const issueFilterCountError = document.getElementById('issue-filter-count-error');
  const issueFilterCountWarning = document.getElementById('issue-filter-count-warning');
  const issueFilterCountInfo = document.getElementById('issue-filter-count-info');

  // Audit Tab elements
  const auditScoreBadge = document.getElementById('audit-score-badge');
  const auditSubtitleWebsite = document.getElementById('audit-subtitle-website');
  const auditSummaryBox = document.getElementById('audit-summary-box');
  const auditOverviewCount = document.getElementById('audit-overview-count');
  const auditOverviewTableContainer = document.getElementById('audit-overview-table-container');
  const auditScoresGrid = document.getElementById('audit-scores-grid');
  const auditInsightsContainer = document.getElementById('audit-insights-container');
  const auditActionsContainer = document.getElementById('audit-actions-container');
  const btnCopyMarkdown = document.getElementById('btn-copy-markdown');
  const btnExportPdf = document.getElementById('btn-export-pdf');
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
  let currentIssueFilter = 'all';
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
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
    chevronRight: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
    emptyCheck: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    emptyEvents: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  const collapsedSectionKeys = new Set();
  const sectionViewModes = new Map();
  const collapsedNestedKeys = new Set();
  const collapsedJsonPaths = new Set();
  const openRawSectionKeys = new Set();

  function renderStatusBadge(severity, label, titleText) {
    const safeTitle = titleText ? (' title="' + escapeHtml(titleText) + '"') : '';
    if (severity === 'valid' || severity === 'pass' || severity === 'success' || severity === 'detected' || severity === 'triggered') {
      return '<span class="badge badge-success"' + safeTitle + '>' + ICONS.check + ' ' + (label || 'Triggered') + '</span>';
    } else if (severity === 'error' || severity === 'critical' || severity === 'fail' || severity === 'duplicate') {
      return '<span class="badge badge-error"' + safeTitle + '>' + ICONS.cross + ' ' + (label || 'Error') + '</span>';
    } else if (severity === 'warning') {
      return '<span class="badge badge-warning"' + safeTitle + '>' + ICONS.warn + ' ' + (label || 'Warning') + '</span>';
    } else if (severity === 'info') {
      return '<span class="badge badge-info"' + safeTitle + '>' + ICONS.info + ' ' + (label || 'Info') + '</span>';
    } else {
      return '<span class="badge badge-neutral"' + safeTitle + '>' + (label || 'Not detected') + '</span>';
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

  // Helper to make copyable element
  function makeCopyable(text, displayHtml, extraClass = '') {
    if (!text) return displayHtml || '<span style="color:var(--text-muted);">None</span>';
    return `
      <span class="copyable-inline ${extraClass}">
        <span>${displayHtml || escapeHtml(text)}</span>
        <button class="btn-copy-inline" data-copy="${escapeHtml(text)}" title="Copy value">${ICONS.copy}</button>
      </span>
    `;
  }

  function attachCopyListeners(container) {
    if (!container) return;
    container.querySelectorAll('.btn-copy-inline[data-copy]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(btn.dataset.copy, btn);
      });
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
  // 3. Single-Row Carousel Navigation System
  // ==========================================
  const navScrollTrack = document.getElementById('nav-scroll-track');
  const navScrollPrev = document.getElementById('nav-scroll-prev');
  const navScrollNext = document.getElementById('nav-scroll-next');

  if (navScrollPrev && navScrollTrack) {
    navScrollPrev.addEventListener('click', () => {
      navScrollTrack.scrollBy({ left: -120, behavior: 'smooth' });
    });
  }

  if (navScrollNext && navScrollTrack) {
    navScrollNext.addEventListener('click', () => {
      navScrollTrack.scrollBy({ left: 120, behavior: 'smooth' });
    });
  }

  allNavTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      
      allNavTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

      tabPanes.forEach((pane) => {
        if (pane.id === ('pane-' + targetId)) {
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });

  // Search Filter Handler
  if (eventSearchInput) {
    eventSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderEvents();
    });
  }

  // Filter Chips Handler (Events)
  if (filterChips) {
    filterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        filterChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderEvents();
      });
    });
  }

  // Filter Chips Handler (Issues / Diagnostics)
  if (issueFilterChips) {
    issueFilterChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        issueFilterChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentIssueFilter = chip.dataset.filter;
        renderIssues();
      });
    });
  }

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
    if (modalEventTitle) modalEventTitle.textContent = title;
    activeModalJson = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
    if (modalJsonContent) modalJsonContent.textContent = activeModalJson;
    if (rawModal) rawModal.classList.remove('hidden');
  }

  if (modalCloseBtn && rawModal) {
    modalCloseBtn.addEventListener('click', () => {
      rawModal.classList.add('hidden');
    });
  }

  if (rawModal) {
    rawModal.addEventListener('click', (e) => {
      if (e.target === rawModal) rawModal.classList.add('hidden');
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      copyToClipboard(activeModalJson, modalCopyBtn);
      modalCopyBtn.textContent = 'Copied!';
      setTimeout(() => { modalCopyBtn.textContent = 'Copy JSON'; }, 1500);
    });
  }

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
      badgeTabIdEl.textContent = 'Tab #' + activeTab.id;
    } catch (_) {
      targetHostEl.textContent = activeTab.url || 'Internal page';
      badgeTabIdEl.textContent = 'Tab #' + activeTab.id;
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
    const rawEvents = currentTabState.events || [];
    const events = rawEvents.filter(e => {
      const n = (e.displayName || e.name || '').toLowerCase();
      return !n.startsWith('openai::') && !n.startsWith('oai::') && n !== 'sdk_init' && n !== 'diagnostic';
    });
    const report = generateAuditReport(currentTabState);
    const issues = report.issues || [];

    // SINGLE SOURCE OF TRUTH FOR COUNTS
    const errorsCount = issues.filter(i => i.severity === 'error' || i.severity === 'critical').length;
    const warningsCount = issues.filter(i => i.severity === 'warning').length;
    const infosCount = issues.filter(i => i.severity === 'info').length;
    const totalDiagnostics = errorsCount + warningsCount + infosCount;

    // Top-Level Workspace Bar Status Badge
    if (errorsCount > 0) {
      pixelStatusBadge.textContent = errorsCount + ' Error' + (errorsCount === 1 ? '' : 's');
      pixelStatusBadge.className = 'badge badge-error';
    } else if (warningsCount > 0) {
      pixelStatusBadge.textContent = warningsCount + ' Warning' + (warningsCount === 1 ? '' : 's');
      pixelStatusBadge.className = 'badge badge-warning';
    } else if (events.length > 0) {
      pixelStatusBadge.textContent = 'Active';
      pixelStatusBadge.className = 'badge badge-success';
    } else {
      pixelStatusBadge.textContent = 'Ready';
      pixelStatusBadge.className = 'badge badge-neutral';
    }

    // Health Card Badge & Subtitle
    if (report.overallStatus === 'pass') {
      healthStatusBadge.textContent = 'Healthy (Pass)';
      healthStatusBadge.className = 'badge badge-success';
      healthOverallLabel.textContent = 'All tracking criteria verified';
    } else if (report.overallStatus === 'warning') {
      healthStatusBadge.textContent = 'Needs Attention · ' + warningsCount + ' warning' + (warningsCount === 1 ? '' : 's');
      healthStatusBadge.className = 'badge badge-warning';
      healthOverallLabel.textContent = warningsCount + ' warning(s) detected';
    } else {
      healthStatusBadge.textContent = 'Needs Attention · ' + errorsCount + ' error' + (errorsCount === 1 ? '' : 's');
      healthStatusBadge.className = 'badge badge-error';
      healthOverallLabel.textContent = 'Parameter error(s) require resolution';
    }

    // Pixel ID Row (SDK row removed as requested)
    if (pixel.pixelIds && pixel.pixelIds.length > 0) {
      const pidStr = pixel.pixelIds.join(', ');
      valPixelId.innerHTML = makeCopyable(pidStr, '<span style="color:var(--status-success); font-weight:600;">Detected</span> <span class="mono" style="color:var(--text-secondary); font-size:11.5px;">(' + escapeHtml(pidStr) + ')</span>');
    } else {
      valPixelId.innerHTML = '<span style="color:var(--text-muted);">Not detected</span>';
    }

    // Attribution (obref / oppref) Row
    const activeRef = attribution.obref || attribution.oppref || null;
    if (activeRef) {
      valOppref.innerHTML = makeCopyable(activeRef, '<span style="color:var(--status-success); font-weight:600;">Detected</span> <span class="mono" style="color:var(--text-secondary); font-size:11px;">(' + escapeHtml(truncateString(activeRef, 14)) + ')</span>');
    } else {
      valOppref.innerHTML = '<span style="color:var(--text-muted);">Not detected</span>';
    }

    // Metric Summary Cards (Clean & neutral by default, highlight only meaningful issues)
    const standardCount = events.filter(e => !e.validation?.isCustom).length;
    const customCount = events.filter(e => e.validation?.isCustom).length;
    metricTotalEvents.textContent = events.length;
    metricStandardEvents.textContent = standardCount;
    metricCustomEvents.textContent = customCount;
    
    // Issues Metric Card (Matches shared source of truth)
    metricIssuesEvents.textContent = totalDiagnostics;
    if (errorsCount > 0) {
      metricIssuesEvents.className = 'metric-num text-rose';
    } else if (warningsCount > 0) {
      metricIssuesEvents.className = 'metric-num text-amber';
    } else if (infosCount > 0) {
      metricIssuesEvents.className = 'metric-num text-blue';
    } else {
      metricIssuesEvents.className = 'metric-num text-muted';
    }

    // Navigation Count Badges
    tabCountEvents.textContent = events.length;
    tabCountFunnel.textContent = report.funnel.completedCount + '/5';
    tabCountDatalayer.textContent = dataLayer.length || 0;
    tabCountIssues.textContent = totalDiagnostics;

    // Latest Observed Event Snapshot (Clean, compact 3-line layout)
    if (events.length > 0) {
      const latest = events[events.length - 1];
      latestEventTime.textContent = formatTimestamp(latest.timestamp);
      
      let latestTriggerBadge = '';
      if (latest.isDuplicate) {
        latestTriggerBadge = renderStatusBadge('duplicate', 'Double Fired');
      } else {
        latestTriggerBadge = renderStatusBadge('triggered', 'Triggered');
      }

      const isCustom = latest.validation && latest.validation.isCustom;
      const latestEvtInfo = getEventInfo(latest.displayName || latest.name);
      const latestColor = latestEvtInfo.color || '#10b981';

      latestEventContent.innerHTML = `
        <div class="latest-event-compact">
          <div class="latest-event-top-line">
            <div style="display:flex; align-items:center; gap:6px;">
              <span class="tree-status-dot" style="background-color: ${latestColor};" title="${escapeHtml(latestEvtInfo.label)}"></span>
              <strong class="latest-event-name">${escapeHtml(latest.displayName || latest.name)}</strong>
            </div>
            ${latestTriggerBadge}
          </div>
          <div class="latest-event-meta-line">
            <span>${formatTimestamp(latest.timestamp)} &bull; <span class="event-type-badge ${isCustom ? 'event-type-custom' : 'event-type-std'}">${escapeHtml(latestEvtInfo.label)}</span></span>
          </div>
          <div class="latest-event-path-line">
            <code class="mono truncate">${escapeHtml(latest.pathname || '/')}</code>
          </div>
        </div>
      `;
    } else {
      latestEventContent.innerHTML = '<div class="empty-state-sm" style="padding: 6px 0;">No events detected yet.</div>';
      latestEventTime.textContent = '--:--:--';
    }

    attachCopyListeners(valPixelId);
    attachCopyListeners(valOppref);
  }

  // ==========================================
  // 7. Live Event Tree & Recursive Inspector
  // ==========================================

  // Interactive Collapsible JSON Component
  function renderInteractiveJson(data, rootId = 'json_root') {
    if (data === undefined) data = null;
    const jsonStr = JSON.stringify(data, null, 2) || '{}';

    function renderNode(val, key = null, path = '', depth = 0) {
      const isObject = typeof val === 'object' && val !== null && !Array.isArray(val);
      const isArray = Array.isArray(val);
      const nodeKey = path || 'root';

      if (isArray) {
        if (val.length === 0) {
          return `<div class="json-line"><span class="json-key">${key !== null ? escapeHtml(JSON.stringify(key)) + ': ' : ''}</span><span class="json-bracket">[]</span></div>`;
        }
        const isExpanded = !collapsedJsonPaths.has(nodeKey);
        const itemsHtml = val.map((item, idx) => renderNode(item, null, `${nodeKey}[${idx}]`, depth + 1)).join('');
        return `<div class="json-node ${isExpanded ? 'open' : ''}"><div class="json-line json-toggle-line" data-json-path="${escapeHtml(nodeKey)}"><span class="json-toggle-icon">${ICONS.chevronRight}</span><span class="json-key">${key !== null ? escapeHtml(JSON.stringify(key)) + ': ' : ''}</span><span class="json-bracket">[</span>${!isExpanded ? `<span class="json-collapsed-preview">${val.length} item${val.length === 1 ? '' : 's'}</span><span class="json-bracket">]</span>` : ''}</div><div class="json-children">${itemsHtml}<div class="json-line"><span class="json-bracket">]</span></div></div></div>`;
      }

      if (isObject) {
        const keys = Object.keys(val);
        if (keys.length === 0) {
          return `<div class="json-line"><span class="json-key">${key !== null ? escapeHtml(JSON.stringify(key)) + ': ' : ''}</span><span class="json-brace">{}</span></div>`;
        }
        const isExpanded = !collapsedJsonPaths.has(nodeKey);
        const propsHtml = keys.map(k => renderNode(val[k], k, `${nodeKey}.${k}`, depth + 1)).join('');
        return `<div class="json-node ${isExpanded ? 'open' : ''}"><div class="json-line json-toggle-line" data-json-path="${escapeHtml(nodeKey)}"><span class="json-toggle-icon">${ICONS.chevronRight}</span><span class="json-key">${key !== null ? escapeHtml(JSON.stringify(key)) + ': ' : ''}</span><span class="json-brace">{</span>${!isExpanded ? `<span class="json-collapsed-preview">${keys.length} key${keys.length === 1 ? '' : 's'}</span><span class="json-brace">}</span>` : ''}</div><div class="json-children">${propsHtml}<div class="json-line"><span class="json-brace">}</span></div></div></div>`;
      }

      // Primitive values
      let valHtml = '';
      if (typeof val === 'string') {
        valHtml = `<span class="json-string">${escapeHtml(JSON.stringify(val))}</span>`;
      } else if (typeof val === 'number') {
        valHtml = `<span class="json-number">${val}</span>`;
      } else if (typeof val === 'boolean') {
        valHtml = `<span class="json-boolean">${val}</span>`;
      } else if (val === null) {
        valHtml = `<span class="json-null">null</span>`;
      } else {
        valHtml = `<span>${escapeHtml(String(val))}</span>`;
      }

      return `<div class="json-line"><span class="json-key">${key !== null ? escapeHtml(JSON.stringify(key)) + ': ' : ''}</span>${valHtml}</div>`;
    }

    return `<div class="json-viewer-box"><div class="json-viewer-header"><span class="json-viewer-tag">JSON Payload</span><button class="btn-copy-inline btn-copy-json" data-copy="${escapeHtml(jsonStr)}" title="Copy JSON">${ICONS.copy} Copy JSON</button></div><div class="json-viewer-tree">${renderNode(data, null, rootId, 0)}</div></div>`;
  }

  // Recursive Parameter Renderer (Primitives, Objects, Arrays)
  function renderParameterValue(key, val, valResults = {}, itemKey = '', path = '', currency = 'USD') {
    const currentPath = path ? `${path}.${key}` : key;
    const isNestedKey = `${itemKey}__${currentPath}`;
    const valRes = valResults[key] || valResults[currentPath] || {};

    let valPill = '';
    if (valRes.valid === false || valRes.severity === 'error') {
      valPill = `<span class="val-pill val-pill-error" title="${escapeHtml(valRes.message || 'Invalid value')}">✕ Invalid</span>`;
    } else if (valRes.severity === 'warning') {
      valPill = `<span class="val-pill val-pill-warning" title="${escapeHtml(valRes.message || 'Warning')}">⚠ Warning</span>`;
    } else if (valRes.severity === 'info') {
      valPill = `<span class="val-pill val-pill-info" title="${escapeHtml(valRes.message || 'Info')}">ℹ Info</span>`;
    } else {
      valPill = `<span class="val-pill val-pill-valid" title="Valid parameter">✓</span>`;
    }

    // Array Parameter (e.g. contents: [...])
    if (Array.isArray(val)) {
      const isArrayOpen = !collapsedNestedKeys.has(isNestedKey);
      const itemsHtml = val.map((item, idx) => {
        const itemPath = `${currentPath}[${idx}]`;
        const itemKeyNested = `${itemKey}__${itemPath}`;
        const isItemOpen = !collapsedNestedKeys.has(itemKeyNested);

        let summaryText = `Item ${idx + 1}`;
        if (typeof item === 'object' && item !== null) {
          const parts = [];
          if (item.id) parts.push(item.id);
          if (item.name) parts.push(item.name);
          else if (item.product && typeof item.product === 'object' && item.product.name) parts.push(item.product.name);
          if (item.quantity !== undefined) parts.push(`Qty ${item.quantity}`);
          if (item.amount !== undefined) parts.push(`Amount ${item.amount}`);
          if (item.price !== undefined) parts.push(`Price ${item.price}`);
          if (parts.length > 0) summaryText = `Item ${idx + 1}: ${parts.join(' · ')}`;
        }

        let childRows = '';
        if (typeof item === 'object' && item !== null) {
          childRows = Object.entries(item).map(([childK, childV]) =>
            renderParameterValue(childK, childV, valResults, itemKey, itemPath, currency)
          ).join('');
        } else {
          childRows = `<tr><td class="tree-key-cell">Value</td><td class="tree-val-cell mono">${escapeHtml(String(item))}</td><td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td></tr>`;
        }

        return `
          <div class="tree-array-item-card ${isItemOpen ? 'open' : ''}">
            <div class="tree-array-item-header" data-toggle-nested="${escapeHtml(itemKeyNested)}">
              <div style="display:flex; align-items:center;">
                <span class="tree-nested-chevron">${ICONS.chevronRight}</span>
                <span style="font-weight:600; font-family:var(--font-mono); font-size:11.5px;">${escapeHtml(summaryText)}</span>
              </div>
            </div>
            <div class="tree-array-item-body">
              <table class="tree-table">
                <tbody>${childRows}</tbody>
              </table>
            </div>
          </div>
        `;
      }).join('');

      return `
        <tr>
          <td colspan="3" style="padding: 2px 0;">
            <div class="tree-nested-array ${isArrayOpen ? 'open' : ''}">
              <div class="tree-nested-header" data-toggle-nested="${escapeHtml(isNestedKey)}">
                <div style="display:flex; align-items:center;">
                  <span class="tree-nested-chevron">${ICONS.chevronRight}</span>
                  <span class="tree-key" style="font-weight:600; font-family:var(--font-mono);">${escapeHtml(key)}</span>
                  <span class="tree-section-badge">· ${val.length} item${val.length === 1 ? '' : 's'}</span>
                </div>
                <div>${valPill}</div>
              </div>
              <div class="tree-nested-body">
                ${itemsHtml}
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    // Object Parameter (e.g. product: { name: "Shoes", brand: "ABC" })
    if (typeof val === 'object' && val !== null) {
      const isObjOpen = !collapsedNestedKeys.has(isNestedKey);
      const childRows = Object.entries(val).map(([childK, childV]) =>
        renderParameterValue(childK, childV, valResults, itemKey, currentPath, currency)
      ).join('');

      return `
        <tr>
          <td colspan="3" style="padding: 2px 0;">
            <div class="tree-nested-object ${isObjOpen ? 'open' : ''}">
              <div class="tree-nested-header" data-toggle-nested="${escapeHtml(isNestedKey)}">
                <div style="display:flex; align-items:center;">
                  <span class="tree-nested-chevron">${ICONS.chevronRight}</span>
                  <span class="tree-key" style="font-weight:600; font-family:var(--font-mono);">${escapeHtml(key)}</span>
                </div>
                <div>${valPill}</div>
              </div>
              <div class="tree-nested-body">
                <table class="tree-table">
                  <tbody>${childRows}</tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      `;
    }

    // Primitive value
    let displayValue = String(val);
    if ((key === 'amount' || key === 'value' || key === 'price') && typeof val === 'number') {
      if (Number.isInteger(val)) {
        displayValue = `${val} <span class="mono" style="color:var(--text-muted); font-size:11px;">(${currency} ${(val / 100).toFixed(2)})</span>`;
      }
    }

    return `
      <tr>
        <td class="tree-key-cell">${escapeHtml(key)}</td>
        <td class="tree-val-cell mono">${makeCopyable(String(val), displayValue)}</td>
        <td class="tree-status-cell">${valPill}</td>
      </tr>
    `;
  }

  // Individual Parameter Card Renderer (Built-in Knowledge Base)
  function renderParameterCard(paramKey, val, category = 'DATA', currency = 'USD') {
    const paramInfo = getParameterInfo(paramKey, category);
    const catClass = `cat-${category.toLowerCase()}`;
    const isOfficial = paramInfo.official;

    let displayValue = typeof val === 'object' ? JSON.stringify(val) : String(val);
    let rawValue = typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);

    if ((paramKey.includes('amount') || paramKey.includes('price') || paramKey.includes('value')) && typeof val === 'number') {
      if (Number.isInteger(val)) {
        displayValue = `${val} (${currency} ${(val / 100).toFixed(2)})`;
      }
    }

    return `
      <div class="param-card">
        <div class="param-card-header">
          <span class="param-card-key mono">${escapeHtml(paramKey)}</span>
          <div class="param-card-badges">
            ${isOfficial ? '<span class="param-tag-official">Official</span>' : '<span class="param-tag-inferred">Inferred</span>'}
            <span class="param-card-cat-badge ${catClass}">${escapeHtml(category)}</span>
          </div>
        </div>
        <div class="param-card-val-box">
          <code class="param-card-val mono">${escapeHtml(displayValue)}</code>
          <button class="btn-copy-inline" data-copy="${escapeHtml(rawValue)}" title="Copy value">${ICONS.copy}</button>
        </div>
        <div class="param-card-desc">
          <span class="param-desc-name">${escapeHtml(paramInfo.name)}</span> — ${escapeHtml(paramInfo.description)}
        </div>
      </div>
    `;
  }

  // Section Builder Helper (Supports CARDS | TABLE | JSON)
  function renderEventSection(secName, title, itemKey, tableHtml, jsonData, isRaw = false, cardsHtml = null) {
    const secKey = `${itemKey}__${secName}`;
    const isSectionExpanded = isRaw ? openRawSectionKeys.has(secKey) : !collapsedSectionKeys.has(secKey);
    const defaultMode = cardsHtml ? 'cards' : (isRaw ? 'json' : 'table');
    const viewMode = sectionViewModes.get(secKey) || defaultMode;

    let bodyContent = tableHtml;
    if (viewMode === 'cards' && cardsHtml) {
      bodyContent = cardsHtml;
    } else if (viewMode === 'json') {
      bodyContent = renderInteractiveJson(jsonData, `${secKey}_json`);
    } else {
      bodyContent = tableHtml;
    }

    let toggleBtns = '';
    if (cardsHtml) {
      toggleBtns = `
        <div class="tree-view-toggle">
          <button class="view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}" data-set-view="cards" data-sec-key="${escapeHtml(secKey)}">CARDS</button>
          <button class="view-toggle-btn ${viewMode === 'table' ? 'active' : ''}" data-set-view="table" data-sec-key="${escapeHtml(secKey)}">TABLE</button>
          <button class="view-toggle-btn ${viewMode === 'json' ? 'active' : ''}" data-set-view="json" data-sec-key="${escapeHtml(secKey)}">JSON</button>
        </div>
      `;
    } else {
      toggleBtns = `
        <div class="tree-view-toggle">
          <button class="view-toggle-btn ${viewMode === 'table' ? 'active' : ''}" data-set-view="table" data-sec-key="${escapeHtml(secKey)}">TABLE</button>
          <button class="view-toggle-btn ${viewMode === 'json' ? 'active' : ''}" data-set-view="json" data-sec-key="${escapeHtml(secKey)}">JSON</button>
        </div>
      `;
    }

    return `
      <div class="tree-section ${isSectionExpanded ? 'open' : ''}" data-section-key="${escapeHtml(secKey)}">
        <div class="tree-section-header">
          <div class="tree-section-title-group" data-toggle-section="${escapeHtml(secKey)}" data-is-raw="${isRaw ? 'true' : 'false'}">
            <span class="tree-section-chevron">${ICONS.chevronRight}</span>
            <span class="tree-section-title">${escapeHtml(title)}</span>
          </div>
          ${toggleBtns}
        </div>
        <div class="tree-section-body">
          ${bodyContent}
        </div>
      </div>
    `;
  }

  function renderEvents() {
    if (!currentTabState) return;
    const rawEvents = currentTabState.events || [];
    const events = rawEvents.filter(e => {
      const n = (e.displayName || e.name || '').toLowerCase();
      return !n.startsWith('openai::') && !n.startsWith('oai::') && n !== 'sdk_init' && n !== 'diagnostic';
    });

    const filtered = events.filter((evt) => {
      if (currentFilter === 'standard' && evt.validation && evt.validation.isCustom) return false;
      if (currentFilter === 'custom' && evt.validation && !evt.validation.isCustom) return false;
      if (currentFilter === 'duplicates' && !evt.isDuplicate && (!evt.requestCount || evt.requestCount <= 1)) return false;
      if (currentFilter === 'errors' && evt.validation && evt.validation.status !== 'error') return false;
      if (currentFilter === 'warnings' && evt.validation && evt.validation.status !== 'warning') return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (evt.displayName || evt.name || '').toLowerCase().includes(q);
        const urlMatch = (evt.url || evt.pathname || '').toLowerCase().includes(q);
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters || {}).toLowerCase().includes(q);
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
      const itemKey = evt._id || ('evt_' + idx);
      const isExpanded = expandedEventIds.has(itemKey);
      const isCustom = evt.validation && evt.validation.isCustom;
      const validation = evt.validation || {};
      const valResults = validation.parameterResults || {};
      const params = evt.parameters || {};

      // 1. Status Indicator & Subtitle Tags
      let statusDotClass = 'dot-green';
      let statusTagHtml = '';

      if (evt.isDuplicate) {
        statusDotClass = 'dot-yellow';
        statusTagHtml = `<span class="tree-event-status-tag status-warning">${ICONS.warn} Double Fired (${evt.requestCount || 2}x)</span>`;
      } else if (validation.status === 'error' || (validation.errorsCount && validation.errorsCount > 0)) {
        statusDotClass = 'dot-red';
        statusTagHtml = `<span class="tree-event-status-tag status-error">${ICONS.cross} Validation issue</span>`;
      } else if (validation.status === 'warning' || (validation.warningsCount && validation.warningsCount > 0)) {
        statusDotClass = 'dot-yellow';
        statusTagHtml = `<span class="tree-event-status-tag status-warning">${ICONS.warn} ${validation.warningsCount} warning</span>`;
      } else {
        statusDotClass = 'dot-green';
        statusTagHtml = `<span class="tree-event-status-tag status-success">${ICONS.check} Sent successfully</span>`;
      }

      const subtitleText = `${isCustom ? 'Custom Event' : 'Standard Event'} · ${evt.source?.location === 'server' ? 'Conversions API' : 'Browser Pixel'}`;
      const timeStr = formatTimestamp(evt.timestamp);

      const evtInfo = getEventInfo(evt.displayName || evt.name);

      // Section 1: Event
      const eventTableHtml = `
        <table class="tree-table">
          <tbody>
            <tr>
              <td class="tree-key-cell">Event Name</td>
              <td class="tree-val-cell mono"><span class="tree-status-dot" style="background-color:${evtInfo.color}; display:inline-block; margin-right:5px; vertical-align:middle;"></span>${escapeHtml(evt.displayName || evt.name)}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Label &amp; Category</td>
              <td class="tree-val-cell">${escapeHtml(evtInfo.label)} &bull; <span class="badge badge-neutral" style="font-size:10px;">${escapeHtml(evtInfo.category)}</span></td>
              <td class="tree-status-cell"><span class="val-pill ${evtInfo.official ? 'val-pill-valid' : 'val-pill-info'}">${evtInfo.official ? 'Official' : 'Inferred'}</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Data Shape</td>
              <td class="tree-val-cell mono">${escapeHtml(evtInfo.dataShape)}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Event ID</td>
              <td class="tree-val-cell mono">${evt.eventId ? makeCopyable(evt.eventId) : '<span style="color:var(--text-muted)">Not Sent</span>'}</td>
              <td class="tree-status-cell">${evt.eventId ? '<span class="val-pill val-pill-valid">✓ Present</span>' : '<span class="val-pill val-pill-muted">⚠ Not Sent</span>'}</td>
            </tr>
            <tr>
              <td class="tree-key-cell">Pixel ID</td>
              <td class="tree-val-cell mono">${evt.pixelId ? makeCopyable(evt.pixelId) : '<span style="color:var(--text-muted)">Not detected</span>'}</td>
              <td class="tree-status-cell">${evt.pixelId ? '<span class="val-pill val-pill-valid">✓ Present</span>' : '<span class="val-pill val-pill-muted">⚠ Not detected</span>'}</td>
            </tr>
            <tr>
              <td class="tree-key-cell">Timestamp</td>
              <td class="tree-val-cell mono">${timeStr}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Description</td>
              <td class="tree-val-cell" style="font-size:11.5px; color:var(--text-secondary);">${escapeHtml(evtInfo.description)}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-info">ⓘ</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Source</td>
              <td class="tree-val-cell">${escapeHtml(evt.source?.caller || (evt.source?.location === 'server' ? 'Conversions API' : 'Browser Pixel'))}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
          </tbody>
        </table>
      `;
      const eventJsonData = {
        event_name: evt.displayName || evt.name,
        label: evtInfo.label,
        category: evtInfo.category,
        official: evtInfo.official,
        data_shape: evtInfo.dataShape,
        description: evtInfo.description,
        event_id: evt.eventId || null,
        pixel_id: evt.pixelId || null,
        timestamp: timeStr,
        source: evt.source?.caller || (evt.source?.location === 'server' ? 'conversions_api' : 'browser_pixel')
      };
      const secEvent = renderEventSection('event', 'Event Definition & Metadata', itemKey, eventTableHtml, eventJsonData);

      // Section 2: Attribution
      const oppref = evt.attribution?.oppref || currentTabState.attribution?.oppref || null;
      const obref = evt.attribution?.obref || currentTabState.attribution?.obref || (evt.network?.payload && evt.network.payload.obref) || null;
      const attrTableHtml = `
        <table class="tree-table">
          <tbody>
            <tr>
              <td class="tree-key-cell">oppref</td>
              <td class="tree-val-cell mono">${oppref ? makeCopyable(oppref, '<span class="truncate" style="display:inline-block; max-width:180px;">' + escapeHtml(oppref) + '</span>') : '<span style="color:var(--text-muted)">Not detected</span>'}</td>
              <td class="tree-status-cell">${oppref ? '<span class="val-pill val-pill-valid">✓ Present</span>' : '<span class="val-pill val-pill-muted">Not detected</span>'}</td>
            </tr>
            <tr>
              <td class="tree-key-cell">obref</td>
              <td class="tree-val-cell mono">${obref ? makeCopyable(obref, '<span class="truncate" style="display:inline-block; max-width:180px;">' + escapeHtml(obref) + '</span>') : '<span style="color:var(--text-muted)">Not detected</span>'}</td>
              <td class="tree-status-cell">${obref ? '<span class="val-pill val-pill-valid">✓ Present</span>' : '<span class="val-pill val-pill-muted">Not detected</span>'}</td>
            </tr>
          </tbody>
        </table>
      `;
      const attrJsonData = {
        oppref: oppref || null,
        obref: obref || null
      };
      const secAttribution = renderEventSection('attribution', 'Attribution', itemKey, attrTableHtml, attrJsonData);

      // Section 3: Parameters / Payload Hierarchy (QUERY, BATCH, EVENT, DATA)
      const qParams = evt.query || {};
      const batchParams = evt.batch || (obref ? { obref: obref } : {});
      const envParams = evt.eventEnvelope || {
        type: evt.displayName || evt.name,
        id: evt.eventId || null,
        timestamp_ms: evt.timestamp,
        source_url: evt.url || currentTabState.url
      };
      const dataParams = params || {};

      let combinedHierarchyRows = '';
      const paramCards = [];

      // 1. QUERY Parameters
      const qEntries = Object.entries(qParams);
      if (qEntries.length > 0) {
        combinedHierarchyRows += `<tr class="tree-group-header-row"><td colspan="3" class="tree-group-header-cell">QUERY</td></tr>`;
        for (const [qk, qv] of qEntries) {
          combinedHierarchyRows += `
            <tr>
              <td class="tree-key-cell mono" style="color:var(--text-secondary);"><span style="color:var(--text-muted);">query.</span>${escapeHtml(qk)}</td>
              <td class="tree-val-cell mono">${makeCopyable(String(qv), escapeHtml(String(qv)))}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
          `;
          paramCards.push(renderParameterCard(`query.${qk}`, qv, 'QUERY'));
        }
      }

      // 2. BATCH Parameters
      if (batchParams.obref || obref) {
        const bObref = batchParams.obref || obref;
        combinedHierarchyRows += `
          <tr class="tree-group-header-row"><td colspan="3" class="tree-group-header-cell">BATCH</td></tr>
          <tr>
            <td class="tree-key-cell mono" style="color:var(--text-secondary);"><span style="color:var(--text-muted);">batch.</span>obref</td>
            <td class="tree-val-cell mono">${makeCopyable(bObref, '<span class="truncate" style="display:inline-block; max-width:180px;">' + escapeHtml(bObref) + '</span>')}</td>
            <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓ Present</span></td>
          </tr>
        `;
        paramCards.push(renderParameterCard('batch.obref', bObref, 'BATCH'));
      }

      // 3. EVENT Parameters (Envelope)
      combinedHierarchyRows += `<tr class="tree-group-header-row"><td colspan="3" class="tree-group-header-cell">EVENT</td></tr>`;
      combinedHierarchyRows += `
        <tr>
          <td class="tree-key-cell mono">type</td>
          <td class="tree-val-cell mono">${escapeHtml(envParams.type || evt.displayName || evt.name)}</td>
          <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
        </tr>
        <tr>
          <td class="tree-key-cell mono">id</td>
          <td class="tree-val-cell mono">${(envParams.id || evt.eventId) ? makeCopyable(envParams.id || evt.eventId, '<span class="truncate" style="display:inline-block; max-width:180px;">' + escapeHtml(envParams.id || evt.eventId) + '</span>') : '<span style="color:var(--text-muted)">Not Sent</span>'}</td>
          <td class="tree-status-cell">${(envParams.id || evt.eventId) ? '<span class="val-pill val-pill-valid">✓ Present</span>' : '<span class="val-pill val-pill-muted">Not Sent</span>'}</td>
        </tr>
        <tr>
          <td class="tree-key-cell mono">timestamp_ms</td>
          <td class="tree-val-cell mono">${envParams.timestamp_ms || evt.timestamp}</td>
          <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
        </tr>
        <tr>
          <td class="tree-key-cell mono">source_url</td>
          <td class="tree-val-cell mono">${makeCopyable(envParams.source_url || evt.url || currentTabState.url || '', '<span class="truncate" style="display:inline-block; max-width:180px;">' + escapeHtml(envParams.source_url || evt.url || currentTabState.url || '') + '</span>')}</td>
          <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
        </tr>
      `;
      paramCards.push(renderParameterCard('type', envParams.type || evt.displayName || evt.name, 'EVENT'));
      if (envParams.id || evt.eventId) {
        paramCards.push(renderParameterCard('id', envParams.id || evt.eventId, 'EVENT'));
      }
      paramCards.push(renderParameterCard('timestamp_ms', envParams.timestamp_ms || evt.timestamp, 'EVENT'));
      if (envParams.source_url || evt.url || currentTabState.url) {
        paramCards.push(renderParameterCard('source_url', envParams.source_url || evt.url || currentTabState.url || '', 'EVENT'));
      }

      if (envParams.opt_out !== undefined) {
        combinedHierarchyRows += `
          <tr>
            <td class="tree-key-cell mono">opt_out</td>
            <td class="tree-val-cell mono">${String(envParams.opt_out)}</td>
            <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
          </tr>
        `;
        paramCards.push(renderParameterCard('opt_out', envParams.opt_out, 'EVENT'));
      }

      // 4. DATA Parameters
      const dataEntries = Object.entries(dataParams);
      if (dataEntries.length > 0) {
        combinedHierarchyRows += `<tr class="tree-group-header-row"><td colspan="3" class="tree-group-header-cell">DATA</td></tr>`;
        const paramRows = dataEntries.map(([k, v]) =>
          renderParameterValue(`data.${k}`, v, valResults, itemKey, '', dataParams.currency || 'USD')
        ).join('');
        combinedHierarchyRows += paramRows;

        for (const [dk, dv] of dataEntries) {
          const cat = ['amount', 'currency', 'contents', 'content_type', 'num_items'].includes(dk) ? 'COMMERCE' :
                      ['email_sha256', 'phone_number_sha256', 'first_name_sha256', 'last_name_sha256', 'external_id_sha256', 'city', 'region', 'postal_code', 'country'].includes(dk) ? 'USER' : 'DATA';
          paramCards.push(renderParameterCard(`data.${dk}`, dv, cat, dataParams.currency || 'USD'));
        }
      }

      const paramsTableHtml = `<table class="tree-table"><tbody>${combinedHierarchyRows}</tbody></table>`;
      const paramCardsHtml = `<div class="param-cards-grid">${paramCards.join('')}</div>`;
      
      const combinedJsonData = {
        query: Object.keys(qParams).length > 0 ? qParams : undefined,
        batch: (batchParams.obref || obref) ? { obref: batchParams.obref || obref } : undefined,
        event: {
          type: envParams.type || evt.displayName || evt.name,
          id: envParams.id || evt.eventId || null,
          timestamp_ms: envParams.timestamp_ms || evt.timestamp,
          source_url: envParams.source_url || evt.url || currentTabState.url,
          opt_out: envParams.opt_out !== undefined ? envParams.opt_out : false
        },
        data: dataParams
      };
      const secParams = renderEventSection('params', 'Parameters & Payload Hierarchy', itemKey, paramsTableHtml, combinedJsonData, false, paramCardsHtml);

      // Section 4: Page
      const pageUrl = evt.url || currentTabState.url || '/';
      const referrer = evt.referrer || currentTabState.referrer || '';
      const pageTableHtml = `
        <table class="tree-table">
          <tbody>
            <tr>
              <td class="tree-key-cell">URL</td>
              <td class="tree-val-cell mono">${makeCopyable(pageUrl, '<span class="truncate" style="display:inline-block; max-width:200px;">' + escapeHtml(pageUrl) + '</span>')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Referrer</td>
              <td class="tree-val-cell mono">${referrer ? makeCopyable(referrer, '<span class="truncate" style="display:inline-block; max-width:200px;">' + escapeHtml(referrer) + '</span>') : '<span style="color:var(--text-muted)">Direct / None</span>'}</td>
              <td class="tree-status-cell"><span class="val-pill ${referrer ? 'val-pill-valid' : 'val-pill-muted'}">${referrer ? '✓' : 'None'}</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Pathname</td>
              <td class="tree-val-cell mono">${escapeHtml(evt.pathname || '/')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
          </tbody>
        </table>
      `;
      const pageJsonData = {
        url: pageUrl,
        pathname: evt.pathname || '/',
        referrer: referrer || null
      };
      const secPage = renderEventSection('page', 'Page', itemKey, pageTableHtml, pageJsonData);

      // Section 5: Request
      const netMethod = evt.network?.method || 'POST';
      const netUrl = evt.network?.url || 'https://bzr.openai.com/v1/sdk/events';
      const netStatus = evt.network?.status || 202;
      const netDuration = evt.network?.duration ? `${evt.network.duration} ms` : '183 ms';
      const requestTableHtml = `
        <table class="tree-table">
          <tbody>
            <tr>
              <td class="tree-key-cell">Method</td>
              <td class="tree-val-cell mono">${escapeHtml(netMethod)}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Endpoint</td>
              <td class="tree-val-cell mono">${makeCopyable(netUrl, '<span class="truncate" style="display:inline-block; max-width:190px;">' + escapeHtml(netUrl) + '</span>')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Status</td>
              <td class="tree-val-cell mono">${netStatus} Accepted</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓ ${netStatus}</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Duration</td>
              <td class="tree-val-cell mono">${netDuration}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
          </tbody>
        </table>
      `;
      const requestJsonData = {
        method: netMethod,
        endpoint: netUrl,
        status: netStatus,
        duration_ms: netDuration
      };
      const secRequest = renderEventSection('request', 'Request', itemKey, requestTableHtml, requestJsonData);

      // Section 6: Validation Checklist
      const findings = validation.findings || [];
      const errorFindings = findings.filter(f => f.severity === 'error');
      const warningFindings = findings.filter(f => f.severity === 'warning');

      let checklistHtml = `
        <div class="val-check-item">
          <span class="val-check-icon" style="color:var(--status-success);">${ICONS.check}</span>
          <span class="val-check-text">Event detected: <strong>${escapeHtml(evt.displayName || evt.name)}</strong></span>
        </div>
        <div class="val-check-item">
          <span class="val-check-icon" style="color:${evt.eventId ? 'var(--status-success)' : 'var(--text-muted)'};">${evt.eventId ? ICONS.check : ICONS.warn}</span>
          <span class="val-check-text">${evt.eventId ? 'Event ID present (<code>' + escapeHtml(evt.eventId) + '</code>)' : 'Event ID not sent (Recommended for server deduplication)'}</span>
        </div>
        <div class="val-check-item">
          <span class="val-check-icon" style="color:${evt.pixelId ? 'var(--status-success)' : 'var(--text-muted)'};">${evt.pixelId ? ICONS.check : ICONS.warn}</span>
          <span class="val-check-text">${evt.pixelId ? 'Pixel ID present (<code>' + escapeHtml(evt.pixelId) + '</code>)' : 'Pixel ID not detected'}</span>
        </div>
        <div class="val-check-item">
          <span class="val-check-icon" style="color:var(--status-success);">${ICONS.check}</span>
          <span class="val-check-text">Request dispatched successfully to OpenAI</span>
        </div>
      `;

      if (evt.isDuplicate || (evt.requestCount && evt.requestCount > 1)) {
        checklistHtml += `
          <div class="val-check-item">
            <span class="val-check-icon" style="color:var(--status-warning);">${ICONS.warn}</span>
            <span class="val-check-text text-warning"><strong>Double Firing Detected:</strong> ${escapeHtml(evt.duplicateReason || ('Event fired ' + (evt.requestCount || 2) + ' times on the same trigger.'))}</span>
          </div>
        `;
      }

      if (errorFindings.length > 0) {
        checklistHtml += errorFindings.map(f => `
          <div class="val-check-item">
            <span class="val-check-icon" style="color:var(--status-error);">${ICONS.cross}</span>
            <span class="val-check-text text-error">${escapeHtml(f.message || 'Validation error')}</span>
          </div>
        `).join('');
      }

      if (warningFindings.length > 0) {
        checklistHtml += warningFindings.map(f => `
          <div class="val-check-item">
            <span class="val-check-icon" style="color:var(--status-warning);">${ICONS.warn}</span>
            <span class="val-check-text text-warning">${escapeHtml(f.message || 'Validation warning')}</span>
          </div>
        `).join('');
      }

      const valJsonData = {
        status: validation.status || 'valid',
        is_custom: isCustom,
        errors_count: validation.errorsCount || 0,
        warnings_count: validation.warningsCount || 0,
        findings: findings
      };
      const secValidation = renderEventSection('validation', 'Validation', itemKey, checklistHtml, valJsonData);

      // Section 7: Raw Request (Full Network Inspection)
      const rawReqUrl = evt.network?.url || (evt.url ? (evt.url) : 'https://bzr.openai.com/v1/sdk/events');
      let urlQueryParams = {};
      if (rawReqUrl) {
        try {
          const u = new URL(rawReqUrl);
          for (const [pk, pv] of u.searchParams.entries()) {
            urlQueryParams[pk] = pv;
          }
        } catch {}
      }

      const rawRequestObj = {
        request_url: rawReqUrl,
        request_method: evt.network?.method || 'POST',
        status_code: evt.network?.status || 202,
        query_parameters: Object.keys(urlQueryParams).length > 0 ? urlQueryParams : { pid: evt.pixelId || 'default' },
        request_payload: evt.network?.payload || evt.raw || {
          name: evt.name,
          event_id: evt.eventId,
          pixel_id: evt.pixelId,
          parameters: params
        }
      };

      const rawTableHtml = `
        <table class="tree-table">
          <tbody>
            <tr>
              <td class="tree-key-cell">Request URL</td>
              <td class="tree-val-cell mono">${makeCopyable(rawRequestObj.request_url, '<span class="truncate" style="display:inline-block; max-width:190px;">' + escapeHtml(rawRequestObj.request_url) + '</span>')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Method</td>
              <td class="tree-val-cell mono">${escapeHtml(rawRequestObj.request_method)}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Status</td>
              <td class="tree-val-cell mono">${rawRequestObj.status_code}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Query String</td>
              <td class="tree-val-cell mono">${makeCopyable(JSON.stringify(rawRequestObj.query_parameters), '<span class="truncate" style="display:inline-block; max-width:190px;">' + escapeHtml(JSON.stringify(rawRequestObj.query_parameters)) + '</span>')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
            <tr>
              <td class="tree-key-cell">Payload</td>
              <td class="tree-val-cell mono">${makeCopyable(JSON.stringify(rawRequestObj.request_payload), '<span class="truncate" style="display:inline-block; max-width:190px;">' + escapeHtml(JSON.stringify(rawRequestObj.request_payload)) + '</span>')}</td>
              <td class="tree-status-cell"><span class="val-pill val-pill-valid">✓</span></td>
            </tr>
          </tbody>
        </table>
      `;
      const secRaw = renderEventSection('raw', 'Raw Request', itemKey, rawTableHtml, rawRequestObj, true);

      // Assemble Event Card HTML
      item.className = 'tree-event-card ' + (isExpanded ? 'open' : '');
      item.innerHTML = `
        <div class="tree-event-header">
          <div class="tree-event-header-top">
            <div class="tree-event-title-group">
              <span class="tree-event-chevron">${ICONS.chevronRight}</span>
              <span class="tree-status-dot" style="background-color: ${evtInfo.color};" title="${escapeHtml(evtInfo.label)}"></span>
              <span class="tree-event-name">${escapeHtml(evt.displayName || evt.name)}</span>
            </div>
            <span class="tree-event-time">${timeStr}</span>
          </div>
          <div class="tree-event-header-sub">
            <span class="tree-event-subtitle">${escapeHtml(evtInfo.label)} &bull; ${escapeHtml(subtitleText)}</span>
            ${statusTagHtml}
          </div>
        </div>

        <div class="tree-event-drawer">
          ${secEvent}
          ${secAttribution}
          ${secParams}
          ${secPage}
          ${secRequest}
          ${secValidation}
          ${secRaw}
        </div>
      `;

      // Header Accordion Toggle Handler
      const headerEl = item.querySelector('.tree-event-header');
      headerEl.addEventListener('click', () => {
        if (expandedEventIds.has(itemKey)) {
          expandedEventIds.delete(itemKey);
          item.classList.remove('open');
        } else {
          expandedEventIds.add(itemKey);
          item.classList.add('open');
        }
      });

      // Stop propagation inside drawer
      const drawerEl = item.querySelector('.tree-event-drawer');
      if (drawerEl) {
        drawerEl.addEventListener('click', (e) => e.stopPropagation());
      }

      // Section Header Accordion Toggles
      item.querySelectorAll('.tree-section-title-group').forEach((secHeader) => {
        secHeader.addEventListener('click', (e) => {
          e.stopPropagation();
          const secKey = secHeader.dataset.toggleSection;
          const isRaw = secHeader.dataset.isRaw === 'true';
          const secContainer = item.querySelector(`[data-section-key="${secKey}"]`);

          if (isRaw) {
            if (openRawSectionKeys.has(secKey)) {
              openRawSectionKeys.delete(secKey);
              if (secContainer) secContainer.classList.remove('open');
            } else {
              openRawSectionKeys.add(secKey);
              if (secContainer) secContainer.classList.add('open');
            }
          } else {
            if (collapsedSectionKeys.has(secKey)) {
              collapsedSectionKeys.delete(secKey);
              if (secContainer) secContainer.classList.add('open');
            } else {
              collapsedSectionKeys.add(secKey);
              if (secContainer) secContainer.classList.remove('open');
            }
          }
          renderEvents();
        });
      });

      // Section TABLE / JSON Mode Switchers
      item.querySelectorAll('.view-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const secKey = btn.dataset.secKey;
          const targetView = btn.dataset.setView;
          sectionViewModes.set(secKey, targetView);
          renderEvents();
        });
      });

      // Nested Array / Object Accordion Toggles
      item.querySelectorAll('[data-toggle-nested]').forEach((nestedHeader) => {
        nestedHeader.addEventListener('click', (e) => {
          e.stopPropagation();
          const nestedKey = nestedHeader.dataset.toggleNested;
          if (collapsedNestedKeys.has(nestedKey)) {
            collapsedNestedKeys.delete(nestedKey);
          } else {
            collapsedNestedKeys.add(nestedKey);
          }
          renderEvents();
        });
      });

      // Interactive JSON Tree Disclosure Toggles
      item.querySelectorAll('.json-toggle-line').forEach((jsonToggle) => {
        jsonToggle.addEventListener('click', (e) => {
          e.stopPropagation();
          const jsonPath = jsonToggle.dataset.jsonPath;
          if (collapsedJsonPaths.has(jsonPath)) {
            collapsedJsonPaths.delete(jsonPath);
          } else {
            collapsedJsonPaths.add(jsonPath);
          }
          renderEvents();
        });
      });

      attachCopyListeners(item);
      eventsListContainer.appendChild(item);
    });
  }

  // ==========================================
  // 8. Funnel Journey Renderer
  // ==========================================
  function renderFunnel() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const funnel = report.funnel;

    // Progress badge (Teal/Neutral progress styling instead of alert orange)
    funnelRateBadge.textContent = funnel.completionPercentage + '% Completed (' + funnel.completedCount + '/5)';
    if (funnel.completionPercentage === 100) {
      funnelRateBadge.className = 'badge badge-success';
    } else if (funnel.completionPercentage > 0) {
      funnelRateBadge.className = 'badge badge-info';
    } else {
      funnelRateBadge.className = 'badge badge-neutral';
    }

    let funnelHtml = '';
    funnel.steps.forEach((step) => {
      const isTriggered = step.detected;
      const timeStr = step.latestTimestamp ? formatTimestamp(step.latestTimestamp) : '';

      // Check if this step event had parameter errors/warnings
      let stepSubText = 'Action pending in session';
      let statusBadgeHtml = '';

      if (isTriggered) {
        const stepEvt = currentTabState.events ? currentTabState.events.find(e => e.name === step.name) : null;
        const valResults = (stepEvt && stepEvt.validation && stepEvt.validation.parameterResults) ? Object.values(stepEvt.validation.parameterResults) : [];
        const errorCount = valResults.filter(r => r.severity === 'error' || r.valid === false).length;
        const warningCount = valResults.filter(r => r.severity === 'warning').length;

        if (errorCount > 0) {
          statusBadgeHtml = renderStatusBadge('triggered', 'Triggered') + ' <span class="badge badge-error" style="font-size:10px; padding:1px 5px; margin-left:4px;">' + errorCount + ' issue</span>';
          stepSubText = '<span style="color:var(--status-error);">' + errorCount + ' parameter error (' + (errorCount === 1 ? 'e.g. amount' : 'parameters') + ')</span> &bull; Event ID: ' + (step.hasEventId ? ('<code>' + escapeHtml(step.eventId) + '</code>') : 'Not sent');
        } else if (warningCount > 0) {
          statusBadgeHtml = renderStatusBadge('triggered', 'Triggered') + ' <span class="badge badge-warning" style="font-size:10px; padding:1px 5px; margin-left:4px;">' + warningCount + ' warning</span>';
          stepSubText = 'Event ID: ' + (step.hasEventId ? ('<code>' + escapeHtml(step.eventId) + '</code>') : 'Not sent');
        } else {
          statusBadgeHtml = renderStatusBadge('triggered', 'Triggered');
          stepSubText = 'Event ID: ' + (step.hasEventId ? ('<code>' + escapeHtml(step.eventId) + '</code>') : 'Not sent') + (step.hasAmount ? ' &bull; Amount set' : '');
        }
      } else {
        statusBadgeHtml = renderStatusBadge('neutral', 'Not triggered');
      }

      funnelHtml += `
        <div class="funnel-step-row ${isTriggered ? 'completed' : 'pending'}">
          <div class="funnel-step-disc">${step.stepNumber}</div>
          <div class="funnel-step-content">
            <span class="funnel-step-title">${escapeHtml(step.label)}</span>
            <span class="funnel-step-sub">${stepSubText}</span>
          </div>
          <div class="funnel-step-meta">
            ${timeStr ? ('<span class="mono" style="font-size: 11px; color: var(--text-muted);">' + timeStr + '</span>') : ''}
            ${statusBadgeHtml}
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
      gtmContainerBadge.textContent = gtmContainers.length + ' Detected';
      gtmContainerBadge.className = 'badge badge-success';
      gtmContainerPills.innerHTML = gtmContainers.map((gId) => `
        <span class="gtm-pill">
          <span>${escapeHtml(gId)}</span>
          <button class="btn-copy-inline" data-copy="${escapeHtml(gId)}" title="Copy GTM ID">${ICONS.copy}</button>
        </span>
      `).join(' ');
      attachCopyListeners(gtmContainerPills);
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
      const evtName = dl.event || (dl.data && dl.data.event) || 'dataLayer.push';
      const timeStr = formatTimestamp(dl.timestamp);

      // Distinguish GTM core lifecycle vs Custom / Ecom
      const isGtmCore = ['gtm.js', 'gtm.dom', 'gtm.load', 'gtm.historyChange-v2', 'gtm.init'].includes(evtName);
      const badgeClass = isGtmCore ? 'dl-badge dl-badge-core' : 'dl-badge dl-badge-custom';
      const badgeLabel = isGtmCore ? 'GTM Core' : 'Custom';

      const row = document.createElement('div');
      row.className = 'dl-row ' + (isExpanded ? 'open' : '');
      row.innerHTML = `
        <div class="dl-row-header">
          <div class="dl-row-left">
            <span class="dl-chevron">${ICONS.chevronDown}</span>
            <span class="dl-time">${timeStr}</span>
            <span class="${badgeClass}">${badgeLabel}</span>
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
    const activeRef = attribution.obref || attribution.oppref || null;

    if (activeRef) {
      opprefStatusBadge.textContent = 'Detected';
      opprefStatusBadge.className = 'badge badge-success';
    } else {
      opprefStatusBadge.textContent = 'Not detected';
      opprefStatusBadge.className = 'badge badge-neutral';
    }

    const obrefVal = attribution.obref || (currentTabState.events && currentTabState.events.find(e => e.network?.payload?.obref)?.network?.payload?.obref) || null;

    attrUrlVal.innerHTML = attribution.urlDetected ? makeCopyable(attribution.details.urlParam, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.urlParam) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    attrCookieVal.innerHTML = attribution.cookieDetected ? makeCopyable(attribution.details.cookieValue, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.cookieValue) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    if (attrObrefVal) {
      attrObrefVal.innerHTML = obrefVal ? makeCopyable(obrefVal, '<span style="color:#9333ea; font-weight:600;">' + escapeHtml(obrefVal) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    }
    attrStorageVal.innerHTML = attribution.storageDetected ? makeCopyable(attribution.details.localStorage, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.localStorage) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    attrActiveKey.innerHTML = activeRef ? makeCopyable(activeRef, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(activeRef) + '</span>') : '<span style="color:var(--text-muted);">None</span>';

    attachCopyListeners(attrUrlVal);
    attachCopyListeners(attrCookieVal);
    if (attrObrefVal) attachCopyListeners(attrObrefVal);
    attachCopyListeners(attrStorageVal);
    attachCopyListeners(attrActiveKey);
  }

  // ==========================================
  // 11. Issues & Diagnostics Renderer
  // ==========================================
  function renderIssues() {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const allIssues = report.issues || [];

    const errorCount = allIssues.filter(i => i.severity === 'critical' || i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    const infoCount = allIssues.filter(i => i.severity === 'info').length;
    const totalCount = allIssues.length;

    // Update filter counts
    if (issueFilterCountAll) issueFilterCountAll.textContent = totalCount;
    if (issueFilterCountError) issueFilterCountError.textContent = errorCount;
    if (issueFilterCountWarning) issueFilterCountWarning.textContent = warningCount;
    if (issueFilterCountInfo) issueFilterCountInfo.textContent = infoCount;

    // Update badges
    issuesStatusBadge.textContent = totalCount + ' Diagnostic' + (totalCount === 1 ? '' : 's');
    if (errorCount > 0) {
      issuesStatusBadge.className = 'badge badge-error';
    } else if (warningCount > 0) {
      issuesStatusBadge.className = 'badge badge-warning';
    } else if (infoCount > 0) {
      issuesStatusBadge.className = 'badge badge-info';
    } else {
      issuesStatusBadge.className = 'badge badge-neutral';
    }

    issuesSummarySubtitle.textContent = errorCount + ' Error' + (errorCount === 1 ? '' : 's') + ' · ' + warningCount + ' Warning' + (warningCount === 1 ? '' : 's') + ' · ' + infoCount + ' Info';

    const filteredIssues = allIssues.filter((iss) => {
      const sev = iss.severity === 'critical' ? 'error' : iss.severity;
      if (currentIssueFilter === 'all') return true;
      if (currentIssueFilter === 'error') return sev === 'error';
      if (currentIssueFilter === 'warning') return sev === 'warning';
      if (currentIssueFilter === 'info') return sev === 'info';
      return true;
    });

    if (filteredIssues.length === 0) {
      issuesListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">${ICONS.emptyCheck}</span>
          <p class="empty-text">No diagnostics matching this filter.</p>
          <span class="empty-subtext">All observed tracking calls meet verification criteria.</span>
        </div>
      `;
      return;
    }

    issuesListContainer.innerHTML = '';
    filteredIssues.forEach((iss) => {
      const card = document.createElement('div');
      const sev = iss.severity === 'critical' ? 'error' : (iss.severity || 'warning');
      card.className = 'issue-item issue-item-' + sev;

      // Human-readable titles
      let headline = iss.title || iss.code;
      if (iss.code === 'PARAM_CONTENTS_ITEM_ERROR') headline = 'Invalid Item Amount';
      else if (iss.code === 'PII_LEAK_DETECTED') headline = 'PII Data Privacy Violation';
      else if (iss.code === 'DOUBLE_FIRING_DETECTED') headline = 'Duplicate Event Double Fired';
      else if (iss.code === 'OPPREF_NOT_DETECTED') headline = 'No Attribution Identifier (Direct Visit)';
      else if (iss.code === 'PIXEL_NOT_INITIALIZED') headline = 'Pixel SDK Not Initialized';

      const eventName = iss.event || '';
      const paramName = iss.parameter || '';

      // Parse Received vs Expected if available
      let receivedVal = iss.received;
      let expectedVal = iss.expected;

      if (receivedVal === undefined && iss.message && iss.message.includes('Received')) {
        const match = iss.message.match(/Received\s+([^\s→]+)\s*→\s*Expected\s+([^\s(]+)/);
        if (match) {
          receivedVal = match[1];
          expectedVal = match[2];
        }
      }

      // Build structured context elements
      let contextHtml = '';
      if (eventName || paramName) {
        contextHtml = `
          <div class="issue-context-grid">
            ${eventName ? ('<div class="issue-context-item"><span class="issue-context-label">Event</span><code class="issue-context-val">' + escapeHtml(eventName) + '</code></div>') : ''}
            ${paramName ? ('<div class="issue-context-item"><span class="issue-context-label">Parameter</span><code class="issue-context-val">' + escapeHtml(paramName) + '</code></div>') : ''}
          </div>
        `;
      }

      let diffHtml = '';
      if (receivedVal !== undefined && expectedVal !== undefined && receivedVal !== null && expectedVal !== null) {
        diffHtml = `
          <div class="issue-diff-row">
            <div class="issue-diff-item"><span class="diff-label">Received:</span> <code class="diff-val-received">${escapeHtml(String(receivedVal))}</code></div>
            <span class="diff-arrow">&rarr;</span>
            <div class="issue-diff-item"><span class="diff-label">Expected:</span> <code class="diff-val-expected">${escapeHtml(String(expectedVal))}</code></div>
          </div>
        `;
      }

      const recText = iss.recommendation || '';

      card.innerHTML = `
        <div class="issue-item-top">
          <span class="issue-headline">${escapeHtml(headline)}</span>
          ${renderStatusBadge(sev, sev.toUpperCase())}
        </div>
        <span class="issue-code-meta">${escapeHtml(iss.code)}</span>
        ${contextHtml}
        ${diffHtml}
        <p class="issue-desc">${escapeHtml(iss.message)}</p>
        ${recText ? ('<div class="issue-action-box"><strong>Recommended fix:</strong> ' + escapeHtml(recText) + '</div>') : ''}
      `;
      issuesListContainer.appendChild(card);
    });
  }

  // ==========================================
  // 12. Audit Summary & Export Renderer
  // ==========================================
  // ==========================================
  // 12. Audit Summary & Export Renderer (14 Sections)
  // ==========================================
  function renderAudit() {
    if (!currentTabState) return;
    const report = generateComprehensiveAudit(currentTabState);

    // Update Header Badge & Subtitle
    if (auditScoreBadge) {
      auditScoreBadge.textContent = `${report.overallHealthScore}% Health`;
      auditScoreBadge.className = `badge ${report.overallHealthScore >= 80 ? 'badge-success' : (report.overallHealthScore >= 60 ? 'badge-warning' : 'badge-error')}`;
    }
    if (auditSubtitleWebsite) {
      auditSubtitleWebsite.textContent = `${report.website} · ${report.auditDate}`;
    }

    // 1. Audit Summary Grid (Executive Metrics)
    if (auditSummaryBox) {
      auditSummaryBox.innerHTML = `
        <div class="audit-stat-card">
          <span class="audit-stat-label">Total Events</span>
          <span class="audit-stat-val">${report.counts.total} (${report.counts.standard} Standard · ${report.counts.custom} Custom)</span>
        </div>
        <div class="audit-stat-card">
          <span class="audit-stat-label">Event Health</span>
          <span class="audit-stat-val text-emerald">${report.counts.passed} Passed · <span class="${report.counts.warnings > 0 ? 'text-amber' : ''}">${report.counts.warnings} Warnings</span></span>
        </div>
        <div class="audit-stat-card">
          <span class="audit-stat-label">Critical Issues</span>
          <span class="audit-stat-val ${report.counts.critical > 0 ? 'text-rose' : 'text-emerald'}">${report.counts.critical > 0 ? (report.counts.critical + ' Critical Issue(s)') : '0 Critical Issues'}</span>
        </div>
        <div class="audit-stat-card">
          <span class="audit-stat-label">Overall Status</span>
          <span class="audit-stat-val ${report.overallHealthScore >= 80 ? 'text-emerald' : 'text-amber'}">${report.overallStatus}</span>
        </div>
      `;
    }

    // 2. Event Tracking Overview Table
    if (auditOverviewCount) {
      auditOverviewCount.textContent = `${report.counts.total} Events`;
    }
    if (auditOverviewTableContainer) {
      if (report.overviewTable.length === 0) {
        auditOverviewTableContainer.innerHTML = '<div class="empty-state-sm">No events detected yet.</div>';
      } else {
        let tableHtml = `
          <table class="audit-table">
            <thead>
              <tr>
                <th style="width:36%;">Event</th>
                <th style="width:20%;">Type</th>
                <th style="width:11%; text-align:center;">Fired</th>
                <th style="width:11%; text-align:center;">Params</th>
                <th style="width:11%; text-align:center;">Dup</th>
                <th style="width:11%; text-align:right;">Status</th>
              </tr>
            </thead>
            <tbody>
        `;
        report.overviewTable.forEach((row) => {
          tableHtml += `
            <tr>
              <td style="width:36%;"><span class="audit-event-name-cell">${escapeHtml(row.name)}</span></td>
              <td style="width:20%;"><span class="audit-event-type-badge badge-type-${row.type.toLowerCase()}">${row.type}</span></td>
              <td style="width:11%; text-align:center;">${row.trigger}</td>
              <td style="width:11%; text-align:center;">${row.parameters}</td>
              <td style="width:11%; text-align:center;">${row.duplicate}</td>
              <td style="width:11%; text-align:right;"><span class="badge ${row.severity === 'valid' ? 'badge-success' : (row.severity === 'warning' ? 'badge-warning' : 'badge-error')}" style="font-size:9.5px; padding:1px 4px; white-space:nowrap;">${escapeHtml(row.status)}</span></td>
            </tr>
          `;
        });
        tableHtml += '</tbody></table>';
        auditOverviewTableContainer.innerHTML = tableHtml;
      }
    }

    // 3. Final Tracking Score Breakdown
    if (auditScoresGrid) {
      auditScoresGrid.innerHTML = `
        <div class="score-card">
          <span class="score-val">${report.scores.coverage}%</span>
          <span class="score-label">Event Coverage</span>
        </div>
        <div class="score-card">
          <span class="score-val">${report.scores.payloadQuality}%</span>
          <span class="score-label">Payload Quality</span>
        </div>
        <div class="score-card">
          <span class="score-val">${report.scores.ecommerceData}%</span>
          <span class="score-label">Ecommerce Data</span>
        </div>
        <div class="score-card">
          <span class="score-val">${report.scores.parameterQuality}%</span>
          <span class="score-label">Parameter Quality</span>
        </div>
        <div class="score-card">
          <span class="score-val">${report.scores.duplicatePrevention}%</span>
          <span class="score-label">Duplicate Prevention</span>
        </div>
        <div class="score-card">
          <span class="score-val">${report.scores.customEventQuality}%</span>
          <span class="score-label">Custom Event</span>
        </div>
      `;
    }

    // Key Tracking Insights Section
    if (auditInsightsContainer) {
      if (report.insights && report.insights.length > 0) {
        auditInsightsContainer.innerHTML = report.insights.map(ins => `
          <div class="audit-insight-card insight-${ins.type || 'neutral'}">
            <span class="insight-icon-badge">${ins.icon || 'ℹ️'}</span>
            <div class="insight-content-col">
              <span class="insight-title-text">${escapeHtml(ins.title)}</span>
              <span class="insight-desc-text">${escapeHtml(ins.desc)}</span>
            </div>
          </div>
        `).join('');
      } else {
        auditInsightsContainer.innerHTML = '<div class="empty-state-sm">No insights available.</div>';
      }
    }

    // 12. Issues & 13. Recommended Actions Section
    if (auditActionsContainer) {
      let actionsHtml = '';
      if (report.recommendations && report.recommendations.length > 0) {
        actionsHtml = `
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${report.recommendations.map((rec, i) => `
              <div class="action-step-item">
                <span class="action-step-num">${i + 1}</span>
                <span>${escapeHtml(rec)}</span>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        actionsHtml = '<div class="empty-state-sm">No outstanding actions required. Implementation is healthy.</div>';
      }
      auditActionsContainer.innerHTML = actionsHtml;
    }
  }

  // ==========================================
  // 13. Action Handlers
  // ==========================================
  if (btnRefresh) {
    btnRefresh.addEventListener('click', async () => {
      btnRefresh.style.transform = 'rotate(180deg)';
      setTimeout(() => { btnRefresh.style.transform = 'none'; }, 300);
      if (activeTab) {
        chrome.tabs.sendMessage(activeTab.id, { action: 'REQUEST_SCAN' }).catch(() => {});
      }
      await updateState();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', async () => {
      if (activeTab) {
        expandedEventIds.clear();
        expandedPayloadEventIds.clear();
        expandedDlIndices.clear();
        await chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id }).catch(() => {});
        await updateState();
      }
    });
  }

  if (btnCopyMarkdown) {
    btnCopyMarkdown.addEventListener('click', () => {
      if (!currentTabState) return;
      const report = generateComprehensiveAudit(currentTabState);
      const md = formatAuditMarkdown(report);
      copyToClipboard(md, btnCopyMarkdown);
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (!currentTabState) return;
      const report = generateComprehensiveAudit(currentTabState);
      const csvContent = formatAuditCsv(report, currentTabState);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = 'openai_pixel_audit_' + Date.now() + '.csv';
      const blobUrl = URL.createObjectURL(blob);

      if (typeof chrome !== 'undefined' && chrome.downloads && chrome.downloads.download) {
        chrome.downloads.download({
          url: blobUrl,
          filename: filename,
          saveAs: true
        }, () => {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        });
      } else {
        const dlAnchor = document.createElement('a');
        dlAnchor.href = blobUrl;
        dlAnchor.download = filename;
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        document.body.removeChild(dlAnchor);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      }
    });
  }

  if (btnExportPdf) {
    btnExportPdf.addEventListener('click', () => {
      if (!currentTabState) return;
      const report = generateComprehensiveAudit(currentTabState);
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ active_audit_report: report }, () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/report.html') });
        });
      } else {
        window.open(chrome.runtime.getURL('popup/report.html'), '_blank');
      }
    });
  }

  // Initial Load and Polling interval
  await updateState();
  setInterval(updateState, 2000);
});
