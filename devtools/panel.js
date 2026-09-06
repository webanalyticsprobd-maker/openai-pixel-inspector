/**
 * OpenAI Ads Pixel Inspector - Chrome DevTools Panel Controller
 */

import { parseOpenAINetworkBatch } from '../network/request-parser.js';

let capturedItems = [];
let selectedIndex = -1;
let filterMode = 'all';
let viewMode = 'client';
let searchQuery = '';

const streamList = document.getElementById('dt-stream-list');
const detailPane = document.getElementById('dt-detail-pane');
const searchInput = document.getElementById('filter-search');
const statusText = document.getElementById('dt-status-text');
const counterText = document.getElementById('dt-counter-text');

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

function renderStream() {
  if (!streamList) return;
  streamList.innerHTML = '';

  const filtered = capturedItems.filter(item => {
    if (filterMode === 'errors' && item.validation?.status !== 'error') return false;
    if (filterMode === 'conversion') {
      const n = item.name || item.type || '';
      if (!['page_viewed', 'item_viewed', 'items_added', 'checkout_started', 'order_created', 'lead_submitted'].includes(n)) return false;
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const str = JSON.stringify(item).toLowerCase();
      if (!str.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    streamList.innerHTML = '<div class="dt-empty">No matching OpenAI Pixel requests recorded yet.</div>';
    return;
  }

  filtered.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'dt-row ' + (selectedIndex === idx ? 'selected' : '');

    const status = item.validation?.status || 'valid';
    const badgeClass = status === 'error' ? 'dt-badge-error' : (status === 'warning' ? 'dt-badge-warning' : 'dt-badge-success');
    const eventName = item.name || item.type || 'SDK Event';
    const pixelId = item.pixelId ? (item.pixelId.length > 10 ? item.pixelId.slice(0, 8) + '...' : item.pixelId) : '--';
    const timeStr = formatTime(item.timestamp_ms || item.timestamp);

    row.innerHTML = `
      <div class="col-status"><span class="dt-badge ${badgeClass}">${status}</span></div>
      <div class="col-event"><span class="dt-event-name">${eventName}</span></div>
      <div class="col-pixel">${pixelId}</div>
      <div class="col-time">${timeStr}</div>
    `;

    row.addEventListener('click', () => {
      selectedIndex = idx;
      renderStream();
      renderDetail(item);
    });

    streamList.appendChild(row);
  });

  if (counterText) {
    counterText.textContent = `${capturedItems.length} items recorded`;
  }
}

function renderDetail(item) {
  if (!detailPane) return;
  if (!item) {
    detailPane.innerHTML = '<div class="dt-empty-detail">Select a request or event on the left to inspect.</div>';
    return;
  }

  const eventName = item.name || item.type || 'OpenAI Request';
  const status = item.validation?.status || 'valid';
  const rawPayload = item.rawPayload || item.parameters || item.data || item;

  if (viewMode === 'client') {
    detailPane.innerHTML = `
      <div class="dt-detail-section">
        <div class="dt-section-header">
          <span>Client Explanation: ${eventName}</span>
          <span class="dt-badge ${status === 'error' ? 'dt-badge-error' : 'dt-badge-success'}">${status}</span>
        </div>
        <div class="dt-section-body">
          <div class="dt-human-text">
            <b>What OpenAI Received:</b>
            <p style="margin-top: 4px;">${item.humanExplanation || 'Standard event tracked and received by OpenAI Ads measurement engine.'}</p>
          </div>
          <div class="dt-human-text" style="border-left-color: #38bdf8;">
            <b>Why is this sent?</b>
            <p style="margin-top: 4px;">Enables OpenAI machine learning algorithms to attribute conversions, match active search intent, and optimize ad budget return on investment.</p>
          </div>
        </div>
      </div>
    `;
  } else {
    // Technical View
    detailPane.innerHTML = `
      <div class="dt-detail-section">
        <div class="dt-section-header">
          <span>Technical Parameters & Payload</span>
          <button class="dt-btn" id="btn-copy-json">Copy JSON</button>
        </div>
        <div class="dt-section-body">
          <pre class="dt-code-block">${JSON.stringify(rawPayload, null, 2)}</pre>
        </div>
      </div>
    `;

    detailPane.querySelector('#btn-copy-json')?.addEventListener('click', () => {
      navigator.clipboard.writeText(JSON.stringify(rawPayload, null, 2));
    });
  }
}

// DevTools Network Listener
if (chrome.devtools && chrome.devtools.network) {
  chrome.devtools.network.onRequestFinished.addListener((request) => {
    const url = request.request.url || '';
    if (url.includes('bzr.openai.com') || url.includes('/v1/sdk/events') || url.includes('st=oaiq-web')) {
      let postData = null;
      try {
        if (request.request.postData?.text) {
          postData = JSON.parse(request.request.postData.text);
        }
      } catch {}

      const netEntry = {
        url: url,
        method: request.request.method,
        status: request.response.status,
        timestamp: Date.now(),
        rawPayload: postData
      };

      const parsedBatch = parseOpenAINetworkBatch(netEntry);
      if (parsedBatch.events && parsedBatch.events.length > 0) {
        parsedBatch.events.forEach(evt => {
          capturedItems.unshift(evt);
        });
      } else {
        capturedItems.unshift(netEntry);
      }

      renderStream();
    }
  });
}

// Fetch Initial State from background
function loadInitialState() {
  const inspectedTabId = chrome.devtools?.inspectedWindow?.tabId;
  if (inspectedTabId) {
    chrome.runtime.sendMessage({ action: 'GET_TAB_STATE', tabId: inspectedTabId }, (resp) => {
      if (resp?.state?.events) {
        capturedItems = resp.state.events.slice();
        renderStream();
      }
    });
  }
}

// Event Listeners
searchInput?.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderStream();
});

document.querySelectorAll('.dt-btn[data-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dt-btn[data-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterMode = btn.getAttribute('data-filter');
    renderStream();
  });
});

document.getElementById('btn-dt-client')?.addEventListener('click', () => {
  document.getElementById('btn-dt-client').classList.add('active');
  document.getElementById('btn-dt-technical').classList.remove('active');
  viewMode = 'client';
  if (selectedIndex >= 0) renderDetail(capturedItems[selectedIndex]);
});

document.getElementById('btn-dt-technical')?.addEventListener('click', () => {
  document.getElementById('btn-dt-technical').classList.add('active');
  document.getElementById('btn-dt-client').classList.remove('active');
  viewMode = 'technical';
  if (selectedIndex >= 0) renderDetail(capturedItems[selectedIndex]);
});

document.getElementById('btn-dt-clear')?.addEventListener('click', () => {
  capturedItems = [];
  selectedIndex = -1;
  renderStream();
  renderDetail(null);
});

document.getElementById('btn-dt-refresh')?.addEventListener('click', loadInitialState);

loadInitialState();
