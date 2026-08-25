document.addEventListener('DOMContentLoaded', () => {
  const btnPrint = document.getElementById('btn-print-report');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      window.print();
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['active_audit_report'], (res) => {
      if (res && res.active_audit_report) {
        renderFullReport(res.active_audit_report);
        // Automatically open print/PDF dialog after a brief render delay
        setTimeout(() => {
          window.print();
        }, 600);
      }
    });
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderFullReport(rep) {
  document.getElementById('rep-meta').textContent = rep.website + ' • Audit Date: ' + rep.auditDate;
  document.getElementById('rep-score-badge').innerHTML = rep.overallHealthScore + '% <span style="font-size:12px; font-weight:normal; display:block; color:var(--text-muted);">' + rep.overallStatus + '</span>';

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
  tbody.innerHTML = (rep.overviewTable || []).map(r => `
    <tr>
      <td><strong>${escapeHtml(r.name)}</strong></td>
      <td><span class="badge" style="background:#f1f5f9;">${escapeHtml(r.type)}</span></td>
      <td style="text-align:center;">${r.trigger}</td>
      <td style="text-align:center;">${r.parameters}</td>
      <td style="text-align:center;">${r.duplicate}</td>
      <td style="text-align:right;"><span class="badge ${r.severity === 'valid' ? 'badge-pass' : (r.severity === 'warning' ? 'badge-warn' : 'badge-error')}">${escapeHtml(r.status)}</span></td>
    </tr>
  `).join('') || '<tr><td colspan="6" style="text-align:center; padding:12px;">No events detected yet.</td></tr>';

  // 3. Classification Breakdown
  const classGrid = document.getElementById('rep-class-grid');
  const stdCount = rep.counts.standard || 0;
  const custCount = rep.counts.custom || 0;
  classGrid.innerHTML = `
    <div class="summary-card"><div class="summary-label">Standard Events</div><div class="summary-val">${stdCount}</div></div>
    <div class="summary-card"><div class="summary-label">Custom Events</div><div class="summary-val">${custCount}</div></div>
    <div class="summary-card"><div class="summary-label">Passed Events</div><div class="summary-val" style="color:var(--status-success);">${rep.counts.passed}</div></div>
    <div class="summary-card"><div class="summary-label">Event Errors</div><div class="summary-val" style="color:${rep.counts.critical > 0 ? 'var(--status-error)' : 'var(--text-main)'};">${rep.counts.critical}</div></div>
  `;

  // 4 & 5. Dynamic Event Details & Parameters
  const evtsContainer = document.getElementById('rep-events-container');
  if (!rep.eventDetails || rep.eventDetails.length === 0) {
    evtsContainer.innerHTML = '<div style="padding:12px; background:var(--bg-subtle); border-radius:6px;">No event details to inspect.</div>';
  } else {
    evtsContainer.innerHTML = rep.eventDetails.map(evt => {
      let paramsTable = '';
      if (evt.parameters && evt.parameters.length > 0) {
        paramsTable = `
          <table style="margin-top:10px; font-size:11.5px;">
            <thead>
              <tr>
                <th style="width:30%;">Parameter</th>
                <th style="width:40%;">Value</th>
                <th style="width:15%; text-align:center;">Status</th>
                <th style="width:15%;">Note</th>
              </tr>
            </thead>
            <tbody>
              ${evt.parameters.map(p => `
                <tr>
                  <td><code class="mono">${escapeHtml(p.parameter)}</code></td>
                  <td><code class="mono" style="word-break:break-all;">${escapeHtml(p.value)}</code></td>
                  <td style="text-align:center;">${p.status === 'valid' ? '✅ Valid' : (p.status === 'warning' ? '⚠️ Suboptimal' : '❌ Error')}</td>
                  <td>${escapeHtml(p.message || '')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      return `
        <div class="event-card">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div>
              <strong style="font-size:15px;">${escapeHtml(evt.name)}</strong>
              <span class="badge" style="margin-left:6px; background:#f1f5f9;">${escapeHtml(evt.type)}</span>
            </div>
            <span class="badge ${evt.severity === 'valid' ? 'badge-pass' : (evt.severity === 'warning' ? 'badge-warn' : 'badge-error')}">${escapeHtml(evt.status)}</span>
          </div>
          <div style="font-size:12px; color:var(--text-muted); margin-bottom:6px;">
            <strong>Occurrences Detected:</strong> ${evt.occurrences} &bull; <strong>Trigger:</strong> ${evt.trigger ? '✅ Detected' : '❌ Failed'} &bull; <strong>Duplicate Check:</strong> ${evt.duplicateCheck ? '✅ Passed' : '❌ Double firing detected'}
          </div>
          <div class="finding-box">
            <strong>Finding:</strong> ${escapeHtml(evt.finding)}
          </div>
          <div class="rec-box">
            <strong>Recommendation:</strong> ${escapeHtml(evt.recommendation)}
          </div>
          ${paramsTable}
        </div>
      `;
    }).join('');
  }

  // 10. Contents Array Inspection
  const contentsTbody = document.getElementById('rep-contents-tbody');
  let contentsRows = '';
  if (rep.eventDetails) {
    rep.eventDetails.forEach(evt => {
      if (evt.contents && evt.contents.length > 0) {
        evt.contents.forEach(c => {
          contentsRows += `
            <tr>
              <td><strong>${escapeHtml(evt.name)}</strong></td>
              <td>${c.itemIndex}</td>
              <td><code class="mono">${escapeHtml(c.id)}</code></td>
              <td>${escapeHtml(c.name)}</td>
              <td>${c.quantity}</td>
              <td>${c.amount !== null ? c.amount : '-'}</td>
              <td>${escapeHtml(c.currency)}</td>
              <td style="text-align:right;">${c.status === 'valid' ? '✅ Passed' : '❌ Error'}</td>
            </tr>
          `;
        });
      }
    });
  }
  contentsTbody.innerHTML = contentsRows || '<tr><td colspan="8" style="text-align:center; padding:12px;">No contents item objects detected in session events.</td></tr>';

  // 11. Duplicate Inspection Log
  const dupTbody = document.getElementById('rep-duplicates-tbody');
  dupTbody.innerHTML = (rep.eventDetails || []).map(evt => `
    <tr>
      <td><strong>${escapeHtml(evt.name)}</strong></td>
      <td>${evt.occurrences}</td>
      <td>${evt.duplicateCheck ? '✅ No Duplicates' : '❌ Double Firing Flagged'}</td>
      <td>${escapeHtml(evt.finding)}</td>
    </tr>
  `).join('') || '<tr><td colspan="4" style="text-align:center; padding:12px;">No events recorded.</td></tr>';

  // 12. Issues Found
  const issuesContainer = document.getElementById('rep-issues-container');
  let issuesHtml = '';
  if (rep.issues.critical && rep.issues.critical.length > 0) {
    issuesHtml += '<h3 style="font-size:13px; color:#dc2626; margin:10px 0 4px;">🔴 Critical Issues</h3>';
    rep.issues.critical.forEach(iss => {
      issuesHtml += `<div class="issue-item issue-critical"><strong>[${escapeHtml(iss.code)}]</strong> ${escapeHtml(iss.message)} &bull; <em>Fix: ${escapeHtml(iss.recommendation || '')}</em></div>`;
    });
  }
  if (rep.issues.high && rep.issues.high.length > 0) {
    issuesHtml += '<h3 style="font-size:13px; color:#ea580c; margin:10px 0 4px;">🟠 High Issues</h3>';
    rep.issues.high.forEach(iss => {
      issuesHtml += `<div class="issue-item issue-high"><strong>[${escapeHtml(iss.code)}]</strong> ${escapeHtml(iss.message)} &bull; <em>Fix: ${escapeHtml(iss.recommendation || '')}</em></div>`;
    });
  }
  if (rep.issues.warning && rep.issues.warning.length > 0) {
    issuesHtml += '<h3 style="font-size:13px; color:#d97706; margin:10px 0 4px;">🟡 Warnings</h3>';
    rep.issues.warning.forEach(iss => {
      issuesHtml += `<div class="issue-item issue-warn"><strong>[${escapeHtml(iss.code)}]</strong> ${escapeHtml(iss.message)}</div>`;
    });
  }
  if (!issuesHtml) {
    issuesHtml = '<div style="padding:10px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:6px; color:#166534;">✅ Zero tracking issues detected. Implementation is clean and validated!</div>';
  }
  issuesContainer.innerHTML = issuesHtml;

  // 13. Recommended Actions
  const actContainer = document.getElementById('rep-actions-container');
  actContainer.innerHTML = (rep.recommendations || []).map((rec, i) => `
    <div class="action-step">
      <div class="action-num">${i + 1}</div>
      <div>${escapeHtml(rec)}</div>
    </div>
  `).join('') || '<div style="padding:10px; background:var(--bg-subtle); border-radius:6px;">No outstanding action items required.</div>';

  // 14. Scores Grid
  const scoresGrid = document.getElementById('rep-scores-grid');
  scoresGrid.innerHTML = `
    <div class="summary-card"><div class="summary-label">Event Coverage</div><div class="summary-val">${rep.scores.coverage}%</div></div>
    <div class="summary-card"><div class="summary-label">Event Payload Quality</div><div class="summary-val">${rep.scores.payloadQuality}%</div></div>
    <div class="summary-card"><div class="summary-label">Ecommerce Data Quality</div><div class="summary-val">${rep.scores.ecommerceData}%</div></div>
    <div class="summary-card"><div class="summary-label">Parameter Quality</div><div class="summary-val">${rep.scores.parameterQuality}%</div></div>
    <div class="summary-card"><div class="summary-label">Duplicate Prevention</div><div class="summary-val">${rep.scores.duplicatePrevention}%</div></div>
    <div class="summary-card"><div class="summary-label">Custom Event Quality</div><div class="summary-val">${rep.scores.customEventQuality}%</div></div>
  `;
}
