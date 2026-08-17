/**
 * OpenAI Ads Pixel Inspector - Popup Controller (Full Buildout)
 */

import { formatTimestamp, escapeHtml, truncateString } from '../utils/formatting.js';
import { generateAuditReport } from '../core/scanner.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation elements
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const targetHostEl = document.getElementById('target-host');
  const badgeTabIdEl = document.getElementById('badge-tab-id');
  const btnRefresh = document.getElementById('btn-refresh');
  const btnClear = document.getElementById('btn-clear');

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
  const valPixelInit = document.getElementById('val-pixel-init');
  const valOppref = document.getElementById('val-oppref');

  const metricTotalEvents = document.getElementById('metric-total-events');
  const metricStandardEvents = document.getElementById('metric-standard-events');
  const metricCustomEvents = document.getElementById('metric-custom-events');
  const metricIssuesEvents = document.getElementById('metric-issues-events');
  const latestEventContent = document.getElementById('latest-event-content');
  const latestEventTime = document.getElementById('latest-event-time');

  const tabCountEvents = document.getElementById('tab-count-events');
  const tabCountIssues = document.getElementById('tab-count-issues');

  // Events Tab elements
  const eventSearchInput = document.getElementById('event-search-input');
  const filterChips = document.querySelectorAll('.filter-chip');
  const eventsListContainer = document.getElementById('events-list-container');

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

  // 1. Tab Switching
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      navTabs.forEach((t) => t.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const targetPane = document.getElementById(`pane-${tab.dataset.tab}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // 2. Filter Chips
  filterChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      filterChips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderEvents();
    });
  });

  // 3. Search Input
  eventSearchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderEvents();
  });

  // 4. Modal Handling
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

  // 5. Node Status Helper
  function setNodeStatus(nodeEl, textEl, isConnected, text) {
    if (!nodeEl || !textEl) return;
    nodeEl.classList.remove('node-connected', 'node-disconnected');
    nodeEl.classList.add(isConnected ? 'node-connected' : 'node-disconnected');
    textEl.textContent = text;
  }

  // 6. Fetch Active Tab and Diagnostics
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

    // Query service worker
    try {
      const bgResp = await chrome.runtime.sendMessage({ action: 'PING_BACKGROUND' });
      if (bgResp && bgResp.status === 'ok') {
        setNodeStatus(nodeWorker, workerStatusText, true, 'Active');
      }
    } catch {
      setNodeStatus(nodeWorker, workerStatusText, false, 'Offline');
    }

    // Query content script
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

  // 7. Render All Views
  function renderAll() {
    if (!currentTabState) return;

    renderOverview();
    renderEvents();
    renderAttribution();
    renderIssues();
    renderAudit();
  }

  function renderOverview() {
    const pixel = currentTabState.pixel || {};
    const attribution = currentTabState.attribution || {};
    const stats = currentTabState.stats || {};
    const events = currentTabState.events || [];

    // Summary Card
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
    valPixelInit.textContent = pixel.initialized ? '✅ Initialized' : (pixel.detected ? '⚠️ Pending init' : 'Not initialized');
    valOppref.textContent = attribution.oppref ? `✅ ${truncateString(attribution.oppref, 18)}` : '⚠️ Not detected';

    // Metrics
    metricTotalEvents.textContent = stats.totalEvents || 0;
    metricStandardEvents.textContent = stats.standardEvents || 0;
    metricCustomEvents.textContent = stats.customEvents || 0;
    metricIssuesEvents.textContent = stats.errorEvents || 0;

    tabCountEvents.textContent = stats.totalEvents || 0;
    tabCountIssues.textContent = stats.errorEvents || 0;

    // Latest Event
    if (events.length > 0) {
      const latest = events[events.length - 1];
      latestEventTime.textContent = formatTimestamp(latest.timestamp);
      latestEventContent.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span class="event-badge-type ${latest.validation.isCustom ? 'event-badge-custom' : 'event-badge-std'}">
              ${latest.validation.isCustom ? 'Custom' : 'Standard'}
            </span>
            <strong>${escapeHtml(latest.name)}</strong>
          </div>
          <span class="badge ${latest.validation.status === 'valid' ? 'badge-success' : (latest.validation.status === 'warning' ? 'badge-warning' : 'badge-error')}">
            ${latest.validation.status.toUpperCase()}
          </span>
        </div>
        <div style="font-size: 11px; font-family: monospace; color: var(--text-secondary); margin-top: 6px;">
          ${Object.keys(latest.parameters).length} parameter(s) sent • ID: ${escapeHtml(truncateString(latest.eventId, 14))}
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

    // Filter and search
    const filtered = events.filter((evt) => {
      if (currentFilter === 'standard' && evt.validation.isCustom) return false;
      if (currentFilter === 'custom' && !evt.validation.isCustom) return false;
      if (currentFilter === 'errors' && evt.validation.status !== 'error') return false;
      if (currentFilter === 'warnings' && evt.validation.status !== 'warning') return false;
      if (currentFilter === 'network' && !evt.network.detected) return false;

      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = evt.name.toLowerCase().includes(q);
        const idMatch = (evt.eventId || '').toLowerCase().includes(q);
        const paramsMatch = JSON.stringify(evt.parameters).toLowerCase().includes(q);
        return nameMatch || idMatch || paramsMatch;
      }
      return true;
    });

    if (filtered.length === 0) {
      eventsListContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📡</span>
          <p class="empty-text">No matching OpenAI Pixel events observed.</p>
          <span class="empty-subtext">Trigger tracking actions on the page to view</span>
        </div>
      `;
      return;
    }

    eventsListContainer.innerHTML = '';
    filtered.slice().reverse().forEach((evt, idx) => {
      const item = document.createElement('div');
      item.className = 'event-item';

      const isCustom = evt.validation.isCustom;
      const statusClass = evt.validation.status === 'valid' ? 'badge-success' : (evt.validation.status === 'warning' ? 'badge-warning' : 'badge-error');

      // Build Parameter Table Rows
      let paramRows = '';
      const params = evt.parameters || {};
      for (const [key, val] of Object.entries(params)) {
        const valRes = (evt.validation.parameterResults && evt.validation.parameterResults[key]) || {};
        const paramStatusBadge = valRes.valid ? '<span style="color:var(--color-emerald)">✓</span>' : (valRes.severity === 'warning' ? '<span style="color:var(--color-amber)">⚠</span>' : '<span style="color:var(--color-rose)">✗</span>');
        const displayVal = typeof val === 'object' ? JSON.stringify(val) : escapeHtml(String(val));

        paramRows += `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${displayVal}</td>
            <td style="text-align:right;">${paramStatusBadge}</td>
          </tr>
        `;
      }

      if (Object.keys(params).length === 0) {
        paramRows = '<tr><td colspan="3" style="color:var(--text-muted); text-align:center;">No parameters passed</td></tr>';
      }

      // Lifecycle status chips
      const firedChip = '<span class="chip-status chip-ok">JS Fired ✓</span>';
      const netSentChip = evt.network.detected ? '<span class="chip-status chip-ok">POST Sent ✓</span>' : '<span class="chip-status chip-neutral">Network --</span>';
      const netStatusChip = evt.network.status ? `<span class="chip-status ${evt.network.status === 200 ? 'chip-ok' : 'chip-err'}">HTTP ${evt.network.status}</span>` : '';
      const validationChip = `<span class="chip-status ${evt.validation.status === 'valid' ? 'chip-ok' : (evt.validation.status === 'warning' ? 'chip-warn' : 'chip-err')}">Validation: ${evt.validation.status.toUpperCase()}</span>`;

      item.innerHTML = `
        <div class="event-header">
          <div class="event-name-group">
            <span class="event-badge-type ${isCustom ? 'event-badge-custom' : 'event-badge-std'}">
              ${isCustom ? 'Custom' : 'Standard'}
            </span>
            <span class="event-name">${escapeHtml(evt.name)}</span>
          </div>
          <div class="event-meta-group">
            <span class="badge ${statusClass}">${evt.validation.status}</span>
            <span class="event-time">${formatTimestamp(evt.timestamp)}</span>
          </div>
        </div>
        <div class="event-details-drawer">
          <div class="lifecycle-chips">
            ${firedChip}
            ${netSentChip}
            ${netStatusChip}
            ${validationChip}
          </div>
          <div style="margin-bottom:6px; color:var(--text-secondary); font-size:10px;">
            <strong>Event ID:</strong> <code>${escapeHtml(evt.eventId || 'None')}</code>
            ${evt.pixelId ? ` | <strong>Pixel:</strong> <code>${escapeHtml(evt.pixelId)}</code>` : ''}
          </div>
          <table class="param-table">
            <thead>
              <tr><th>Parameter</th><th>Value</th><th style="text-align:right;">Valid</th></tr>
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

      // Toggle drawer accordion
      const header = item.querySelector('.event-header');
      header.addEventListener('click', () => {
        item.classList.toggle('open');
      });

      // Raw button
      const rawBtn = item.querySelector('.btn-inspect-raw');
      rawBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRawModal(`Event: ${evt.name}`, evt);
      });

      eventsListContainer.appendChild(item);
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
          <p class="empty-text">No implementation issues or warnings found!</p>
          <span class="empty-subtext">All parameters and tracking calls match specifications.</span>
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
      auditScoreBadge.textContent = 'Warnings Found';
      auditScoreBadge.className = 'badge badge-warning';
    } else {
      auditScoreBadge.textContent = 'Errors Detected';
      auditScoreBadge.className = 'badge badge-error';
    }

    auditSummaryBox.innerHTML = `
      <div><strong>Target Host:</strong> ${escapeHtml(report.hostname || 'Unknown')}</div>
      <div><strong>Pixel SDK Installed:</strong> ${report.scores.pixelInstalled ? '✅ Yes' : '❌ No'}</div>
      <div><strong>Pixel Initialized:</strong> ${report.scores.initialized ? '✅ Yes' : '⚠️ No'}</div>
      <div><strong>Attribution (oppref):</strong> ${report.scores.opprefPresent ? '✅ Detected' : '⚠️ Missing'}</div>
      <div><strong>Total Events Captured:</strong> ${report.scores.totalEvents} (${report.scores.standardEvents} Standard, ${report.scores.customEvents} Custom)</div>
      <div><strong>Issues Count:</strong> ${report.issues.length} (${report.scores.errorEvents} errors, ${report.scores.warningEvents} warnings)</div>
    `;
  }

  // 8. Actions (Clear, Rescan, Export)
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
      await chrome.runtime.sendMessage({ action: 'CLEAR_TAB_STATE', tabId: activeTab.id });
      await updateState();
    }
  });

  btnCopyMarkdown.addEventListener('click', () => {
    if (!currentTabState) return;
    const report = generateAuditReport(currentTabState);
    const md = [
      `# OpenAI Ads Pixel Audit Report`,
      `**Website:** ${report.hostname || report.website}`,
      `**Generated:** ${report.generatedAt}`,
      `**Status:** ${report.overallStatus.toUpperCase()}`,
      ``,
      `## 1. Pixel & Attribution`,
      `- **Pixel Installed:** ${report.scores.pixelInstalled ? 'Yes' : 'No'}`,
      `- **Pixel ID(s):** ${(report.scores.pixelIds || []).join(', ') || 'None'}`,
      `- **Initialized:** ${report.scores.initialized ? 'Yes' : 'No'}`,
      `- **oppref Detected:** ${report.scores.opprefPresent ? 'Yes' : 'No'}`,
      ``,
      `## 2. Event Summary`,
      `- **Total Events:** ${report.scores.totalEvents}`,
      `- **Standard Events:** ${report.scores.standardEvents}`,
      `- **Custom Events:** ${report.scores.customEvents}`,
      `- **Valid Events:** ${report.scores.validEvents}`,
      `- **Warnings:** ${report.scores.warningEvents}`,
      `- **Errors:** ${report.scores.errorEvents}`,
      ``,
      `## 3. Issues & Recommendations`,
      report.issues.length === 0 ? `*No issues found.*` : report.issues.map((i) => `- **[${i.severity.toUpperCase()}] ${i.code}**: ${i.message}\n  *Recommendation:* ${i.recommendation || 'N/A'}`).join('\n')
    ].join('\n');

    navigator.clipboard.writeText(md);
    btnCopyMarkdown.textContent = '✅ Copied to Clipboard!';
    setTimeout(() => { btnCopyMarkdown.innerHTML = '<span>📋 Copy Markdown Report</span>'; }, 2000);
  });

  btnExportJson.addEventListener('click', () => {
    if (!currentTabState) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentTabState, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `openai_pixel_audit_${Date.now()}.json`);
    dlAnchor.click();
  });

  btnExportCsv.addEventListener('click', () => {
    if (!currentTabState || !currentTabState.events) return;
    const rows = [
      ['Timestamp', 'Event Name', 'Type', 'Pixel ID', 'Event ID', 'Validation Status', 'Amount', 'Currency', 'oppref']
    ];
    for (const evt of currentTabState.events) {
      rows.push([
        new Date(evt.timestamp).toISOString(),
        `"${evt.name}"`,
        evt.validation.isCustom ? 'Custom' : 'Standard',
        `"${evt.pixelId || ''}"`,
        `"${evt.eventId || ''}"`,
        evt.validation.status,
        evt.parameters.amount !== undefined ? evt.parameters.amount : '',
        evt.parameters.currency || '',
        `"${evt.attribution.oppref || ''}"`
      ]);
    }
    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(rows.map((e) => e.join(',')).join('\n'));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', csvContent);
    dlAnchor.setAttribute('download', `openai_pixel_events_${Date.now()}.csv`);
    dlAnchor.click();
  });

  // Initial Load and Polling interval
  await updateState();
  setInterval(updateState, 1500);
});
