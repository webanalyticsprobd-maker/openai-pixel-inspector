/**
 * OpenAI Ads Pixel Inspector - Background Service Worker (Manifest V3)
 * 
 * Orchestrates normalized state, validation, network request correlation,
 * event stores, badge counts, and popup messaging for all browser tabs.
 * 
 * Maintains persistent full session journey history across all page navigations.
 */

import { normalizeEvent } from '../core/normalizer.js';
import { EventStore } from '../core/event-store.js';
import { generateAuditReport } from '../core/scanner.js';
import { parseNetworkPayload, isOpenAINetworkRequest, classifyNetworkEvent } from '../network/request-parser.js';

function isInternalSdkEvent(evtItem) {
  if (!evtItem) return false;
  const name = (typeof evtItem === 'string' ? evtItem : (evtItem.type || evtItem.name || '')).trim().toLowerCase();
  return name === 'openai::sdk_init' || name === 'sdk_init' || name === 'oai::diagnostic' || name === 'diagnostic' || name.startsWith('openai::sdk') || name.startsWith('oai::diag');
}

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
  const store = getOrCreateTabStore(tabId);
  return {
    tabId: tabId,
    sessionId: store.sessionId,
    url: url,
    title: title,
    visitedPages: url ? [url] : [],
    lastUpdated: Date.now(),
    contentScriptActive: false,
    bridgeConnected: false,
    gtmContainers: [],
    dataLayer: [],
    serverSideSignals: {},
    serverHeaders: [],
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
    events: store.events || [],
    network: [],
    issues: [],
    warnings: [],
    stats: {
      totalEvents: 0,
      standardEvents: 0,
      customEvents: 0,
      validEvents: 0,
      warningEvents: 0,
      errorEvents: 0,
      duplicateEvents: 0
    }
  };
}

function getOrCreateTabState(tabId, url = '', title = '') {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, createDefaultTabState(tabId, url, title));
  }
  const state = tabStates.get(tabId);
  if (url) {
    state.url = url;
    if (!state.visitedPages.includes(url)) {
      state.visitedPages.push(url);
    }
  }
  if (title) state.title = title;
  return state;
}

function updateBadge(tabId, state) {
  if (!state || !tabId || tabId < 0 || typeof chrome.action === 'undefined') return;
  const errCount = state.stats ? state.stats.errorEvents : 0;
  const dupCount = state.stats ? state.stats.duplicateEvents : 0;
  const evtCount = state.stats ? state.stats.totalEvents : 0;

  try {
    let text = '';
    let color = '#10a37f';

    if (errCount > 0) {
      text = `${errCount}`;
      color = '#ef4444';
    } else if (dupCount > 0) {
      text = `${dupCount}d`;
      color = '#f59e0b';
    } else if (evtCount > 0) {
      text = `${evtCount}`;
      color = '#10a37f';
    } else if (state.pixel && state.pixel.detected) {
      text = '✓';
      color = '#3b82f6';
    }

    const badgePromise = chrome.action.setBadgeText({ tabId: tabId, text: text });
    if (badgePromise && typeof badgePromise.catch === 'function') {
      badgePromise.catch(() => {});
    }

    if (text) {
      const colorPromise = chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: color });
      if (colorPromise && typeof colorPromise.catch === 'function') {
        colorPromise.catch(() => {});
      }
    }
  } catch (err) {
    // Gracefully ignore closed tab errors
  }
}

async function scanBrowserCookiesForTab(tabId, url) {
  if (!url || !url.startsWith('http') || typeof chrome.cookies === 'undefined' || !tabId || tabId < 0) return;
  try {
    const cookieOppref = await chrome.cookies.get({ url: url, name: '__oppref' }).catch(() => null);
    const cookieObref = await chrome.cookies.get({ url: url, name: '__obref' }).catch(() => null);
    const state = getOrCreateTabState(tabId);
    let updated = false;

    if (cookieOppref && cookieOppref.value) {
      const decodedOppref = decodeURIComponent(cookieOppref.value);
      state.attribution.cookieOpprefDetected = true;
      state.attribution.cookieDetected = true;
      state.attribution.oppref = decodedOppref;
      if (!state.attribution.source) {
        state.attribution.source = 'cookie';
      }
      state.attribution.details.cookieOpprefValue = decodedOppref;
      state.attribution.details.cookieValue = decodedOppref;
      state.attribution.details.opprefExpirationDate = cookieOppref.expirationDate;
      updated = true;
    }

    if (cookieObref && cookieObref.value) {
      const decodedObref = decodeURIComponent(cookieObref.value);
      state.attribution.cookieObrefDetected = true;
      state.attribution.obref = decodedObref;
      state.attribution.details.cookieObrefValue = decodedObref;
      state.attribution.details.obrefExpirationDate = cookieObref.expirationDate;
      updated = true;
    }

    if (updated) {
      state.lastUpdated = Date.now();
      updateBadge(tabId, state);
    }
  } catch (err) {
    // Gracefully ignore cookie scan errors on closed tabs
  }
}

// Tab cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
  tabStores.delete(tabId);
  for (const [reqId, reqInfo] of pendingRequests.entries()) {
    if (reqInfo.tabId === tabId) {
      pendingRequests.delete(reqId);
    }
  }
});

// Navigation listener - Maintains session journey across page navigations
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && tab.url) {
    const state = getOrCreateTabState(tabId, tab.url, tab.title);
    state.url = tab.url;
    if (!state.visitedPages.includes(tab.url)) {
      state.visitedPages.push(tab.url);
    }
    state.lastUpdated = Date.now();
    updateBadge(tabId, state);
    scanBrowserCookiesForTab(tabId, tab.url);
  }
});

function processTrackingNetworkPayload(tabId, netEntry) {
  if (!tabId || tabId < 0 || !netEntry) return;
  const state = getOrCreateTabState(tabId);
  const store = getOrCreateTabStore(tabId);

  const url = netEntry.url || '';
  const method = netEntry.method || 'POST';
  const parsedPayload = netEntry.payload;

  // Extract URL Query Parameters (pid, st, sv, t, ec)
  const queryParams = {};
  try {
    const parsedUrl = new URL(url);
    for (const [k, v] of parsedUrl.searchParams.entries()) {
      queryParams[k] = v;
    }
  } catch {}

  if (queryParams.pid) {
    state.pixel.detected = true;
    state.pixel.confidence = 'high';
    if (!state.pixel.pixelIds.includes(queryParams.pid)) {
      state.pixel.pixelIds.push(queryParams.pid);
    }
  }

  // Extract obref from Network Payload (Do NOT overwrite oppref!)
  const obrefVal = parsedPayload?.obref || queryParams.obref || null;
  if (obrefVal) {
    state.attribution.obref = obrefVal;
    state.attribution.details.networkPayload = obrefVal;
  }

  netEntry.query = queryParams;
  netEntry.batch = { obref: obrefVal };
  netEntry.obref = obrefVal;

  // Process Batched or Single Events from Network Payload
  if (parsedPayload && Array.isArray(parsedPayload.events) && parsedPayload.events.length > 0) {
    parsedPayload.events.forEach((evtItem) => {
      const evtName = evtItem.type || evtItem.name || 'openai::event';
      const evtId = evtItem.id || evtItem.event_id || null;
      const evtTs = evtItem.timestamp_ms || evtItem.timestamp || Date.now();
      const evtSrc = evtItem.source_url || state.url;
      const dataPayload = evtItem.data || {};
      const customEventName = evtItem.custom_event_name || (evtItem.data && evtItem.data.custom_event_name) || (evtItem.options && evtItem.options.custom_event_name) || null;

      if (isInternalSdkEvent(evtItem)) {
        state.pixel.detected = true;
        state.pixel.confidence = 'high';
        if (evtName.includes('init')) {
          state.pixel.initialized = true;
        }
        if (!state.internalEvents) state.internalEvents = [];
        state.internalEvents.push(evtItem);
        return; // Exclude internal SDK events from user-facing events list
      }

      // Unique Ingestion Key for Transport Deduplication (Prevents webRequest and page-bridge fetch/xhr from double-ingesting the exact same request)
      const eventKey = evtId ? `evt_id:${evtId}` : `sig:${evtName}:${JSON.stringify(dataPayload)}:${Math.floor(evtTs / 500)}`;

      if (store.hasProcessedKey(eventKey)) {
        // Already ingested from primary transport (e.g. webRequest) -> Update HTTP status/resolution
        for (let i = store.events.length - 1; i >= 0; i--) {
          const e = store.events[i];
          if ((evtId && e.eventId === evtId) || (e.name === evtName && Math.abs(e.timestamp - evtTs) < 1000)) {
            if (netEntry.status && netEntry.status !== 'pending') {
              e.network.status = netEntry.status;
            }
            if (netEntry.ok !== undefined) {
              e.network.ok = netEntry.ok;
            }
            break;
          }
        }
      } else {
        store.markProcessedKey(eventKey);

        const normalized = normalizeEvent({
          name: evtName,
          custom_event_name: customEventName,
          options: {
            custom_event_name: customEventName,
            event_id: evtId
          },
          parameters: dataPayload,
          event_id: evtId,
          pixelId: queryParams.pid || state.pixel.pixelIds[0] || null,
          url: evtSrc,
          timestamp: evtTs,
          caller: `network (${netEntry.source || netEntry.via || 'transport'})`,
          requestId: netEntry.requestId || null,
          query: queryParams,
          batch: { obref: obrefVal },
          eventEnvelope: evtItem,
          obref: obrefVal,
          oppref: state.attribution.oppref || null
        }, {
          url: evtSrc,
          pixelId: queryParams.pid || state.pixel.pixelIds[0] || null,
          oppref: state.attribution.oppref || null,
          obref: obrefVal || state.attribution.obref || null
        });

        normalized.requestId = netEntry.requestId || null;
        normalized.network.requestId = netEntry.requestId || null;
        normalized.network.detected = true;
        normalized.network.url = url;
        normalized.network.method = method;
        normalized.network.payload = parsedPayload;
        if (netEntry.status && netEntry.status !== 'pending') {
          normalized.network.status = netEntry.status;
        }
        if (netEntry.ok !== undefined) {
          normalized.network.ok = netEntry.ok;
        }
        normalized.query = queryParams;
        normalized.batch = { obref: obrefVal };
        normalized.eventEnvelope = evtItem;
        normalized.attribution.obref = obrefVal || state.attribution.obref || null;
        normalized.attribution.oppref = state.attribution.oppref || null;
        store.addEvent(normalized);
      }
    });
    state.events = store.events;
  } else if (parsedPayload && (parsedPayload.name || parsedPayload.event_name || parsedPayload.event || parsedPayload.type)) {
    const evtName = parsedPayload.name || parsedPayload.event_name || parsedPayload.event || parsedPayload.type;
    const evtId = parsedPayload.event_id || parsedPayload.id || null;
    const evtTs = parsedPayload.timestamp_ms || parsedPayload.timestamp || Date.now();
    const customEventName = parsedPayload.custom_event_name || (parsedPayload.data && parsedPayload.data.custom_event_name) || (parsedPayload.options && parsedPayload.options.custom_event_name) || null;

    if (isInternalSdkEvent(parsedPayload)) {
      state.pixel.detected = true;
      state.pixel.confidence = 'high';
      if (evtName.includes('init')) {
        state.pixel.initialized = true;
      }
      if (!state.internalEvents) state.internalEvents = [];
      state.internalEvents.push(parsedPayload);
    } else {
      const dataPayload = parsedPayload.properties || parsedPayload.data || parsedPayload;
      const eventKey = evtId ? `evt_id:${evtId}` : `sig:${evtName}:${JSON.stringify(dataPayload)}:${Math.floor(evtTs / 500)}`;

      if (store.hasProcessedKey(eventKey)) {
        for (let i = store.events.length - 1; i >= 0; i--) {
          const e = store.events[i];
          if ((evtId && e.eventId === evtId) || (e.name === evtName && Math.abs(e.timestamp - evtTs) < 1000)) {
            if (netEntry.status && netEntry.status !== 'pending') {
              e.network.status = netEntry.status;
            }
            if (netEntry.ok !== undefined) {
              e.network.ok = netEntry.ok;
            }
            break;
          }
        }
      } else {
        store.markProcessedKey(eventKey);

        const normalized = normalizeEvent({
          name: evtName,
          custom_event_name: customEventName,
          options: {
            custom_event_name: customEventName,
            event_id: evtId
          },
          parameters: dataPayload,
          event_id: evtId,
          pixelId: queryParams.pid || parsedPayload.pixel_id || parsedPayload.pixelId || state.pixel.pixelIds[0] || null,
          url: state.url,
          timestamp: evtTs,
          caller: `network (${netEntry.source || netEntry.via || 'transport'})`,
          requestId: netEntry.requestId || null,
          query: queryParams,
          batch: { obref: obrefVal },
          eventEnvelope: parsedPayload,
          obref: obrefVal,
          oppref: state.attribution.oppref || null
        }, {
          url: state.url,
          pixelId: queryParams.pid || state.pixel.pixelIds[0] || null,
          oppref: state.attribution.oppref || null,
          obref: obrefVal || state.attribution.obref || null
        });

        normalized.requestId = netEntry.requestId || null;
        normalized.network.requestId = netEntry.requestId || null;
        normalized.network.detected = true;
        normalized.network.url = url;
        normalized.network.method = method;
        normalized.network.payload = parsedPayload;
        if (netEntry.status && netEntry.status !== 'pending') {
          normalized.network.status = netEntry.status;
        }
        if (netEntry.ok !== undefined) {
          normalized.network.ok = netEntry.ok;
        }
        normalized.query = queryParams;
        normalized.batch = { obref: obrefVal };
        normalized.eventEnvelope = parsedPayload;
        normalized.attribution.obref = obrefVal || state.attribution.obref || null;
        normalized.attribution.oppref = state.attribution.oppref || null;
        store.addEvent(normalized);
      }
    }
    state.events = store.events;
  }

  // Recalculate stats
  let total = state.events.length;
  let standard = 0;
  let custom = 0;
  let valid = 0;
  let warning = 0;
  let error = 0;
  let duplicate = 0;

  for (const evt of state.events) {
    if (evt.validation?.isCustom) custom++; else standard++;
    if (evt.isDuplicate) duplicate++;
    if (evt.validation?.status === 'valid') valid++;
    if (evt.validation?.status === 'warning') warning++;
    if (evt.validation?.status === 'error') error++;
  }

  state.stats = {
    totalEvents: total,
    standardEvents: standard,
    customEvents: custom,
    validEvents: valid,
    warningEvents: warning,
    errorEvents: error,
    duplicateEvents: duplicate
  };

  state.lastUpdated = Date.now();
  updateBadge(tabId, state);

  // Broadcast state update immediately for real-time live debugger UI
  try {
    chrome.runtime.sendMessage({
      action: 'TAB_STATE_UPDATED',
      tabId: tabId,
      state: state
    }).catch(() => {});
  } catch (_) {}
}

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

        // Extract URL Query Parameters (pid, st, sv, t, ec)
        const queryParams = {};
        try {
          const parsedUrl = new URL(url);
          for (const [k, v] of parsedUrl.searchParams.entries()) {
            queryParams[k] = v;
          }
        } catch {}

        if (queryParams.pid) {
          state.pixel.detected = true;
          state.pixel.confidence = 'high';
          if (!state.pixel.pixelIds.includes(queryParams.pid)) {
            state.pixel.pixelIds.push(queryParams.pid);
          }
        }

        // Extract obref from Network Payload (Do NOT overwrite oppref!)
        if (parsedPayload && parsedPayload.obref) {
          state.attribution.obref = parsedPayload.obref;
          state.attribution.details.networkPayload = parsedPayload.obref;
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
        processTrackingNetworkPayload(tabId, netEntry);
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

  // 3. Inspect Response Headers for Server-Side Tagging Containers
  if (chrome.webRequest.onHeadersReceived) {
    chrome.webRequest.onHeadersReceived.addListener(
      (details) => {
        const { tabId, responseHeaders, url } = details;
        if (tabId < 0 || !responseHeaders) return;

        const state = getOrCreateTabState(tabId);
        for (const h of responseHeaders) {
          const hName = (h.name || '').toLowerCase();
          const hVal = h.value || '';

          if (
            hName === 'x-gtm-server-preview' ||
            hName === 'x-server-gtm' ||
            hName.includes('stape') ||
            (hName === 'server' && hVal.toLowerCase().includes('zaraz'))
          ) {
            if (!state.serverHeaders.some((sh) => sh.name === h.name && sh.value === h.value)) {
              state.serverHeaders.push({
                name: h.name,
                value: h.value,
                url: url,
                timestamp: Date.now()
              });
              state.lastUpdated = Date.now();
            }
          }
        }
      },
      { urls: ['<all_urls>'] },
      ['responseHeaders']
    );
  }

  // 4. Capture network errors (e.g. adblocker net::ERR_BLOCKED_BY_CLIENT)
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
        if (message.data?.details?.gtmContainers) {
          message.data.details.gtmContainers.forEach((gId) => {
            if (!state.gtmContainers.includes(gId)) state.gtmContainers.push(gId);
          });
        }
        if (message.data?.details?.serverSideSignals) {
          state.serverSideSignals = Object.assign({}, state.serverSideSignals, message.data.details.serverSideSignals);
        }
        state.lastUpdated = Date.now();
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'DATALAYER_EVENT_CAPTURED': {
      if (state && message.data) {
        if (!state.dataLayer) state.dataLayer = [];
        state.dataLayer.push(message.data);
        if (message.data.gtmContainers && Array.isArray(message.data.gtmContainers)) {
          message.data.gtmContainers.forEach((gId) => {
            if (!state.gtmContainers.includes(gId)) state.gtmContainers.push(gId);
          });
        }
        state.lastUpdated = Date.now();
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'FULL_PAGE_SCAN_RESULT': {
      if (state && message.data) {
        const { domScan, attribution, serverSideSignals } = message.data;
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
        if (serverSideSignals) {
          state.serverSideSignals = Object.assign({}, state.serverSideSignals, serverSideSignals);
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
      if (state && message.data) {
        const rawEvent = message.data;
        state.pixel.detected = true;
        state.pixel.initialized = true;
        state.pixel.confidence = 'high';
        if (rawEvent.pixelId && !state.pixel.pixelIds.includes(rawEvent.pixelId)) {
          state.pixel.pixelIds.push(rawEvent.pixelId);
        }
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
        processTrackingNetworkPayload(tabId, netReq);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'SPA_NAVIGATION_DETECTED': {
      if (state && message.data) {
        state.url = message.data.url;
        state.title = message.data.title;
        if (!state.visitedPages.includes(message.data.url)) {
          state.visitedPages.push(message.data.url);
        }
        state.lastUpdated = Date.now();
        scanBrowserCookiesForTab(tabId, state.url);
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'GET_TAB_STATE':
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
        const state = createDefaultTabState(targetId, tabStates.get(targetId)?.url || '');
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

console.info('[OpenAI Pixel Inspector] Service worker online with full session journey persistence.');
