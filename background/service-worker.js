/**
 * OpenAI Ads Pixel Inspector - Background Service Worker (Manifest V3)
 * 
 * Orchestrates normalized state, validation, network request correlation,
 * event stores, badge counts, and popup messaging for all browser tabs.
 * 
 * Includes Browser-level Network Request Observation (chrome.webRequest)
 * and Browser Cookie Jar Inspection (chrome.cookies) to monitor live websites.
 */

import { normalizeEvent } from '../core/normalizer.js';
import { EventStore } from '../core/event-store.js';
import { generateAuditReport } from '../core/scanner.js';
import { parseNetworkPayload, isOpenAINetworkRequest } from '../network/request-parser.js';

const tabStates = new Map();
const tabStores = new Map();
const pendingRequests = new Map(); // requestId -> { tabId, url, method, start, payload }

function getOrCreateTabStore(tabId) {
  if (!tabStores.has(tabId)) {
    tabStores.set(tabId, new EventStore());
  }
  return tabStores.get(tabId);
}

function createDefaultTabState(tabId, url = '', title = '') {
  return {
    tabId: tabId,
    url: url,
    title: title,
    lastUpdated: Date.now(),
    contentScriptActive: false,
    bridgeConnected: false,
    pixel: {
      detected: false,
      pixelIds: [],
      initialized: false,
      confidence: 'none',
      scriptSources: []
    },
    attribution: {
      oppref: null,
      source: null,
      cookieDetected: false,
      urlDetected: false,
      details: {}
    },
    events: [],
    network: [],
    issues: [],
    warnings: [],
    stats: {
      totalEvents: 0,
      standardEvents: 0,
      customEvents: 0,
      validEvents: 0,
      warningEvents: 0,
      errorEvents: 0
    }
  };
}

function getOrCreateTabState(tabId, url = '', title = '') {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, createDefaultTabState(tabId, url, title));
  }
  const state = tabStates.get(tabId);
  if (url) state.url = url;
  if (title) state.title = title;
  return state;
}

function updateBadge(tabId, state) {
  if (!state || typeof chrome.action === 'undefined') return;
  const errCount = state.stats.errorEvents;
  const evtCount = state.stats.totalEvents;

  if (errCount > 0) {
    chrome.action.setBadgeText({ tabId: tabId, text: `${errCount}` });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#ef4444' });
  } else if (evtCount > 0) {
    chrome.action.setBadgeText({ tabId: tabId, text: `${evtCount}` });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#10a37f' });
  } else if (state.pixel.detected) {
    chrome.action.setBadgeText({ tabId: tabId, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: '#3b82f6' });
  } else {
    chrome.action.setBadgeText({ tabId: tabId, text: '' });
  }
}

/**
 * Scan browser cookie jar for __oppref
 */
async function scanBrowserCookiesForTab(tabId, url) {
  if (!url || !url.startsWith('http') || typeof chrome.cookies === 'undefined') return;
  try {
    const cookie = await chrome.cookies.get({ url: url, name: '__oppref' });
    const state = getOrCreateTabState(tabId);
    if (cookie && cookie.value) {
      state.attribution.cookieDetected = true;
      if (!state.attribution.oppref) {
        state.attribution.oppref = decodeURIComponent(cookie.value);
        state.attribution.source = 'cookie';
      }
      state.attribution.details.cookieValue = decodeURIComponent(cookie.value);
      state.attribution.details.expirationDate = cookie.expirationDate;
      state.lastUpdated = Date.now();
      updateBadge(tabId, state);
    }
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] chrome.cookies scan error:', err);
  }
}

// Tab cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  tabStores.delete(tabId);
});

// Navigation listener
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && changeInfo.url) {
    const store = getOrCreateTabStore(tabId);
    store.clear();
    const state = createDefaultTabState(tabId, tab.url, tab.title);
    tabStates.set(tabId, state);
    updateBadge(tabId, state);
    scanBrowserCookiesForTab(tabId, tab.url);
  }
});

// =========================================================================
// Browser-Level Network Monitoring (chrome.webRequest)
// =========================================================================

if (typeof chrome.webRequest !== 'undefined' && chrome.webRequest.onBeforeRequest) {
  // 1. Intercept outgoing request to OpenAI endpoints
  chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
      const { tabId, url, method, requestId, requestBody } = details;
      if (tabId < 0) return; // Background / system requests

      const state = getOrCreateTabState(tabId);
      const store = getOrCreateTabStore(tabId);

      // Check SDK Script Download (bzrcdn.openai.com)
      if (url.includes('bzrcdn.openai.com/sdk/oaiq')) {
        state.pixel.detected = true;
        state.pixel.confidence = 'high';
        if (!state.pixel.scriptSources.includes(url)) {
          state.pixel.scriptSources.push(url);
        }
        state.lastUpdated = Date.now();
        updateBadge(tabId, state);
        return;
      }

      // Check Ingestion Endpoint (bzr.openai.com)
      if (isOpenAINetworkRequest(url)) {
        let parsedPayload = null;
        if (requestBody) {
          if (requestBody.raw && requestBody.raw.length > 0) {
            try {
              const decoder = new TextDecoder('utf-8');
              const str = decoder.decode(requestBody.raw[0].bytes);
              parsedPayload = parseNetworkPayload(str);
            } catch {}
          } else if (requestBody.formData) {
            parsedPayload = requestBody.formData;
          }
        }

        const netEntry = {
          requestId: requestId,
          url: url,
          method: method,
          status: 'pending',
          timestamp: Date.now(),
          payload: parsedPayload,
          source: 'webRequest'
        };

        pendingRequests.set(requestId, {
          tabId: tabId,
          start: Date.now(),
          entry: netEntry
        });

        state.network.push(netEntry);

        // If the request contains an event name not yet captured via JS bridge, add it
        if (parsedPayload && (parsedPayload.name || parsedPayload.event_name || parsedPayload.event)) {
          const evtName = parsedPayload.name || parsedPayload.event_name || parsedPayload.event;
          const normalized = normalizeEvent({
            name: evtName,
            parameters: parsedPayload.properties || parsedPayload.data || parsedPayload,
            event_id: parsedPayload.event_id,
            pixelId: parsedPayload.pixel_id || parsedPayload.pixelId || state.pixel.pixelIds[0] || null,
            timestamp: Date.now(),
            caller: 'network (webRequest)'
          }, {
            pixelId: state.pixel.pixelIds[0] || null,
            oppref: state.attribution.oppref || null
          });

          normalized.network.detected = true;
          normalized.network.url = url;
          normalized.network.method = method;
          store.addEvent(normalized);
          state.events = store.events;
        } else {
          store.correlateNetworkRequest(netEntry);
          state.events = store.events;
        }

        state.lastUpdated = Date.now();
        updateBadge(tabId, state);
      }
    },
    { urls: ['*://*.openai.com/*', '*://bzr.openai.com/*', '*://bzrcdn.openai.com/*'] },
    ['requestBody']
  );

  // 2. Capture completed HTTP status (200, 400, etc.)
  chrome.webRequest.onCompleted.addListener(
    (details) => {
      const { requestId, statusCode, tabId } = details;
      if (pendingRequests.has(requestId)) {
        const { entry } = pendingRequests.get(requestId);
        entry.status = statusCode;
        entry.ok = statusCode >= 200 && statusCode < 300;
        entry.responseTimestamp = Date.now();
        pendingRequests.delete(requestId);

        if (tabId >= 0) {
          const store = getOrCreateTabStore(tabId);
          store.correlateNetworkRequest(entry);
          const state = getOrCreateTabState(tabId);
          state.events = store.events;
          state.lastUpdated = Date.now();
          updateBadge(tabId, state);
        }
      }
    },
    { urls: ['*://*.openai.com/*', '*://bzr.openai.com/*', '*://bzrcdn.openai.com/*'] }
  );

  // 3. Capture network errors (e.g. adblocker net::ERR_BLOCKED_BY_CLIENT)
  chrome.webRequest.onErrorOccurred.addListener(
    (details) => {
      const { requestId, error, tabId } = details;
      if (pendingRequests.has(requestId)) {
        const { entry } = pendingRequests.get(requestId);
        entry.status = 0;
        entry.ok = false;
        entry.error = error;
        entry.responseTimestamp = Date.now();
        pendingRequests.delete(requestId);

        if (tabId >= 0) {
          const store = getOrCreateTabStore(tabId);
          store.correlateNetworkRequest(entry);
          const state = getOrCreateTabState(tabId);
          state.events = store.events;
          state.lastUpdated = Date.now();
          updateBadge(tabId, state);
        }
      }
    },
    { urls: ['*://*.openai.com/*', '*://bzr.openai.com/*', '*://bzrcdn.openai.com/*'] }
  );
}

// =========================================================================
// Primary Runtime Message Router
// =========================================================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : (message.tabId || null);
  if (!message || !message.action) {
    sendResponse({ error: 'Invalid message structure' });
    return false;
  }

  const state = tabId ? getOrCreateTabState(tabId, message.url, message.title) : null;
  const store = tabId ? getOrCreateTabStore(tabId) : null;

  switch (message.action) {
    case 'BRIDGE_STATUS_UPDATE': {
      if (state) {
        state.bridgeConnected = Boolean(message.data && message.data.connected);
        state.lastUpdated = Date.now();
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'FULL_PAGE_SCAN_RESULT': {
      if (state && message.data) {
        const { domScan, attribution } = message.data;
        if (domScan) {
          if (domScan.detected) state.pixel.detected = true;
          if (domScan.confidence && domScan.confidence !== 'none') state.pixel.confidence = domScan.confidence;
          if (domScan.scriptSources) state.pixel.scriptSources = domScan.scriptSources;
          if (domScan.pixelIds) {
            for (const pid of domScan.pixelIds) {
              if (!state.pixel.pixelIds.includes(pid)) state.pixel.pixelIds.push(pid);
            }
          }
        }
        if (attribution) {
          state.attribution = Object.assign({}, state.attribution, attribution);
        }
        state.lastUpdated = Date.now();
        if (state.url) scanBrowserCookiesForTab(tabId, state.url);
        updateBadge(tabId, state);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'PIXEL_INIT_DETECTED': {
      if (state && message.data) {
        state.pixel.detected = true;
        state.pixel.initialized = true;
        state.pixel.confidence = 'high';
        if (message.data.pixelId && !state.pixel.pixelIds.includes(message.data.pixelId)) {
          state.pixel.pixelIds.push(message.data.pixelId);
        }
        if (Array.isArray(message.data.allPixelIds)) {
          for (const pid of message.data.allPixelIds) {
            if (pid && !state.pixel.pixelIds.includes(pid)) state.pixel.pixelIds.push(pid);
          }
        }
        state.lastUpdated = Date.now();
        updateBadge(tabId, state);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'PIXEL_EVENT_CAPTURED': {
      if (state && store && message.data) {
        const rawEvent = message.data;
        const normalized = normalizeEvent(rawEvent, {
          pixelId: state.pixel.pixelIds[0] || null,
          oppref: state.attribution.oppref || null
        });

        store.addEvent(normalized);
        state.events = store.events;

        // Recalculate stats
        let total = state.events.length;
        let standard = 0;
        let custom = 0;
        let valid = 0;
        let warning = 0;
        let error = 0;

        for (const evt of state.events) {
          if (evt.validation.isCustom) custom++; else standard++;
          if (evt.validation.status === 'valid') valid++;
          if (evt.validation.status === 'warning') warning++;
          if (evt.validation.status === 'error') error++;
        }

        state.stats = {
          totalEvents: total,
          standardEvents: standard,
          customEvents: custom,
          validEvents: valid,
          warningEvents: warning,
          errorEvents: error
        };

        state.lastUpdated = Date.now();
        updateBadge(tabId, state);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'NETWORK_REQUEST_CAPTURED': {
      if (state && store && message.data) {
        const netReq = Object.assign({}, message.data);
        netReq.payload = parseNetworkPayload(netReq.payload);
        state.network.push(netReq);
        store.correlateNetworkRequest(netReq);
        state.events = store.events;
        state.lastUpdated = Date.now();
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'SPA_NAVIGATION_DETECTED': {
      if (state && message.data) {
        state.url = message.data.url;
        state.title = message.data.title;
        state.lastUpdated = Date.now();
        scanBrowserCookiesForTab(tabId, state.url);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'GET_ACTIVE_TAB_STATE': {
      const targetId = message.tabId;
      const curState = targetId ? getOrCreateTabState(targetId) : null;
      if (curState && curState.url) {
        scanBrowserCookiesForTab(targetId, curState.url);
      }
      sendResponse({ state: curState });
      break;
    }

    case 'GET_AUDIT_REPORT': {
      const targetId = message.tabId;
      const curState = targetId ? getOrCreateTabState(targetId) : null;
      if (curState) {
        const report = generateAuditReport(curState);
        sendResponse({ report: report });
      } else {
        sendResponse({ error: 'Tab not found' });
      }
      break;
    }

    case 'CLEAR_TAB_STATE': {
      const targetId = message.tabId;
      if (targetId) {
        const store = getOrCreateTabStore(targetId);
        store.clear();
        const state = createDefaultTabState(targetId);
        tabStates.set(targetId, state);
        updateBadge(targetId, state);
      }
      sendResponse({ status: 'cleared' });
      break;
    }

    case 'PING_BACKGROUND': {
      sendResponse({
        status: 'ok',
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now(),
        trackedTabsCount: tabStates.size
      });
      break;
    }

    default:
      sendResponse({ status: 'unknown_action' });
      break;
  }

  return true;
});

console.info('[OpenAI Pixel Inspector] Service worker online with chrome.webRequest and chrome.cookies support.');
