/**
 * OpenAI Ads Pixel Inspector - Professional Developer & Analytics Debugger
 * Reference Style: Stripe Dashboard + Linear + Chrome DevTools + OpenAI Branding
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport, generateComprehensiveAudit, formatAuditMarkdown, formatAuditCsv } from '../core/scanner.js';

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
    code: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    maximize: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    user: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
    emptyCheck: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    emptyEvents: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

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

  // Fallback Copy function using temporary textarea
  function fallbackCopyText(str) {
    const el = document.createElement('textarea');
    el.value = str;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.warn('Clipboard fallback failed', err);
    }
    document.body.removeChild(el);
  }

  // Copy with Visual Feedback
  function copyToClipboard(text, triggerBtn) {
    if (!text) return Promise.resolve(false);
    const str = typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text);

    const showFeedback = () => {
      if (triggerBtn) {
        const originalHtml = triggerBtn.innerHTML;
        const span = triggerBtn.querySelector('span');
        if (span) {
          span.textContent = 'Copied!';
        } else if (triggerBtn.classList.contains('btn') || triggerBtn.classList.contains('btn-payload-action')) {
          triggerBtn.textContent = 'Copied!';
        } else {
          triggerBtn.innerHTML = ICONS.check;
        }
        triggerBtn.classList.add('copied');
        triggerBtn.style.color = 'var(--status-success)';
        setTimeout(() => {
          triggerBtn.innerHTML = originalHtml;
          triggerBtn.classList.remove('copied');
          triggerBtn.style.color = '';
        }, 1500);
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(str).then(() => {
        showFeedback();
        return true;
      }).catch(() => {
        fallbackCopyText(str);
        showFeedback();
        return true;
      });
    } else {
      fallbackCopyText(str);
      showFeedback();
      return Promise.resolve(true);
    }
  }

  // Syntax Highlighter for Developer JSON Display
  function formatAndHighlightJson(jsonObj) {
    if (jsonObj === undefined || jsonObj === null) return '<span class="json-null">null</span>';
    let jsonString;
    try {
      jsonString = typeof jsonObj === 'string' ? JSON.stringify(JSON.parse(jsonObj), null, 2) : JSON.stringify(jsonObj, null, 2);
    } catch {
      jsonString = String(jsonObj);
    }

    const escaped = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return escaped.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
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
  const modalPayloadMeta = document.getElementById('modal-payload-meta');
  const modalCloseBtnFooter = document.getElementById('modal-close-btn-footer');

  function openRawModal(title, jsonData) {
    if (modalEventTitle) modalEventTitle.textContent = title;
    activeModalJson = typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData, null, 2);
    if (modalJsonContent) modalJsonContent.innerHTML = formatAndHighlightJson(jsonData);
    if (modalPayloadMeta) {
      const bytes = new Blob([activeModalJson]).size;
      const keyCount = (typeof jsonData === 'object' && jsonData !== null) ? Object.keys(jsonData).length : 0;
      modalPayloadMeta.textContent = `${keyCount} keys • ${bytes} bytes`;
    }
    if (rawModal) rawModal.classList.remove('hidden');
  }

  if (modalCloseBtn && rawModal) {
    modalCloseBtn.addEventListener('click', () => {
      rawModal.classList.add('hidden');
    });
  }

  if (modalCloseBtnFooter && rawModal) {
    modalCloseBtnFooter.addEventListener('click', () => {
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
    const events = currentTabState.events || [];
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

    // Session ID Row
    const sessId = currentTabState.sessionId || ('SESSION_' + (activeTab ? activeTab.id : ''));
    valSessionId.innerHTML = makeCopyable(sessId, '<span class="mono" style="color:var(--text-main); font-weight:600;">' + escapeHtml(sessId) + '</span>');

    // Attribution (oppref) Row
    if (attribution.oppref) {
      valOppref.innerHTML = makeCopyable(attribution.oppref, '<span style="color:var(--status-success); font-weight:600;">Detected</span> <span class="mono" style="color:var(--text-secondary); font-size:11px;">(' + escapeHtml(truncateString(attribution.oppref, 14)) + ')</span>');
    } else {
      valOppref.innerHTML = '<span style="color:var(--text-muted);">Not detected</span>';
    }

    // Server-Side Activity Check (Clean short status + detailed tooltip)
    const hasCapi = currentTabState.events ? currentTabState.events.some(e => e.isCapi || e.requestOrigin === 'server' || (e.url && e.url.includes('/api/'))) : false;
    if (hasCapi) {
      valServersideStatus.innerHTML = '<span style="color:var(--status-success); font-weight:600;">Detected</span> <span style="color:var(--text-secondary); font-size:11.5px;">(First-party endpoint)</span>';
    } else {
      valServersideStatus.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No activity detected</span>';
    }

    // Metric Summary Cards (Clean & neutral by default, highlight only meaningful issues)
    metricTotalEvents.textContent = stats.totalEvents || 0;
    metricStandardEvents.textContent = stats.standardEvents || 0;
    metricCustomEvents.textContent = stats.customEvents || 0;
    
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
    tabCountEvents.textContent = stats.totalEvents || 0;
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

      latestEventContent.innerHTML = `
        <div class="latest-event-compact">
          <div class="latest-event-top-line">
            <strong class="latest-event-name">${escapeHtml(latest.displayName || latest.name)}</strong>
            ${latestTriggerBadge}
          </div>
          <div class="latest-event-meta-line">
            <span>${formatTimestamp(latest.timestamp)} &bull; <span class="event-type-badge ${isCustom ? 'event-type-custom' : 'event-type-std'}">${isCustom ? 'Custom' : 'Standard'}</span></span>
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
    attachCopyListeners(valSessionId);
    attachCopyListeners(valOppref);
  }

  // ==========================================
  // 7. Events Timeline Renderer
  // ==========================================
  function renderEvents() {
    if (!currentTabState) return;
    const events = currentTabState.events || [];

    const filtered = events.filter((evt) => {
      if (currentFilter === 'standard' && evt.validation && evt.validation.isCustom) return false;
      if (currentFilter === 'custom' && evt.validation && !evt.validation.isCustom) return false;
      if (currentFilter === 'duplicates' && !evt.isDuplicate) return false;
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
      const isPayloadOpen = expandedPayloadEventIds.has(itemKey);
      const isCustom = evt.validation && evt.validation.isCustom;

      // 1. Separation of Trigger vs Validation
      let triggerBadgeHtml = '';
      if (evt.isDuplicate) {
        triggerBadgeHtml = renderStatusBadge('duplicate', 'Double Fired');
      } else if (evt.requestCount > 1) {
        triggerBadgeHtml = renderStatusBadge('duplicate', 'Fired ' + evt.requestCount + 'x');
      } else {
        triggerBadgeHtml = renderStatusBadge('triggered', 'Triggered');
      }

      // 2. Actionable Parameter Errors Box (Concise Received -> Expected)
      let issueBannerHtml = '';
      const params = evt.parameters || {};
      const validation = evt.validation || {};
      const valResults = validation.parameterResults || {};
      
      const errorKeys = Object.keys(valResults).filter(k => valResults[k].severity === 'error' || valResults[k].valid === false);
      const warningKeys = Object.keys(valResults).filter(k => valResults[k].severity === 'warning');

      if (errorKeys.length > 0) {
        const errDetails = errorKeys.map(k => {
          const res = valResults[k];
          return '<div><strong>' + escapeHtml(k) + ':</strong> ' + escapeHtml(res.message || 'Invalid format') + '</div>';
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
          return '<div><strong>' + escapeHtml(k) + ':</strong> ' + escapeHtml(res.message || 'Suboptimal parameter') + '</div>';
        }).join('');
        issueBannerHtml = `
          <div class="event-issue-banner" style="background: var(--status-warning-bg); border-left-color: var(--status-warning); color: var(--status-warning);">
            <div><strong>${warningKeys.length} parameter warning(s):</strong></div>
            ${warnDetails}
          </div>
        `;
      }

      // 3. Parameter Table Rows with Structured Code Containers
      let paramRows = '';
      for (const [key, val] of Object.entries(params)) {
        const valRes = valResults[key] || {};
        let piiBadge = '';
        if (valRes.pii && valRes.piiDetails) {
          piiBadge = '<span class="badge badge-error" style="font-size:10px; padding:1px 4px; margin-left:4px;">PII: ' + escapeHtml(valRes.piiDetails.type) + '</span>';
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
          const countBadge = Array.isArray(val) ? (val.length + ' item(s)') : (Object.keys(val).length + ' field(s)');
          displayVal = `
            <div class="param-code-container">
              <span class="param-code-tag">${countBadge}</span>
              <pre class="param-code-block">${escapeHtml(formattedJson)}</pre>
            </div>
          `;
        } else {
          displayVal = makeCopyable(String(val), '<span class="param-scalar-val">' + escapeHtml(String(val)) + '</span>');
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

      const eventIdDisplay = evt.eventId ? makeCopyable(evt.eventId, '<code>' + escapeHtml(evt.eventId) + '</code>') : '<span style="color:var(--text-muted); font-style:italic;">Not Sent</span>';
      const pixelIdDisplay = evt.pixelId ? makeCopyable(evt.pixelId, '<code>' + escapeHtml(evt.pixelId) + '</code>') : '<span style="color:var(--text-muted)">Default</span>';

      let userInfoHtml = '';
      const ui = evt.userInfo;

      if (ui && ui.fields && ui.fields.length > 0) {
        const fieldRows = ui.fields.map(f => `
          <div class="user-info-field-row">
            <div class="user-info-field-label">
              <span class="user-info-icon">${ICONS.user}</span>
              <span>${escapeHtml(f.label)}:</span>
            </div>
            <div class="user-info-field-val">
              <code>${escapeHtml(f.masked)}</code>
              ${f.isHashed ? '<span class="badge badge-success" style="font-size:9.5px; padding:1px 4px;">SHA-256</span>' : '<span class="badge badge-warning" style="font-size:9.5px; padding:1px 4px;">Raw PII</span>'}
            </div>
          </div>
        `).join('');

        userInfoHtml = `
          <div class="user-info-card">
            <div class="user-info-card-header">
              <div style="display:flex; align-items:center; gap:6px;">
                ${ICONS.user}
                <strong style="font-size:11px; color:var(--text-main);">Customer / User Info (Sent with Event)</strong>
              </div>
              <span class="badge badge-neutral" style="font-size:9.5px;">${ui.fields.length} field(s)</span>
            </div>
            <div class="user-info-card-body">
              ${fieldRows}
            </div>
          </div>
        `;
      }

      item.className = 'event-card ' + (isExpanded ? 'open' : '');
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
              <span class="event-spec-val">${pixelIdDisplay}</span>
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

          ${userInfoHtml}

          <details class="payload-details" ${isPayloadOpen ? 'open' : ''}>
            <summary>
              <div class="payload-summary-left">
                <span class="payload-summary-chevron">${ICONS.chevronDown}</span>
                <span>JSON Payload</span>
                <span class="payload-keys-count">(${Object.keys(evt.parameters || {}).length} keys)</span>
              </div>
              <div class="payload-summary-actions">
                <button class="btn-payload-action btn-copy-payload" title="Copy full JSON payload">
                  ${ICONS.copy}
                  <span>Copy</span>
                </button>
                <button class="btn-payload-action btn-expand-payload" title="View in full modal">
                  ${ICONS.maximize}
                  <span>Expand</span>
                </button>
              </div>
            </summary>
            <div class="payload-box-body">
              <pre class="payload-code">${formatAndHighlightJson(evt.parameters)}</pre>
            </div>
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

      // Stop propagation inside details drawer
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

      // Payload Copy & Expand Button Handlers
      const btnCopyPayload = item.querySelector('.btn-copy-payload');
      if (btnCopyPayload) {
        btnCopyPayload.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          copyToClipboard(JSON.stringify(evt.parameters || {}, null, 2), btnCopyPayload);
        });
      }

      const btnExpandPayload = item.querySelector('.btn-expand-payload');
      if (btnExpandPayload) {
        btnExpandPayload.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          openRawModal((evt.displayName || evt.name || 'Event') + ' Payload', evt.parameters || {});
        });
      }

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
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:11px; font-weight:600; color:var(--text-secondary);">Data Layer Object</span>
            <div style="display:flex; gap:6px;">
              <button class="btn-payload-action btn-copy-dl" title="Copy Data Layer JSON">
                ${ICONS.copy}
                <span>Copy</span>
              </button>
              <button class="btn-payload-action btn-expand-dl" title="View in full modal">
                ${ICONS.maximize}
                <span>Expand</span>
              </button>
            </div>
          </div>
          <pre class="payload-code">${formatAndHighlightJson(dl.data || dl)}</pre>
        </div>
      `;

      const header = row.querySelector('.dl-row-header');
      header.addEventListener('click', () => {
        if (expandedDlIndices.has(idx)) {
          expandedDlIndices.delete(idx);
          row.classList.remove('open');
        } else {
          expandedDlIndices.add(idx);
          row.classList.add('open');
        }
      });

      const drawer = row.querySelector('.dl-drawer');
      if (drawer) {
        drawer.addEventListener('click', (e) => {
          e.stopPropagation();
        });
      }

      const btnCopyDl = row.querySelector('.btn-copy-dl');
      if (btnCopyDl) {
        btnCopyDl.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          copyToClipboard(JSON.stringify(dl.data || dl, null, 2), btnCopyDl);
        });
      }

      const btnExpandDl = row.querySelector('.btn-expand-dl');
      if (btnExpandDl) {
        btnExpandDl.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          openRawModal('Data Layer: ' + evtName, dl.data || dl);
        });
      }

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

    attrUrlVal.innerHTML = attribution.urlDetected ? makeCopyable(attribution.details.urlParam, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.urlParam) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    attrCookieVal.innerHTML = attribution.cookieDetected ? makeCopyable(attribution.details.cookieValue, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.cookieValue) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    attrStorageVal.innerHTML = attribution.storageDetected ? makeCopyable(attribution.details.localStorage, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.details.localStorage) + '</span>') : '<span style="color:var(--text-muted);">Not found</span>';
    attrActiveKey.innerHTML = attribution.oppref ? makeCopyable(attribution.oppref, '<span style="color:var(--status-success); font-weight:600;">' + escapeHtml(attribution.oppref) + '</span>') : '<span style="color:var(--text-muted);">None</span>';

    attachCopyListeners(attrUrlVal);
    attachCopyListeners(attrCookieVal);
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
