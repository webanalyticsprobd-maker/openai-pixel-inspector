/**
 * OpenAI Ads Pixel Inspector - Background Service Worker (Manifest V3)
 * 
 * Orchestrates normalized state, validation, network request correlation,
 * event stores, badge counts, and popup messaging for all browser tabs.
 */

import { normalizeEvent } from '../core/normalizer.js';
import { EventStore } from '../core/event-store.js';
import { generateAuditReport } from '../core/scanner.js';
import { parseNetworkPayload } from '../network/request-parser.js';

const tabStates = new Map();
const tabStores = new Map();

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
  }
});

// Primary Message Router
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
      }
      sendResponse({ status: 'ok' });
      break;
    }

    case 'GET_ACTIVE_TAB_STATE': {
      const targetId = message.tabId;
      const curState = targetId ? getOrCreateTabState(targetId) : null;
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

console.info('[OpenAI Pixel Inspector] Service worker online and initialized.');
