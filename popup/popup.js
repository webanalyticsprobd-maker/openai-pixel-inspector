/**
 * OpenAI Ads Pixel Inspector - Professional Live Debugger & Audit System
 * Reference Style: Stripe Dashboard + Linear + Chrome DevTools + OpenAI Branding
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport, generateComprehensiveAudit, formatAuditMarkdown, formatAuditCsv } from '../core/scanner.js';
import { getCurrencyDecimalPlaces } from '../validators/schemas.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation elements
  const allNavTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const targetHostEl = document.getElementById('target-host');
  const btnCopyHost = document.getElementById('btn-copy-host');
  const badgeTabIdEl = document.getElementById('badge-tab-id');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');
  const btnTheme = document.getElementById('btn-theme');
  const themeIcon = document.getElementById('theme-icon');
  const btnSidepanel = document.getElementById('btn-sidepanel');
  const navScrollTrack = document.getElementById('nav-scroll-track');
  const btnNavScrollPrev = document.getElementById('nav-scroll-prev');
  const btnNavScrollNext = document.getElementById('nav-scroll-next');

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
  const tabCountNetwork = document.getElementById('tab-count-network');
  const tabCountFunnel = document.getElementById('tab-count-funnel');
  const tabCountMatching = document.getElementById('tab-count-matching');
  const tabCountDatalayer = document.getElementById('tab-count-datalayer');
  const tabCountIssues = document.getElementById('tab-count-issues');

  // Overview Diagnostics & Matching
  const sdkDroppedBadge = document.getElementById('sdk-dropped-badge');
  const diagValSdkStatus = document.getElementById('diag-val-sdk-status');
  const diagValAam = document.getElementById('diag-val-aam');
  const diagValDropped = document.getElementById('diag-val-dropped');
  const diagValErrors = document.getElementById('diag-val-errors');

  const matchingScorecardBadge = document.getElementById('matching-scorecard-badge');
  const valMatchEmail = document.getElementById('val-match-email');
  const valMatchPhone = document.getElementById('val-match-phone');
  const valMatchEid = document.getElementById('val-match-eid');
  const valMatchGeo = document.getElementById('val-match-geo');

  // Events Tab elements
  const eventSearchInput = document.getElementById('event-search-input');
  const eventPixelSelect = document.getElementById('event-pixel-select');
  const filterChips = document.querySelectorAll('.filter-chip');
  const eventsListContainer = document.getElementById('events-list-container');

  // Network Requests Tab elements
  const networkRequestsBadge = document.getElementById('network-requests-badge');
  const networkRequestsContainer = document.getElementById('network-requests-container');

  // Funnel Tab elements
  const funnelRateBadge = document.getElementById('funnel-rate-badge');
  const funnelPipelineContainer = document.getElementById('funnel-pipeline-container');

  // Timeline Tab elements
  const timelineStepsBadge = document.getElementById('timeline-steps-badge');
  const timelineContainer = document.getElementById('timeline-container');

  // Matching & Privacy Tab elements
  const matchingCoverageBadge = document.getElementById('matching-coverage-badge');
  const matchingDetailsContainer = document.getElementById('matching-details-container');
  const privacyStatusBadge = document.getElementById('privacy-status-badge');
  const privacyInspectorContainer = document.getElementById('privacy-inspector-container');

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
  const modalCloseBtnFooter = document.getElementById('modal-close-btn-footer');
  const modalBtnViewOrganized = document.getElementById('modal-btn-view-organized');
  const modalBtnViewRaw = document.getElementById('modal-btn-view-raw');
  const modalOrganizedView = document.getElementById('modal-organized-view');
  const modalRawView = document.getElementById('modal-raw-view');
  const modalJsonContent = document.getElementById('modal-json-content');
  const modalCopyBtn = document.getElementById('modal-copy-btn');
  const modalEventTitle = document.getElementById('modal-event-title');
  const modalEventSubtitle = document.getElementById('modal-event-subtitle');
  const modalEventIcon = document.getElementById('modal-event-icon');
  const modalPayloadMeta = document.getElementById('modal-payload-meta');

  let activeTab = null;
  let currentTabState = null;
  let currentFilter = 'all';
  let currentIssueFilter = 'all';
  let searchQuery = '';
  let selectedPixel = 'all';
  let activeModalJson = '';
  let activeModalEvent = null;
  const expandedEventIds = new Set();
  const expandedPayloadEventIds = new Set();
  const expandedNetReqIds = new Set();

  // SVG Icon System
  const ICONS = {
    check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    cross: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    warn: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    sun: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
    moon: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    copy: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    code: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>',
    package: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    dollar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    user: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    emptyEvents: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>'
  };

  function renderStatusBadge(severity, label, titleText) {
    const safeTitle = titleText ? (' title="' + escapeHtml(titleText) + '"') : '';
    if (severity === 'valid' || severity === 'pass' || severity === 'success' || severity === 'detected' || severity === 'triggered') {
      return '<span class="badge badge-success"' + safeTitle + '>' + ICONS.check + ' ' + (label || 'Valid') + '</span>';
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

  // Format currency value from minor integer units to human-readable string
  function formatMonetaryValue(amount, currencyCode = 'USD') {
    if (amount === undefined || amount === null) return null;
    const cleanCurrency = String(currencyCode || 'USD').trim().toUpperCase();
    const decimals = getCurrencyDecimalPlaces(cleanCurrency);
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    
    const majorValue = num / Math.pow(10, decimals);
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: cleanCurrency,
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(majorValue);
    } catch {
      return cleanCurrency + ' ' + majorValue.toFixed(decimals);
    }
  }

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

  function copyToClipboard(text, triggerBtn) {
    if (!text) return Promise.resolve(false);
    const str = typeof text === 'object' ? JSON.stringify(text, null, 2) : String(text);

    const showFeedback = () => {
      if (triggerBtn) {
        const originalHtml = triggerBtn.innerHTML;
        const span = triggerBtn.querySelector('span');
        if (span) {
          span.textContent = 'Copied!';
        } else {
          triggerBtn.textContent = 'Copied!';
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

  function formatAndHighlightJson(jsonObj) {
    if (jsonObj === undefined || jsonObj === null) return '<span class="text-muted">null</span>';
    let jsonStr = typeof jsonObj === 'string' ? jsonObj : JSON.stringify(jsonObj, null, 2);
    
    jsonStr = escapeHtml(jsonStr);
    return jsonStr.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\\-]?\d+)?)/g,
      function (match) {
        let cls = 'hl-num';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'hl-key';
          } else {
            cls = 'hl-str';
          }
        } else if (/true|false/.test(match)) {
          cls = 'hl-bool';
        } else if (/null/.test(match)) {
          cls = 'hl-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      }
    );
  }

  // Theme
  function initTheme() {
    const saved = localStorage.getItem('__oai_theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    if (themeIcon) themeIcon.innerHTML = saved === 'dark' ? ICONS.sun : ICONS.moon;
  }

  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') || 'light';
      const next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('__oai_theme', next);
      if (themeIcon) themeIcon.innerHTML = next === 'dark' ? ICONS.sun : ICONS.moon;
    });
  }
  initTheme();

  // Side Panel
  if (btnSidepanel) {
    btnSidepanel.addEventListener('click', async () => {
      try {
        if (chrome.sidePanel && chrome.sidePanel.open && activeTab?.id) {
          await chrome.sidePanel.open({ tabId: activeTab.id });
          window.close();
        } else {
          window.open(chrome.runtime.getURL('popup/popup.html'), '_blank', 'width=500,height=750');
        }
      } catch {
        window.open(chrome.runtime.getURL('popup/popup.html'), '_blank', 'width=500,height=750');
      }
    });
  }

  // Navigation Switching
  allNavTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabTarget = tab.getAttribute('data-tab');
      allNavTabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      tabPanes.forEach((p) => p.classList.remove('active'));
      const targetPane = document.getElementById('pane-' + tabTarget);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Carousel Scroll
  if (btnNavScrollPrev && btnNavScrollNext && navScrollTrack) {
    btnNavScrollPrev.addEventListener('click', () => {
      navScrollTrack.scrollBy({ left: -100, behavior: 'smooth' });
    });
    btnNavScrollNext.addEventListener('click', () => {
      navScrollTrack.scrollBy({ left: 100, behavior: 'smooth' });
    });
  }

  // Filter Chips
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.getAttribute('data-filter') || 'all';
      renderEventsList();
    });
  });

  if (eventPixelSelect) {
    eventPixelSelect.addEventListener('change', () => {
      selectedPixel = eventPixelSelect.value;
      renderEventsList();
    });
  }

  if (eventSearchInput) {
    eventSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderEventsList();
    });
  }

  // Refresh & Clear
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.transform = 'rotate(180deg)';
      setTimeout(() => { btnRefresh.style.transform = ''; }, 300);
      loadActiveTabState();
    });
  }

  if (btnClear) {
    btnClear.addEventListener('click', () => {
      if (activeTab?.id) {
        chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id }, () => {
          loadActiveTabState();
        });
      }
    });
  }

  if (btnCopyHost && targetHostEl) {
    btnCopyHost.addEventListener('click', () => {
      copyToClipboard(targetHostEl.textContent, btnCopyHost);
    });
  }

  // Modal View Switcher
  if (modalBtnViewOrganized && modalBtnViewRaw) {
    modalBtnViewOrganized.addEventListener('click', () => {
      modalBtnViewOrganized.classList.add('active');
      modalBtnViewRaw.classList.remove('active');
      if (modalOrganizedView) modalOrganizedView.style.display = 'block';
      if (modalRawView) modalRawView.style.display = 'none';
    });

    modalBtnViewRaw.addEventListener('click', () => {
      modalBtnViewRaw.classList.add('active');
      modalBtnViewOrganized.classList.remove('active');
      if (modalOrganizedView) modalOrganizedView.style.display = 'none';
      if (modalRawView) modalRawView.style.display = 'block';
    });
  }

  function closeModal() {
    if (rawModal) rawModal.classList.add('hidden');
    activeModalJson = '';
    activeModalEvent = null;
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalCloseBtnFooter) modalCloseBtnFooter.addEventListener('click', closeModal);
  if (rawModal) {
    rawModal.addEventListener('click', (e) => {
      if (e.target === rawModal) closeModal();
    });
  }

  if (modalCopyBtn) {
    modalCopyBtn.addEventListener('click', () => {
      copyToClipboard(activeModalJson, modalCopyBtn);
    });
  }

  // Issue filter chips
  issueFilterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      issueFilterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentIssueFilter = chip.getAttribute('data-filter') || 'all';
      renderIssues();
    });
  });

  // State Loader
  async function loadActiveTabState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        if (targetHostEl) targetHostEl.textContent = 'No active tab found';
        return;
      }
      activeTab = tab;

      if (badgeTabIdEl) badgeTabIdEl.textContent = 'Tab #' + tab.id;
      if (targetHostEl && tab.url) {
        try {
          const u = new URL(tab.url);
          targetHostEl.textContent = u.hostname + (u.pathname.length > 1 ? u.pathname : '');
        } catch {
          targetHostEl.textContent = tab.url;
        }
      }

      chrome.runtime.sendMessage({ action: 'GET_ACTIVE_TAB_STATE', tabId: tab.id }, (response) => {
        if (response && response.state) {
          currentTabState = response.state;
          renderAll();
        } else {
          currentTabState = null;
          renderEmpty();
        }
      });
    } catch (err) {
      console.warn('[OpenAI Pixel Inspector] Tab query error:', err);
    }
  }

  function renderAll() {
    if (!currentTabState) {
      renderEmpty();
      return;
    }
    renderOverview();
    renderEventsList();
    renderNetworkRequests();
    renderFunnel();
    renderTimeline();
    renderMatchingAndPrivacy();
    renderDataLayer();
    renderAttribution();
    renderIssues();
    renderAudit();
  }

  function renderEmpty() {
    if (pixelStatusBadge) {
      pixelStatusBadge.className = 'badge badge-neutral';
      pixelStatusBadge.textContent = 'Scanning';
    }
    if (healthStatusBadge) {
      healthStatusBadge.className = 'badge badge-neutral';
      healthStatusBadge.textContent = 'Ready';
    }
    if (valPixelId) valPixelId.textContent = 'Not detected';
    if (valOppref) valOppref.textContent = 'Not detected';
    if (valServersideStatus) valServersideStatus.textContent = 'No activity detected';
  }

  // 1. Overview Tab
  function renderOverview() {
    const s = currentTabState;
    if (!s) return;

    if (pixelStatusBadge) {
      if (s.pixel && s.pixel.detected) {
        pixelStatusBadge.className = 'badge badge-success';
        pixelStatusBadge.textContent = 'Pixel Detected ✓';
      } else {
        pixelStatusBadge.className = 'badge badge-neutral';
        pixelStatusBadge.textContent = 'Not detected';
      }
    }

    const totalEvts = s.events ? s.events.length : 0;
    if (healthStatusBadge) {
      if (!s.pixel?.detected && totalEvts === 0) {
        healthStatusBadge.className = 'badge badge-neutral';
        healthStatusBadge.textContent = 'Ready';
        if (healthOverallLabel) healthOverallLabel.textContent = 'Implementation Status';
      } else if (s.stats?.errorEvents > 0) {
        healthStatusBadge.className = 'badge badge-error';
        healthStatusBadge.textContent = 'Issues Found';
        if (healthOverallLabel) healthOverallLabel.textContent = s.stats.errorEvents + ' Critical Issue(s)';
      } else if (s.stats?.warningEvents > 0) {
        healthStatusBadge.className = 'badge badge-warning';
        healthStatusBadge.textContent = 'Needs Review';
        if (healthOverallLabel) healthOverallLabel.textContent = s.stats.warningEvents + ' Warning(s)';
      } else {
        healthStatusBadge.className = 'badge badge-success';
        healthStatusBadge.textContent = 'Healthy ✓';
        if (healthOverallLabel) healthOverallLabel.textContent = 'Passing Schema Validation';
      }
    }

    if (valPixelId) {
      if (s.pixel?.pixelIds && s.pixel.pixelIds.length > 0) {
        valPixelId.innerHTML = s.pixel.pixelIds.map(p => '<span class="badge badge-neutral mono" style="font-size:11px;">' + escapeHtml(p) + '</span>').join(' ');
      } else {
        valPixelId.textContent = 'Not detected';
      }
    }

    if (valOppref) {
      if (s.attribution?.oppref) {
        valOppref.innerHTML = '<span class="badge badge-success mono" style="font-size:11px;" title="' + escapeHtml(s.attribution.oppref) + '">' + truncateString(s.attribution.oppref, 18) + '</span>';
      } else {
        valOppref.textContent = 'Not detected';
      }
    }

    if (valSessionId) valSessionId.textContent = s.sessionId || 'Active';

    if (metricTotalEvents) metricTotalEvents.textContent = totalEvts;
    if (metricStandardEvents) metricStandardEvents.textContent = s.stats ? s.stats.standardEvents : 0;
    if (metricCustomEvents) metricCustomEvents.textContent = s.stats ? s.stats.customEvents : 0;
    if (metricIssuesEvents) metricIssuesEvents.textContent = s.stats ? (s.stats.errorEvents + s.stats.warningEvents) : 0;

    if (tabCountEvents) tabCountEvents.textContent = totalEvts;
    if (tabCountNetwork) tabCountNetwork.textContent = (s.network ? s.network.length : 0);
    if (tabCountDatalayer) tabCountDatalayer.textContent = (s.dataLayer ? s.dataLayer.length : 0);
    if (tabCountIssues) tabCountIssues.textContent = (s.stats ? s.stats.errorEvents + s.stats.warningEvents : 0);

    // Diagnostics
    const diag = s.diagnostics || (s.networkSummary ? s.networkSummary.latestDiagnostics : null);
    if (diag) {
      const dropCount = diag.droppedEventCount || 0;
      if (sdkDroppedBadge) {
        sdkDroppedBadge.className = dropCount > 0 ? 'badge badge-error' : 'badge badge-success';
        sdkDroppedBadge.textContent = dropCount > 0 ? dropCount + ' Dropped ✕' : '0 Dropped ✓';
      }
      if (diagValSdkStatus) diagValSdkStatus.textContent = '✓ Running';
      if (diagValAam) diagValAam.textContent = diag.automaticAdvancedMatching === 'enabled' ? '✓ Enabled' : 'Disabled';
      if (diagValDropped) {
        diagValDropped.className = dropCount > 0 ? 'diag-val text-rose' : 'diag-val text-emerald';
        diagValDropped.textContent = dropCount > 0 ? dropCount + ' events rejected' : '0 detected ✓';
      }
      if (diagValErrors) {
        const errs = s.stats?.errorEvents || 0;
        diagValErrors.textContent = errs > 0 ? errs + ' validation issue(s)' : 'None detected ✓';
      }
    }

    // Matching Scorecard
    const uMatch = s.userMatching || (s.networkSummary ? s.networkSummary.latestUserMatching : null);
    const fields = uMatch?.fields || [];
    const hasEmail = fields.some(f => f.type === 'email');
    const hasPhone = fields.some(f => f.type === 'phone');
    const hasEid = fields.some(f => f.type === 'external_id');
    const hasGeo = fields.some(f => f.type === 'country' || f.type === 'region');

    let matchScore = 'No Identifiers';
    let matchBadgeClass = 'badge badge-neutral';

    if (hasEmail && (hasPhone || hasEid)) {
      matchScore = 'Strong Coverage';
      matchBadgeClass = 'badge badge-success';
    } else if (hasEmail || hasPhone || hasEid) {
      matchScore = 'Moderate Coverage';
      matchBadgeClass = 'badge badge-info';
    } else if (hasGeo) {
      matchScore = 'Limited (Geo Only)';
      matchBadgeClass = 'badge badge-warning';
    }

    if (matchingScorecardBadge) {
      matchingScorecardBadge.className = matchBadgeClass;
      matchingScorecardBadge.textContent = matchScore;
    }
    if (tabCountMatching) {
      tabCountMatching.textContent = fields.length || 0;
    }

    if (valMatchEmail) valMatchEmail.innerHTML = hasEmail ? '<span class="text-emerald">✓ Detected (Hashed)</span>' : '<span class="text-muted">Not detected</span>';
    if (valMatchPhone) valMatchPhone.innerHTML = hasPhone ? '<span class="text-emerald">✓ Detected (Hashed)</span>' : '<span class="text-muted">Not detected</span>';
    if (valMatchEid) valMatchEid.innerHTML = hasEid ? '<span class="text-emerald">✓ Detected (Hashed)</span>' : '<span class="text-muted">Not detected</span>';
    if (valMatchGeo) valMatchGeo.innerHTML = hasGeo ? '<span class="text-emerald">✓ Detected</span>' : '<span class="text-muted">Not detected</span>';

    // Multi-Pixel Card
    const multiCard = document.getElementById('multi-pixel-card');
    const multiContent = document.getElementById('multi-pixel-content');
    const pids = s.pixel?.pixelIds || [];
    if (multiCard && multiContent) {
      if (pids.length > 1) {
        multiCard.style.display = 'block';
        multiContent.innerHTML = '<div style="font-size:12px; margin-bottom:6px; color:var(--text-secondary);">Multi-Pixel setup detected with ' + pids.length + ' initialized IDs:</div><div style="display:flex; flex-wrap:wrap; gap:6px;">' + pids.map(id => '<span class="badge badge-info mono" style="font-size:11px;">' + escapeHtml(id) + '</span>').join('') + '</div>';
      } else {
        multiCard.style.display = 'none';
      }
    }

    // Latest Event
    if (latestEventContent && latestEventTime) {
      if (s.events && s.events.length > 0) {
        const last = s.events[s.events.length - 1];
        latestEventTime.textContent = formatTimestamp(last.timestamp);
        latestEventContent.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; padding: 4px 0;"><div style="display:flex; align-items:center; gap:6px;"><span class="mono font-bold" style="font-size:13px; color:var(--accent-brand);">' + escapeHtml(last.displayName || last.name) + '</span><span class="badge badge-neutral" style="font-size:10px;">' + escapeHtml(last.validation?.dataShape || 'contents') + '</span></div>' + renderStatusBadge(last.validation?.status || 'valid', last.validation?.status?.toUpperCase() || 'VALID') + '</div>';
      } else {
        latestEventTime.textContent = '--:--:--';
        latestEventContent.innerHTML = '<div class="empty-state-sm">No events detected yet.</div>';
      }
    }
  }

  // 2. Live Events Feed
  function renderEventsList() {
    if (!eventsListContainer) return;
    const s = currentTabState;
    if (!s || !s.events || s.events.length === 0) {
      eventsListContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.emptyEvents + '</div><div class="empty-title">No Live Events Detected</div><div class="empty-desc">OpenAI Ads Pixel measure calls will be captured here in real time.</div></div>';
      return;
    }

    if (eventPixelSelect) {
      const pids = s.pixel?.pixelIds || [];
      const currentVal = eventPixelSelect.value;
      let opts = '<option value="all">All Pixels</option>';
      pids.forEach(p => {
        opts += '<option value="' + escapeHtml(p) + '" ' + (p === currentVal ? 'selected' : '') + '>' + escapeHtml(p) + '</option>';
      });
      eventPixelSelect.innerHTML = opts;
    }

    const filtered = s.events.filter(evt => {
      if (selectedPixel !== 'all' && evt.pixelId !== selectedPixel) return false;
      const name = (evt.name || '').toLowerCase();
      const isTech = name.startsWith('openai::') || name.startsWith('oai::') || name === 'sdk_lifecycle' || name === 'diagnostic';
      const isCommerce = ['contents_viewed', 'items_added', 'checkout_started', 'order_created'].includes(name);

      if (currentFilter === 'commerce' && !isCommerce) return false;
      if (currentFilter === 'technical' && !isTech) return false;
      if (currentFilter === 'standard' && (evt.validation?.isCustom || isTech)) return false;
      if (currentFilter === 'custom' && !evt.validation?.isCustom) return false;
      if (currentFilter === 'errors' && evt.validation?.status !== 'error') return false;
      if (currentFilter === 'warnings' && evt.validation?.status !== 'warning') return false;
      if (currentFilter === 'duplicates' && !evt.isDuplicate) return false;

      if (searchQuery) {
        const text = (evt.name + ' ' + (evt.pixelId || '') + ' ' + (evt.url || '') + ' ' + JSON.stringify(evt.parameters || {})).toLowerCase();
        if (!text.includes(searchQuery)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      eventsListContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.info + '</div><div class="empty-title">No matching events</div><div class="empty-desc">Try clearing filters or search query.</div></div>';
      return;
    }

    eventsListContainer.innerHTML = '';

    filtered.forEach((evt) => {
      const isExpanded = expandedEventIds.has(evt._id);
      const isRawView = expandedPayloadEventIds.has(evt._id);
      const name = evt.displayName || evt.name;
      const isTech = name.startsWith('openai::') || name.startsWith('oai::');
      const timeStr = formatTimestamp(evt.timestamp);
      const status = evt.validation?.status || 'valid';

      const card = document.createElement('div');
      card.className = 'event-accordion-item ' + (isExpanded ? 'open' : '');
      card.id = 'event-row-' + evt._id;

      card.innerHTML = '<div class="event-header-row" data-id="' + evt._id + '">' +
        '<div style="display:flex; align-items:center; gap:8px; flex:1; min-width:0;">' +
        '<span class="mono text-muted" style="font-size:11px;">' + timeStr + '</span>' +
        '<span class="event-name-tag ' + (isTech ? 'tech' : '') + '">' + escapeHtml(name) + '</span>' +
        (evt.isDuplicate ? '<span class="badge badge-warning" style="font-size:10px;">Duplicate</span>' : '') +
        (evt.pixelId ? '<span class="badge badge-neutral mono" style="font-size:10px;">' + truncateString(evt.pixelId, 12) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
        renderStatusBadge(status, status.toUpperCase()) +
        '<button class="icon-button btn-inspect-modal" title="Inspect Full Analysis" data-id="' + evt._id + '" style="padding:3px;">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>' +
        '</button>' +
        '<span class="accordion-chevron ' + (isExpanded ? 'rotated' : '') + '">' + ICONS.chevronDown + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="event-body-container" style="display: ' + (isExpanded ? 'block' : 'none') + '; padding: 10px 12px; border-top: 1px solid var(--border-subtle); background: var(--bg-subtle);">' +
        '<div class="event-body-content" id="event-body-' + evt._id + '">' +
        '</div>' +
        '</div>';

      const headerRow = card.querySelector('.event-header-row');
      headerRow.addEventListener('click', (e) => {
        if (e.target.closest('.btn-inspect-modal')) return;
        if (expandedEventIds.has(evt._id)) {
          expandedEventIds.delete(evt._id);
        } else {
          expandedEventIds.add(evt._id);
        }
        renderEventsList();
      });

      const btnInspect = card.querySelector('.btn-inspect-modal');
      if (btnInspect) {
        btnInspect.addEventListener('click', (e) => {
          e.stopPropagation();
          openEventModal(evt);
        });
      }

      if (isExpanded) {
        const bodyContent = card.querySelector('#event-body-' + evt._id);
        if (bodyContent) {
          bodyContent.innerHTML = renderOrganizedEventHtml(evt, isRawView);
          attachEventBodyListeners(bodyContent, evt);
        }
      }

      eventsListContainer.appendChild(card);
    });
  }

  function openEventModal(evt) {
    activeModalEvent = evt;
    activeModalJson = JSON.stringify(evt.rawEvent || evt, null, 2);

    if (modalEventTitle) modalEventTitle.textContent = (evt.displayName || evt.name).toUpperCase();
    if (modalEventSubtitle) modalEventSubtitle.textContent = 'Timestamp: ' + formatTimestamp(evt.timestamp) + ' | Pixel: ' + (evt.pixelId || 'Default');
    if (modalPayloadMeta) modalPayloadMeta.textContent = 'Event ID: ' + (evt.sdkEventId || evt.eventId || 'Not assigned');

    if (modalEventIcon) {
      const isTech = (evt.name || '').startsWith('openai::') || (evt.name || '').startsWith('oai::');
      modalEventIcon.innerHTML = isTech ? ICONS.code : ICONS.package;
    }

    if (modalOrganizedView) {
      modalOrganizedView.innerHTML = renderOrganizedEventHtml(evt, false);
      attachEventBodyListeners(modalOrganizedView, evt);
      modalOrganizedView.style.display = 'block';
    }

    if (modalRawView) {
      modalRawView.style.display = 'none';
      if (modalJsonContent) {
        modalJsonContent.innerHTML = formatAndHighlightJson(evt.rawEvent || evt);
      }
    }

    if (modalBtnViewOrganized) modalBtnViewOrganized.classList.add('active');
    if (modalBtnViewRaw) modalBtnViewRaw.classList.remove('active');
    if (rawModal) rawModal.classList.remove('hidden');
  }

  function renderOrganizedEventHtml(evt, isRawView) {
    const params = evt.parameters || {};
    const userInfo = evt.userInfo || currentTabState?.userMatching;
    const val = evt.validation || {};
    const formattedAmount = formatMonetaryValue(params.amount, params.currency);
    const contents = Array.isArray(params.contents) ? params.contents : [];

    if (isRawView) {
      return '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<span style="font-size:11px; font-weight:600; color:var(--text-secondary);">Raw JSON Network Payload</span>' +
        '<button class="btn btn-secondary btn-copy-raw-inline" data-id="' + evt._id + '" style="padding:3px 8px; font-size:11px;">Copy</button>' +
        '</div>' +
        '<pre class="raw-code">' + formatAndHighlightJson(evt.rawEvent || evt) + '</pre>';
    }

    let html = '';

    // 1. Revenue Hero
    if (params.amount !== undefined) {
      const isInteger = Number.isInteger(params.amount);
      html += '<div class="revenue-hero">' +
        '<div>' +
        '<div style="font-size:11px; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Monetary Value</div>' +
        '<div class="revenue-amount-hero">' + (formattedAmount || params.amount) + '</div>' +
        '<div class="revenue-subtext">Currency: <strong>' + escapeHtml(params.currency || 'USD') + '</strong> (Raw Payload: <code>' + params.amount + '</code>)</div>' +
        '</div>' +
        '<div style="text-align:right;">' +
        (isInteger ? '<span class="badge badge-success">✓ Integer Minor Units</span>' : '<span class="badge badge-error">✕ Invalid Non-Integer</span>') +
        '</div>' +
        '</div>';
    }

    // 2. Event Information
    html += '<div class="org-section">' +
      '<div class="org-section-header">' +
      '<span class="org-section-title">1. Event Information</span>' +
      renderStatusBadge(val.status || 'valid', val.status?.toUpperCase()) +
      '</div>' +
      '<div class="org-explanation">Identifies the specific action received by OpenAI and when it happened.</div>' +
      '<div class="org-grid">' +
      '<div class="org-row"><span class="org-label">Event Name</span><span class="org-val">' + escapeHtml(evt.displayName || evt.name) + '</span></div>' +
      '<div class="org-row"><span class="org-label">Data Shape</span><span class="org-val">' + escapeHtml(val.dataShape || 'contents') + '</span></div>' +
      '<div class="org-row"><span class="org-label">Event ID</span><span class="org-val">' + escapeHtml(evt.sdkEventId || evt.eventId || 'Generated automatically') + '</span></div>' +
      '<div class="org-row"><span class="org-label">Timestamp</span><span class="org-val">' + new Date(evt.timestamp).toLocaleString() + '</span></div>' +
      '<div class="org-row"><span class="org-label">Target Pixel ID</span><span class="org-val">' + escapeHtml(evt.pixelId || 'Default Pixel') + '</span></div>' +
      '</div>' +
      '</div>';

    // 3. Page & Journey Information
    html += '<div class="org-section">' +
      '<div class="org-section-header">' +
      '<span class="org-section-title">2. Page & Journey Context</span>' +
      '</div>' +
      '<div class="org-explanation">Tells OpenAI where the action occurred and which page the visitor came from.</div>' +
      '<div class="org-grid">' +
      '<div class="org-row"><span class="org-label">Source URL</span><span class="org-val truncate" title="' + escapeHtml(evt.sourceUrl || evt.url || '') + '">' + escapeHtml(evt.sourceUrl || evt.url || 'Current Page') + '</span></div>' +
      '<div class="org-row"><span class="org-label">Referrer URL</span><span class="org-val truncate" title="' + escapeHtml(evt.referrerUrl || 'Direct / None') + '">' + escapeHtml(evt.referrerUrl || 'Direct / None') + '</span></div>' +
      '<div class="org-row"><span class="org-label">Opt-Out Status</span><span class="org-val">' + (evt.optOut === true ? 'Opted Out' : 'false (Tracked) ✓') + '</span></div>' +
      '</div>' +
      '</div>';

    // 4. Products
    if (contents.length > 0) {
      html += '<div class="org-section">' +
        '<div class="org-section-header">' +
        '<span class="org-section-title">3. Product & Content Items (' + contents.length + ')</span>' +
        '</div>' +
        '<div class="org-explanation">Item-level product and catalog breakdown passed in the contents array.</div>' +
        '<div style="padding:8px 10px;">';

      contents.forEach((item, cIdx) => {
        const itemFormatted = formatMonetaryValue(item.amount, item.currency || params.currency);
        html += '<div class="product-card-item">' +
          '<div class="product-card-header">' +
          '<span>Item #' + (cIdx + 1) + ': ' + escapeHtml(item.name || item.id || 'Product') + '</span>' +
          '<span class="badge badge-neutral" style="font-size:10px;">' + escapeHtml(item.content_type || 'product') + '</span>' +
          '</div>' +
          '<div class="org-row"><span class="org-label">Product ID (SKU)</span><span class="org-val">' + escapeHtml(item.id || 'Not sent') + '</span></div>' +
          '<div class="org-row"><span class="org-label">Quantity</span><span class="org-val">' + (item.quantity !== undefined ? item.quantity : 1) + '</span></div>' +
          (item.amount !== undefined ? '<div class="org-row"><span class="org-label">Item Value</span><span class="org-val">' + (itemFormatted || item.amount) + ' (' + escapeHtml(item.currency || params.currency || 'USD') + ')</span></div>' : '') +
          '</div>';
      });

      html += '</div></div>';
    }

    // 5. Customer Matching
    const matchFields = userInfo?.fields || [];
    html += '<div class="org-section">' +
      '<div class="org-section-header">' +
      '<span class="org-section-title">4. Customer Matching (Advanced Matching)</span>' +
      '<span class="badge badge-neutral">' + matchFields.length + ' Detected</span>' +
      '</div>' +
      '<div class="org-explanation">Hashed user identifiers enabling conversion attribution without exposing raw PII.</div>' +
      '<div class="org-grid">';

    if (matchFields.length > 0) {
      matchFields.forEach(f => {
        html += '<div class="org-row">' +
          '<span class="org-label">' + escapeHtml(f.label) + ' (' + escapeHtml(f.source) + ')</span>' +
          '<span class="org-val text-emerald">' + (f.isHashed ? '✓ Hashed: ' + escapeHtml(f.masked) : escapeHtml(f.masked)) + '</span>' +
          '</div>';
      });
    } else {
      html += '<div style="font-size:11.5px; color:var(--text-muted); padding:4px 0;">No user matching identifiers sent with this event.</div>';
    }
    html += '</div></div>';

    // 6. Privacy
    const hasRawEmail = JSON.stringify(params).includes('@');
    html += '<div class="org-section">' +
      '<div class="org-section-header">' +
      '<span class="org-section-title">5. Privacy & Hashing Verification</span>' +
      (hasRawEmail ? '<span class="badge badge-error">✕ Raw PII Alert</span>' : '<span class="badge badge-success">✓ Clean</span>') +
      '</div>' +
      '<div class="org-grid">' +
      '<div class="org-row"><span class="org-label">Raw Email Sent in Payload</span><span class="org-val ' + (hasRawEmail ? 'text-rose font-bold' : 'text-emerald') + '">' + (hasRawEmail ? '✕ Raw Email Detected!' : '✓ Not detected (Clean)') + '</span></div>' +
      '<div class="org-row"><span class="org-label">Hashed Protection</span><span class="org-val text-emerald">' + (matchFields.some(f => f.isHashed) ? '✓ SHA-256 Hashed Identifiers' : 'No identifiers in this event') + '</span></div>' +
      '</div>' +
      '</div>';

    // 7. Validation
    const findings = val.findings || [];
    html += '<div class="org-section">' +
      '<div class="org-section-header">' +
      '<span class="org-section-title">6. Validation Diagnostics</span>' +
      '<span class="badge ' + (val.errorsCount > 0 ? 'badge-error' : (val.warningsCount > 0 ? 'badge-warning' : 'badge-success')) + '">' +
      val.errorsCount + ' Errors, ' + val.warningsCount + ' Warnings' +
      '</span>' +
      '</div>' +
      '<div class="org-grid">';

    if (findings.length > 0) {
      findings.forEach(find => {
        html += '<div style="padding:6px 0; border-bottom:1px solid var(--border-subtle);">' +
          '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">' +
          '<strong style="font-size:11.5px; color:var(--text-main);">' + escapeHtml(find.title) + '</strong>' +
          renderStatusBadge(find.severity, find.severity.toUpperCase()) +
          '</div>' +
          '<div style="font-size:11px; color:var(--text-secondary); margin-bottom:2px;">' + escapeHtml(find.message) + '</div>' +
          (find.recommendedFix ? '<div style="font-size:10.5px; color:var(--accent-brand);">Fix: ' + escapeHtml(find.recommendedFix) + '</div>' : '') +
          '</div>';
      });
    } else {
      html += '<div style="font-size:11.5px; color:var(--status-success); padding:4px 0;">✓ All schema rules and consistency checks passed successfully.</div>';
    }
    html += '</div></div>';

    return html;
  }

  function attachEventBodyListeners(container, evt) {
    const btnCopyInline = container.querySelector('.btn-copy-raw-inline');
    if (btnCopyInline) {
      btnCopyInline.addEventListener('click', () => {
        copyToClipboard(evt.rawEvent || evt, btnCopyInline);
      });
    }
  }

  // 3. Network Requests Tab
  function renderNetworkRequests() {
    if (!networkRequestsContainer) return;
    const s = currentTabState;
    const reqs = s?.network || [];

    if (networkRequestsBadge) {
      networkRequestsBadge.textContent = reqs.length + ' Requests';
    }

    if (reqs.length === 0) {
      networkRequestsContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.code + '</div><div class="empty-title">No Network Requests Captured</div><div class="empty-desc">Outgoing network requests to OpenAI Pixel endpoints will appear here.</div></div>';
      return;
    }

    networkRequestsContainer.innerHTML = '';

    reqs.forEach((req, idx) => {
      const card = document.createElement('div');
      card.className = 'net-req-card';
      const isExpanded = expandedNetReqIds.has(req.requestId || idx);
      const payload = req.payload || {};
      const events = Array.isArray(payload.events) ? payload.events : [];
      const user = payload.user || {};
      const statusClass = req.status >= 200 && req.status < 300 ? 'badge-success' : (req.status === 'pending' ? 'badge-neutral' : 'badge-error');

      card.innerHTML = '<div class="net-req-header" data-reqid="' + (req.requestId || idx) + '">' +
        '<div style="display:flex; align-items:center; gap:8px;">' +
        '<span class="net-req-method">' + escapeHtml(req.method || 'POST') + '</span>' +
        '<span class="net-req-url" title="' + escapeHtml(req.url) + '">' + escapeHtml(req.url) + '</span>' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:6px;">' +
        '<span class="badge ' + statusClass + '">' + (req.status || 200) + '</span>' +
        '<span class="mono text-muted" style="font-size:11px;">' + formatTimestamp(req.timestamp) + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="net-req-body" style="display: ' + (isExpanded ? 'block' : 'none') + ';">' +
        '<div style="margin-bottom:8px;">' +
        '<strong style="font-size:11.5px; color:var(--text-secondary);">Batched Events (' + events.length + '):</strong>' +
        '<div style="margin-top:4px;">' +
        events.map(e => '<span class="net-event-chip">' + escapeHtml(e.type || 'event') + '</span>').join('') +
        '</div>' +
        '</div>' +
        '<div class="org-grid" style="margin-bottom:8px; padding:6px 0;">' +
        '<div class="org-row"><span class="org-label">Browser Ref (obref)</span><span class="org-val">' + escapeHtml(payload.obref || 'None') + '</span></div>' +
        '<div class="org-row"><span class="org-label">User Matching Envelope</span><span class="org-val">' + (Object.keys(user).length > 0 ? '✓ Present' : 'None') + '</span></div>' +
        '</div>' +
        '<button class="btn btn-secondary btn-inspect-net-raw" style="width:100%; font-size:11.5px; padding:5px;">Inspect Raw Request Envelope</button>' +
        '</div>';

      const header = card.querySelector('.net-req-header');
      header.addEventListener('click', () => {
        const id = req.requestId || idx;
        if (expandedNetReqIds.has(id)) {
          expandedNetReqIds.delete(id);
        } else {
          expandedNetReqIds.add(id);
        }
        renderNetworkRequests();
      });

      const btnInspectRaw = card.querySelector('.btn-inspect-net-raw');
      if (btnInspectRaw) {
        btnInspectRaw.addEventListener('click', (e) => {
          e.stopPropagation();
          openEventModal({
            name: 'Network Request Envelope',
            displayName: 'REQUEST #' + (idx + 1) + ' (' + (req.method || 'POST') + ')',
            timestamp: req.timestamp,
            rawEvent: req.payload || req
          });
        });
      }

      networkRequestsContainer.appendChild(card);
    });
  }

  // 4. Funnel Tab
  function renderFunnel() {
    if (!funnelPipelineContainer) return;
    const s = currentTabState;
    const events = s?.events || [];

    const FUNNEL_STEPS = [
      { name: 'contents_viewed', label: '1. Product View', desc: 'Visitor viewed product details' },
      { name: 'items_added', label: '2. Add to Cart', desc: 'Item added to shopping cart' },
      { name: 'checkout_started', label: '3. Checkout Begin', desc: 'Initiated checkout flow' },
      { name: 'order_created', label: '4. Purchase / Order', desc: 'Completed purchase conversion' }
    ];

    let observedCount = 0;
    funnelPipelineContainer.innerHTML = '';

    FUNNEL_STEPS.forEach((step) => {
      const match = events.find(e => e.name === step.name);
      const isObserved = Boolean(match);
      if (isObserved) observedCount++;

      const stepCard = document.createElement('div');
      stepCard.className = 'funnel-step-card ' + (isObserved ? 'observed' : 'missing');
      stepCard.style.cssText = 'background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 14px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;';

      const amountFormatted = match ? formatMonetaryValue(match.parameters?.amount, match.parameters?.currency) : null;

      stepCard.innerHTML = '<div>' +
        '<div style="font-weight:700; font-size:12.5px; color:var(--text-main);">' + step.label + '</div>' +
        '<div style="font-size:11px; color:var(--text-muted);">' + step.desc + '</div>' +
        (amountFormatted ? '<div style="font-size:11px; color:var(--accent-brand); font-weight:600; margin-top:2px;">Value: ' + amountFormatted + '</div>' : '') +
        '</div>' +
        '<div>' +
        (isObserved 
          ? '<span class="badge badge-success">✓ Observed in session</span>' 
          : '<span class="badge badge-neutral" title="Not observed in this debugging session">✕ Not observed</span>') +
        '</div>';

      funnelPipelineContainer.appendChild(stepCard);
    });

    const completionRate = Math.round((observedCount / FUNNEL_STEPS.length) * 100);
    if (funnelRateBadge) {
      funnelRateBadge.textContent = observedCount + '/' + FUNNEL_STEPS.length + ' Completed (' + completionRate + '%)';
      funnelRateBadge.className = observedCount > 0 ? 'badge badge-success' : 'badge badge-neutral';
    }
    if (tabCountFunnel) {
      tabCountFunnel.textContent = observedCount + '/' + FUNNEL_STEPS.length;
    }
  }

  // 5. Timeline Tab
  function renderTimeline() {
    if (!timelineContainer) return;
    const s = currentTabState;
    const events = s?.events || [];

    if (timelineStepsBadge) {
      timelineStepsBadge.textContent = events.length + ' Steps';
    }

    if (events.length === 0) {
      timelineContainer.innerHTML = '<div class="empty-state"><div class="empty-icon">' + ICONS.code + '</div><div class="empty-title">No Session Activity Recorded</div><div class="empty-desc">Chronological journey timeline will populate as actions occur.</div></div>';
      return;
    }

    let html = '<div class="timeline-track">';
    let prevTime = events[0].timestamp;

    events.forEach((evt, idx) => {
      const diffMs = evt.timestamp - prevTime;
      prevTime = evt.timestamp;
      const timeStr = formatTimestamp(evt.timestamp);
      const amount = formatMonetaryValue(evt.parameters?.amount, evt.parameters?.currency);

      html += '<div class="timeline-item">' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-item-header">' +
        '<span>Step #' + (idx + 1) + ' • ' + timeStr + '</span>' +
        (idx > 0 ? '<span>+' + diffMs + 'ms</span>' : '<span>Session Start</span>') +
        '</div>' +
        '<div class="timeline-item-card">' +
        (evt.pathname ? '<div class="timeline-page-badge">' + escapeHtml(evt.pathname) + '</div>' : '') +
        '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<strong style="font-size:12px; color:var(--text-main);">' + escapeHtml(evt.displayName || evt.name) + '</strong>' +
        renderStatusBadge(evt.validation?.status || 'valid', evt.validation?.status?.toUpperCase()) +
        '</div>' +
        (amount ? '<div style="font-size:11px; color:var(--accent-brand); font-weight:600; margin-top:2px;">' + amount + '</div>' : '') +
        '</div>' +
        '</div>';
    });

    html += '</div>';
    timelineContainer.innerHTML = html;
  }

  // 6. Matching & Privacy Tab
  function renderMatchingAndPrivacy() {
    if (!matchingDetailsContainer || !privacyInspectorContainer) return;
    const s = currentTabState;
    const uMatch = s?.userMatching || (s?.networkSummary ? s.networkSummary.latestUserMatching : null);
    const fields = uMatch?.fields || [];

    if (matchingCoverageBadge) {
      const hasEmail = fields.some(f => f.type === 'email');
      const hasPhone = fields.some(f => f.type === 'phone');
      const hasEid = fields.some(f => f.type === 'external_id');
      const hasGeo = fields.some(f => f.type === 'country' || f.type === 'region');

      if (hasEmail && (hasPhone || hasEid)) {
        matchingCoverageBadge.className = 'badge badge-success';
        matchingCoverageBadge.textContent = 'Strong Coverage';
      } else if (hasEmail || hasPhone || hasEid) {
        matchingCoverageBadge.className = 'badge badge-info';
        matchingCoverageBadge.textContent = 'Moderate Coverage';
      } else if (hasGeo) {
        matchingCoverageBadge.className = 'badge badge-warning';
        matchingCoverageBadge.textContent = 'Limited (Geo Only)';
      } else {
        matchingCoverageBadge.className = 'badge badge-neutral';
        matchingCoverageBadge.textContent = 'No Identifiers';
      }
    }

    if (fields.length > 0) {
      let html = '<div class="org-grid">';
      fields.forEach(f => {
        html += '<div class="org-row">' +
          '<span class="org-label">' + escapeHtml(f.label) + ' (' + escapeHtml(f.source) + ')</span>' +
          '<span class="org-val text-emerald">' + (f.isHashed ? '✓ ' + escapeHtml(f.masked) : escapeHtml(f.masked)) + '</span>' +
          '</div>';
      });
      html += '</div>';
      matchingDetailsContainer.innerHTML = html;
    } else {
      matchingDetailsContainer.innerHTML = '<div class="empty-state-sm">No advanced matching user identifiers detected in this session yet.</div>';
    }

    // Privacy Inspector
    const allEvtsStr = JSON.stringify(s?.events || []);
    const hasRawEmail = allEvtsStr.includes('@');
    const hasRawPhone = /"phone":\s*"\+?[0-9]{8,15}"/i.test(allEvtsStr);

    privacyInspectorContainer.innerHTML = '<div class="privacy-item">' +
      '<span>Protected Hashed Identifiers</span>' +
      '<span class="privacy-status-pass">' + (fields.some(f => f.isHashed) ? '✓ Detected SHA-256' : 'Not sent') + '</span>' +
      '</div>' +
      '<div class="privacy-item">' +
      '<span>Raw Email in Network Payload</span>' +
      '<span class="' + (hasRawEmail ? 'privacy-status-alert' : 'privacy-status-pass') + '">' + (hasRawEmail ? '✕ Raw Email Exposed!' : '✓ Clean (Not detected)') + '</span>' +
      '</div>' +
      '<div class="privacy-item">' +
      '<span>Raw Phone in Network Payload</span>' +
      '<span class="' + (hasRawPhone ? 'privacy-status-alert' : 'privacy-status-pass') + '">' + (hasRawPhone ? '✕ Raw Phone Exposed!' : '✓ Clean (Not detected)') + '</span>' +
      '</div>';
  }

  // 7. Data Layer
  function renderDataLayer() {
    if (!datalayerListContainer) return;
    const s = currentTabState;
    const dl = s?.dataLayer || [];

    if (gtmContainerBadge && gtmContainerPills) {
      const gtm = s?.gtmContainers || [];
      if (gtm.length > 0) {
        gtmContainerBadge.className = 'badge badge-success';
        gtmContainerBadge.textContent = gtm.length + ' Active';
        gtmContainerPills.innerHTML = gtm.map(id => '<span class="badge badge-info mono">' + escapeHtml(id) + '</span>').join(' ');
      } else {
        gtmContainerBadge.className = 'badge badge-neutral';
        gtmContainerBadge.textContent = 'None detected';
        gtmContainerPills.innerHTML = '<span class="text-muted" style="font-size:11.5px;">No GTM containers found</span>';
      }
    }

    if (dl.length === 0) {
      datalayerListContainer.innerHTML = '<div class="empty-state-sm">No dataLayer.push events recorded.</div>';
      return;
    }

    datalayerListContainer.innerHTML = '';
    dl.forEach((item) => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:6px 0; border-bottom:1px solid var(--border-subtle); font-size:11.5px;';
      row.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center;">' +
        '<strong class="mono text-emerald">' + escapeHtml(item.event || 'push') + '</strong>' +
        '<span class="text-muted mono">' + formatTimestamp(item.timestamp) + '</span>' +
        '</div>';
      datalayerListContainer.appendChild(row);
    });
  }

  // 8. Attribution
  function renderAttribution() {
    const s = currentTabState;
    const attr = s?.attribution || {};

    if (opprefStatusBadge) {
      if (attr.oppref) {
        opprefStatusBadge.className = 'badge badge-success';
        opprefStatusBadge.textContent = 'Detected ✓';
      } else {
        opprefStatusBadge.className = 'badge badge-neutral';
        opprefStatusBadge.textContent = 'Not detected';
      }
    }

    if (attrUrlVal) attrUrlVal.textContent = attr.details?.urlParam || 'Not found';
    if (attrCookieVal) attrCookieVal.textContent = attr.details?.cookieValue || 'Not found';
    if (attrStorageVal) attrStorageVal.textContent = attr.details?.localStorage || 'Not found';
    if (attrActiveKey) attrActiveKey.textContent = attr.oppref || 'None';
  }

  // 9. Issues
  function renderIssues() {
    if (!issuesListContainer) return;
    const s = currentTabState;
    const events = s?.events || [];

    const allIssues = [];
    events.forEach(e => {
      if (e.validation?.findings) {
        e.validation.findings.forEach(f => allIssues.push(f));
      }
    });

    const errorCount = allIssues.filter(i => i.severity === 'error' || i.severity === 'critical').length;
    const warnCount = allIssues.filter(i => i.severity === 'warning').length;
    const infoCount = allIssues.filter(i => i.severity === 'info').length;

    if (issueFilterCountAll) issueFilterCountAll.textContent = allIssues.length;
    if (issueFilterCountError) issueFilterCountError.textContent = errorCount;
    if (issueFilterCountWarning) issueFilterCountWarning.textContent = warnCount;
    if (issueFilterCountInfo) issueFilterCountInfo.textContent = infoCount;

    if (issuesStatusBadge) {
      if (errorCount > 0) {
        issuesStatusBadge.className = 'badge badge-error';
        issuesStatusBadge.textContent = errorCount + ' Critical';
      } else if (warnCount > 0) {
        issuesStatusBadge.className = 'badge badge-warning';
        issuesStatusBadge.textContent = warnCount + ' Warnings';
      } else {
        issuesStatusBadge.className = 'badge badge-success';
        issuesStatusBadge.textContent = '0 Issues ✓';
      }
    }

    const filteredIssues = allIssues.filter(i => {
      if (currentIssueFilter === 'error') return i.severity === 'error' || i.severity === 'critical';
      if (currentIssueFilter === 'warning') return i.severity === 'warning';
      if (currentIssueFilter === 'info') return i.severity === 'info';
      return true;
    });

    if (filteredIssues.length === 0) {
      issuesListContainer.innerHTML = '<div class="empty-state"><div class="empty-icon text-emerald">' + ICONS.check + '</div><div class="empty-title">All Checks Passed</div><div class="empty-desc">No tracking or schema issues detected in this session.</div></div>';
      return;
    }

    issuesListContainer.innerHTML = '';
    filteredIssues.forEach(iss => {
      const el = document.createElement('div');
      el.className = 'issue-item-card';
      el.style.cssText = 'background:var(--bg-card); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:10px 12px; margin-bottom:8px;';

      el.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">' +
        '<strong style="font-size:12px; color:var(--text-main);">' + escapeHtml(iss.title) + '</strong>' +
        renderStatusBadge(iss.severity, iss.severity.toUpperCase()) +
        '</div>' +
        '<div style="font-size:11.5px; color:var(--text-secondary); margin-bottom:4px;">' + escapeHtml(iss.message) + '</div>' +
        (iss.recommendedFix ? '<div style="font-size:11px; color:var(--accent-brand); font-weight:500;">Recommended Fix: ' + escapeHtml(iss.recommendedFix) + '</div>' : '');

      issuesListContainer.appendChild(el);
    });
  }

  // 10. Audit Tab
  function renderAudit() {
    if (!auditSummaryBox) return;
    const s = currentTabState;
    if (!s) return;

    let targetWebsite = 'Current Page';
    try {
      if (s.url) targetWebsite = new URL(s.url).hostname;
    } catch {}

    const fullReport = generateComprehensiveAudit(s, targetWebsite);

    if (auditScoreBadge) {
      auditScoreBadge.textContent = fullReport.overallHealthScore + '% Health';
      auditScoreBadge.className = fullReport.overallHealthScore >= 80 ? 'badge badge-success' : 'badge badge-warning';
    }

    if (auditSubtitleWebsite) {
      auditSubtitleWebsite.textContent = targetWebsite + ' | ' + fullReport.auditDate;
    }

    auditSummaryBox.innerHTML = '<div class="audit-summary-box-inner" style="padding:10px 14px; font-size:12px;">' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Total Events:</span><strong>' + fullReport.counts.total + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Standard Events:</span><strong>' + fullReport.counts.standard + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:4px;"><span>Passed:</span><strong class="text-emerald">' + fullReport.counts.passed + '</strong></div>' +
      '<div style="display:flex; justify-content:space-between;"><span>Issues / Warnings:</span><strong class="text-rose">' + (fullReport.counts.warnings + fullReport.counts.critical) + '</strong></div>' +
      '</div>';

    if (auditOverviewTableContainer) {
      let rowsHtml = '';
      (fullReport.overviewTable || []).forEach(row => {
        rowsHtml += '<tr>' +
          '<td style="font-weight:600;">' + escapeHtml(row.name) + '</td>' +
          '<td>' + escapeHtml(row.type) + '</td>' +
          '<td style="text-align:center;">' + row.trigger + '</td>' +
          '<td style="text-align:center;">' + row.parameters + '</td>' +
          '<td style="text-align:center;">' + row.duplicate + '</td>' +
          '<td style="text-align:right;">' + row.status + '</td>' +
          '</tr>';
      });

      auditOverviewTableContainer.innerHTML = '<table class="health-table" style="width:100%; font-size:11.5px;">' +
        '<thead>' +
        '<tr style="color:var(--text-muted); border-bottom:1px solid var(--border-color);">' +
        '<th>Event</th>' +
        '<th>Type</th>' +
        '<th style="text-align:center;">Trigger</th>' +
        '<th style="text-align:center;">Params</th>' +
        '<th style="text-align:center;">Duplicate</th>' +
        '<th style="text-align:right;">Status</th>' +
        '</tr>' +
        '</thead>' +
        '<tbody>' + (rowsHtml || '<tr><td colspan="6" class="text-muted">No events tracked</td></tr>') + '</tbody>' +
        '</table>';
    }

    if (auditScoresGrid) {
      const sc = fullReport.scores || {};
      auditScoresGrid.innerHTML = '<div class="score-card-item"><span>Payload Quality:</span> <strong>' + (sc.payloadQuality || 100) + '%</strong></div>' +
        '<div class="score-card-item"><span>Ecommerce Data:</span> <strong>' + (sc.ecommerceData || 100) + '%</strong></div>' +
        '<div class="score-card-item"><span>Duplicate Prevention:</span> <strong>' + (sc.duplicatePrevention || 100) + '%</strong></div>';
    }

    if (btnCopyMarkdown) {
      btnCopyMarkdown.onclick = () => {
        const md = formatAuditMarkdown(fullReport);
        copyToClipboard(md, btnCopyMarkdown);
      };
    }

    if (btnExportCsv) {
      btnExportCsv.onclick = () => {
        const csv = formatAuditCsv(fullReport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'openai-pixel-audit-' + targetWebsite + '-' + Date.now() + '.csv';
        a.click();
      };
    }

    if (btnExportPdf) {
      btnExportPdf.onclick = () => {
        chrome.storage.local.set({ active_audit_report: fullReport }, () => {
          chrome.tabs.create({ url: chrome.runtime.getURL('popup/report.html') });
        });
      };
    }
  }

  loadActiveTabState();
});
