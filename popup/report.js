document.addEventListener('DOMContentLoaded', () => {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['active_audit_report'], (res) => {
      if (res && res.active_audit_report) {
        renderFullReport(res.active_audit_report);
      }
    });
  }
});

function renderFullReport(rep) {
  document.getElementById('rep-meta').textContent = rep.website + ' • ' + rep.auditDate;
  document.getElementById('rep-score-badge').textContent = rep.overallHealthScore + '% Tracking Health';

  // 1. Summary Grid
  const sumGrid = document.getElementById('rep-summary-grid');
  sumGrid.innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Total Events</div>
      <div class="summary-val">${rep.counts.total} (${rep.counts.standard} Std • ${rep.counts.custom} Cust)</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Event Health</div>
      <div class="summary-val" style="color:var(--status-success);">${rep.counts.passed} Passed • ${rep.counts.warnings} Warnings</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Critical Issues</div>
      <div class="summary-val" style="color:${rep.counts.critical > 0 ? 'var(--status-error)' : 'var(--status-success)'};">${rep.counts.critical} Critical</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Overall Status</div>
      <div class="summary-val">${rep.overallStatus}</div>
    </div>
  `;

  // 2. Overview Table
  const tbody = document.getElementById('rep-overview-tbody');
  tbody.innerHTML = rep.overviewTable.map(r => `
    <tr>
      <td><strong>${r.name}</strong></td>
      <td><span class="badge" style="background:#f1f5f9;">${r.type}</span></td>
      <td style="text-align:center;">${r.trigger}</td>
      <td style="text-align:center;">${r.parameters}</td>
      <td style="text-align:center;">${r.duplicate}</td>
      <td><span class="badge ${r.severity === 'valid' ? 'badge-pass' : (r.severity === 'warning' ? 'badge-warn' : 'badge-error')}">${r.status}</span></td>
    </tr>
  `).join('');

  // 3. Scores Grid
  const scoresGrid = document.getElementById('rep-scores-grid');
  scoresGrid.innerHTML = `
    <div class="summary-card"><div class="summary-label">Event Coverage</div><div class="summary-val">${rep.scores.coverage}%</div></div>
    <div class="summary-card"><div class="summary-label">Payload Quality</div><div class="summary-val">${rep.scores.payloadQuality}%</div></div>
    <div class="summary-card"><div class="summary-label">Ecommerce Data</div><div class="summary-val">${rep.scores.ecommerceData}%</div></div>
    <div class="summary-card"><div class="summary-label">Parameter Quality</div><div class="summary-val">${rep.scores.parameterQuality}%</div></div>
  `;

  // 4. Events Container
  const evtsContainer = document.getElementById('rep-events-container');
  evtsContainer.innerHTML = rep.eventDetails.map(evt => `
    <div class="event-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <strong style="font-size:15px;">${evt.name}</strong>
          <span class="badge" style="margin-left:6px; background:#f1f5f9;">${evt.type}</span>
        </div>
        <span class="badge ${evt.severity === 'valid' ? 'badge-pass' : (evt.severity === 'warning' ? 'badge-warn' : 'badge-error')}">${evt.status}</span>
      </div>
      <div style="font-size:12.5px; margin-bottom:6px;">
        <strong>Occurrences:</strong> ${evt.occurrences} • <strong>Trigger:</strong> ${evt.trigger ? '✅ Detected' : '❌ Failed'} • <strong>Duplicate:</strong> ${evt.duplicateCheck ? '✅ Passed' : '❌ Failed'}
      </div>
      <div style="background:#f8fafc; padding:8px; border-left:3px solid var(--accent); font-size:12px; margin-bottom:6px;">
        <strong>Finding:</strong> ${evt.finding}
      </div>
      <div style="background:#f8fafc; padding:8px; border-left:3px solid #3b82f6; font-size:12px;">
        <strong>Recommendation:</strong> ${evt.recommendation}
      </div>
    </div>
  `).join('');

  // 5. Actions Container
  const actContainer = document.getElementById('rep-actions-container');
  actContainer.innerHTML = rep.recommendations.map((rec, i) => `
    <div class="action-step">
      <div class="action-num">${i + 1}</div>
      <div>${rec}</div>
    </div>
  `).join('');
}
