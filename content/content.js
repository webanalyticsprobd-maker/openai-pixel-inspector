/**
 * OpenAI Ads Pixel Inspector - Content Script (ISOLATED World)
 * 
 * Runs at document_start. Coordinates DOM detection, attribution parsing, 
 * page-bridge injection, and forwards normalized events to the background service worker.
 */

(function () {
  'use strict';

  const BRIDGE_SOURCE = 'OPENAI_PIXEL_PAGE_BRIDGE';
  const CONTENT_SOURCE = 'OPENAI_PIXEL_CONTENT_SCRIPT';

  let isBridgeConnected = false;

  /**
   * DOM Script Detector (bundled inline for isolated script execution)
   */
  function scanDOMForPixel() {
    const result = {
      detected: false,
      confidence: 'none',
      scriptSources: [],
      inlineScriptsFound: 0,
      pixelIds: []
    };

    const scripts = Array.from(document.querySelectorAll('script'));
    const OFFICIAL_SDK_PATTERN = /bzrcdn\.openai\.com\/sdk\/oaiq(?:\.min)?\.js/i;
    const PIXEL_ID_PATTERN = /oaiq\s*\(\s*["']init["']\s*,\s*(?:\{[^}]*pixelId\s*:\s*["']([^"']+)["']|["']([^"']+)["'])/g;

    for (const script of scripts) {
      if (script.src) {
        if (OFFICIAL_SDK_PATTERN.test(script.src)) {
          result.detected = true;
          result.scriptSources.push(script.src);
          result.confidence = 'high';
        } else if (script.src.includes('oaiq.min.js')) {
          result.detected = true;
          result.scriptSources.push(script.src);
          if (result.confidence !== 'high') result.confidence = 'medium';
        }
      } else if (script.textContent) {
        const content = script.textContent;
        if (content.includes('oaiq')) {
          result.inlineScriptsFound++;
          if (!result.detected) {
            result.detected = true;
            result.confidence = 'medium';
          }
          let match;
          while ((match = PIXEL_ID_PATTERN.exec(content)) !== null) {
            const id = match[1] || match[2];
            if (id && !result.pixelIds.includes(id)) {
              result.pixelIds.push(id);
            }
          }
        }
      }
    }
    return result;
  }

  /**
   * Attribution & oppref Inspector (bundled inline for isolated script execution)
   */
  function scanAttribution() {
    const attribution = {
      oppref: null,
      source: null,
      urlDetected: false,
      cookieDetected: false,
      storageDetected: false,
      details: {}
    };

    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('oppref')) {
        const val = urlParams.get('oppref');
        if (val && val.trim()) {
          attribution.oppref = val.trim();
          attribution.source = 'url';
          attribution.urlDetected = true;
          attribution.details.urlParam = val;
        }
      }
    } catch {}

    try {
      const cookies = document.cookie.split(';');
      for (const c of cookies) {
        const [name, ...rest] = c.trim().split('=');
        if (name === '__oppref') {
          const val = rest.join('=');
          if (val) {
            attribution.cookieDetected = true;
            if (!attribution.oppref) {
              attribution.oppref = decodeURIComponent(val);
              attribution.source = 'cookie';
            }
            attribution.details.cookieValue = decodeURIComponent(val);
          }
        }
      }
    } catch {}

    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('__oppref') || localStorage.getItem('oppref');
        if (stored) {
          attribution.storageDetected = true;
          if (!attribution.oppref) {
            attribution.oppref = stored;
            attribution.source = 'storage';
          }
          attribution.details.localStorage = stored;
        }
      }
    } catch {}

    return attribution;
  }

  function maskEmail(email) {
    if (!email || typeof email !== 'string') return '';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    const maskedName = name.length <= 2 ? name[0] + '***' : name[0] + '***' + name[name.length - 1];
    return maskedName + '@' + domain;
  }

  function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    const clean = phone.trim();
    if (clean.length <= 4) return '***' + clean;
    return clean.slice(0, Math.min(3, clean.length - 4)) + '***' + clean.slice(-4);
  }

  function scanPageForUserData() {
    const fields = [];
    const visited = new Set();

    // 1. Scan URL search params
    try {
      const sp = new URLSearchParams(window.location.search);
      for (const [k, v] of sp.entries()) {
        const key = k.toLowerCase();
        if (v && v.trim()) {
          if (key.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
            fields.push({ type: 'email', label: 'Email', key: `url.${k}`, value: v.trim(), masked: maskEmail(v.trim()), isHashed: false });
          } else if (key.includes('phone') || key.includes('tel')) {
            fields.push({ type: 'phone', label: 'Phone Number', key: `url.${k}`, value: v.trim(), masked: maskPhone(v.trim()), isHashed: false });
          } else if (key === 'user_id' || key === 'customer_id' || key === 'external_id') {
            fields.push({ type: 'user_id', label: 'Customer / User ID', key: `url.${k}`, value: v.trim(), masked: v.trim(), isHashed: false });
          }
        }
      }
    } catch {}

    // 2. Scan Order Receipt / Thank-you DOM elements
    try {
      const emailNodes = document.querySelectorAll(
        '.woocommerce-order-overview__email strong, .order-email, [class*="customer-email"], [class*="billing-email"], [id*="customer-email"]'
      );
      for (const node of emailNodes) {
        const txt = (node.textContent || '').trim();
        if (txt && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(txt) && !visited.has(txt)) {
          visited.add(txt);
          fields.push({ type: 'email', label: 'Email (Order Receipt)', key: 'dom.email', value: txt, masked: maskEmail(txt), isHashed: false });
        }
      }
    } catch {}

    if (fields.length === 0) return null;
    return {
      detected: true,
      count: fields.length,
      fields: fields,
      hasRawPii: true,
      hasHashedData: false
    };
  }

  /**
   * Injects page-context bridge into MAIN world
   */
  function injectBridge() {
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content/page-bridge.js');
      script.async = false;
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(script);
        script.onload = () => script.remove();
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          (document.head || document.documentElement).appendChild(script);
        }, { once: true });
      }
    } catch (err) {
      console.warn('[OpenAI Pixel Inspector] Bridge injection failed:', err);
    }
  }

  function sendToPageBridge(type, payload = {}) {
    window.postMessage(
      {
        source: CONTENT_SOURCE,
        type: type,
        timestamp: Date.now(),
        payload: payload
      },
      '*'
    );
  }

  function sendToBackground(action, data = {}) {
    try {
      chrome.runtime.sendMessage({
        action: action,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now(),
        data: data
      }).catch(() => {});
    } catch (err) {
      console.debug('[OpenAI Pixel Inspector] Background message dispatch error:', err);
    }
  }

  function performFullScan() {
    const domScan = scanDOMForPixel();
    const attribution = scanAttribution();
    const userData = scanPageForUserData();

    sendToBackground('FULL_PAGE_SCAN_RESULT', {
      domScan: domScan,
      attribution: attribution,
      userData: userData,
      url: window.location.href,
      title: document.title
    });
  }

  // Handle messages from Page Bridge
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== BRIDGE_SOURCE) {
      return;
    }

    const { type, payload } = event.data;

    switch (type) {
      case 'BRIDGE_READY':
      case 'PAGE_STATE_RESPONSE':
      case 'PONG':
        isBridgeConnected = true;
        sendToBackground('BRIDGE_STATUS_UPDATE', {
          connected: true,
          details: payload
        });
        performFullScan();
        break;

      case 'PIXEL_INIT_DETECTED':
        sendToBackground('PIXEL_INIT_DETECTED', payload);
        performFullScan();
        break;

      case 'PIXEL_EVENT_CAPTURED':
        sendToBackground('PIXEL_EVENT_CAPTURED', payload);
        break;

      case 'NETWORK_REQUEST_CAPTURED':
        sendToBackground('NETWORK_REQUEST_CAPTURED', payload);
        break;

      case 'DATALAYER_EVENT_CAPTURED':
        sendToBackground('DATALAYER_EVENT_CAPTURED', payload);
        break;

      case 'SPA_NAVIGATION_DETECTED':
        performFullScan();
        sendToBackground('SPA_NAVIGATION_DETECTED', payload);
        break;

      default:
        break;
    }
  });

  // Handle messages from Popup or Background
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.action) return false;

    switch (message.action) {
      case 'PING_CONTENT_SCRIPT':
        sendResponse({
          status: 'ok',
          url: window.location.href,
          title: document.title,
          isBridgeConnected: isBridgeConnected
        });
        break;

      case 'REQUEST_SCAN':
        performFullScan();
        sendToPageBridge('REQUEST_PAGE_STATE');
        sendResponse({ status: 'scan_executed' });
        break;

      default:
        break;
    }
    return true;
  });

  // Initialize
  injectBridge();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', performFullScan);
  } else {
    performFullScan();
  }

  window.addEventListener('load', performFullScan);
})();
