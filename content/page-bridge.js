/**
 * OpenAI Ads Pixel Inspector - Page Context Bridge (MAIN World)
 * 
 * Runs in the website's execution context to hook into window.oaiq, proxy
 * measure/init calls, monitor outgoing network tracking requests, and capture
 * SPA navigation changes.
 */

(function () {
  'use strict';

  if (window.__OPENAI_PIXEL_INSPECTOR_BRIDGE_INITIALIZED__) {
    return;
  }
  window.__OPENAI_PIXEL_INSPECTOR_BRIDGE_INITIALIZED__ = true;

  const BRIDGE_SOURCE = 'OPENAI_PIXEL_PAGE_BRIDGE';
  const CONTENT_SOURCE = 'OPENAI_PIXEL_CONTENT_SCRIPT';

  let activePixelIds = new Set();
  let isInitialized = false;

  /**
   * Securely post message to content script
   */
  function sendToContentScript(type, payload = {}) {
    try {
      window.postMessage(
        {
          source: BRIDGE_SOURCE,
          type: type,
          timestamp: Date.now(),
          payload: payload
        },
        '*'
      );
    } catch (err) {
      console.debug('[OpenAI Pixel Inspector Bridge] PostMessage error:', err);
    }
  }

  // ==========================================
  // 1. oaiq Stub Hooking & Proxy Engine
  // ==========================================

  function handleOaiqCall(args) {
    if (!args || args.length === 0) return;
    const command = args[0];

    if (command === 'init') {
      isInitialized = true;
      let pixelId = null;
      let config = {};

      if (args.length >= 2) {
        if (typeof args[1] === 'object' && args[1] !== null) {
          pixelId = args[1].pixelId || null;
          config = args[1];
        } else if (typeof args[1] === 'string') {
          pixelId = args[1];
        }
      }

      if (pixelId) activePixelIds.add(pixelId);

      sendToContentScript('PIXEL_INIT_DETECTED', {
        pixelId: pixelId,
        config: config,
        allPixelIds: Array.from(activePixelIds),
        timestamp: Date.now(),
        rawArgs: Array.from(args)
      });
    } else if (command === 'measure') {
      // oaiq("measure", eventName, properties, options)
      const eventName = args[1] || 'unknown';
      const properties = (args.length >= 3 && typeof args[2] === 'object') ? args[2] : {};
      const options = (args.length >= 4 && typeof args[3] === 'object') ? args[3] : {};

      sendToContentScript('PIXEL_EVENT_CAPTURED', {
        name: eventName,
        parameters: properties,
        options: options,
        args: Array.from(args).slice(1),
        pixelId: Array.from(activePixelIds)[0] || null,
        timestamp: Date.now(),
        caller: 'oaiq("measure")'
      });
    } else if (command === 'measureSingle') {
      // oaiq("measureSingle", pixelId, eventName, properties, options)
      const targetPixelId = args[1] || null;
      const eventName = args[2] || 'unknown';
      const properties = (args.length >= 4 && typeof args[3] === 'object') ? args[3] : {};
      const options = (args.length >= 5 && typeof args[4] === 'object') ? args[4] : {};

      if (targetPixelId) activePixelIds.add(targetPixelId);

      sendToContentScript('PIXEL_EVENT_CAPTURED', {
        name: eventName,
        parameters: properties,
        options: options,
        args: Array.from(args).slice(2),
        pixelId: targetPixelId,
        timestamp: Date.now(),
        caller: 'oaiq("measureSingle")'
      });
    } else if (command === 'consent') {
      sendToContentScript('PIXEL_CONSENT_DETECTED', {
        consent: args[1],
        timestamp: Date.now()
      });
    }
  }

  function hookOaiqFunction(oaiqFn) {
    if (!oaiqFn || oaiqFn.__OPENAI_INSPECTOR_WRAPPED__) return oaiqFn;

    // Process any queued calls already in oaiq.q
    if (Array.isArray(oaiqFn.q)) {
      for (const callArgs of oaiqFn.q) {
        handleOaiqCall(callArgs);
      }
    }

    const wrappedOaiq = function () {
      handleOaiqCall(arguments);
      return oaiqFn.apply(this, arguments);
    };

    // Copy properties like .q
    for (const key of Object.keys(oaiqFn)) {
      wrappedOaiq[key] = oaiqFn[key];
    }
    wrappedOaiq.q = oaiqFn.q || [];
    wrappedOaiq.__OPENAI_INSPECTOR_WRAPPED__ = true;

    return wrappedOaiq;
  }

  // Hook existing or future window.oaiq
  if (typeof window.oaiq !== 'undefined') {
    window.oaiq = hookOaiqFunction(window.oaiq);
  }

  // Define getter/setter on window.oaiq so we intercept when scripts assign it later
  let internalOaiq = window.oaiq;
  try {
    Object.defineProperty(window, 'oaiq', {
      configurable: true,
      enumerable: true,
      get: function () {
        return internalOaiq;
      },
      set: function (newFn) {
        internalOaiq = hookOaiqFunction(newFn);
      }
    });
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector Bridge] Property define error:', err);
  }

  // ==========================================
  // 2. Outgoing Network Monitor (fetch, beacon, xhr)
  // ==========================================

  const OPENAI_ENDPOINTS = ['bzr.openai.com', 'bzrcdn.openai.com'];

  function isTargetNetworkUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return OPENAI_ENDPOINTS.some((ep) => url.includes(ep));
  }

  // Wrap window.fetch
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch;
    window.fetch = function (resource, init) {
      const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
      if (isTargetNetworkUrl(url)) {
        const method = (init && init.method) ? init.method.toUpperCase() : 'GET';
        let payload = null;
        if (init && init.body) {
          try {
            payload = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
          } catch {
            payload = init.body;
          }
        }

        const start = Date.now();
        return originalFetch.apply(this, arguments).then((response) => {
          sendToContentScript('NETWORK_REQUEST_CAPTURED', {
            url: url,
            method: method,
            status: response.status,
            ok: response.ok,
            duration: Date.now() - start,
            timestamp: start,
            payload: payload
          });
          return response;
        }).catch((err) => {
          sendToContentScript('NETWORK_REQUEST_CAPTURED', {
            url: url,
            method: method,
            status: 0,
            ok: false,
            error: err.message,
            duration: Date.now() - start,
            timestamp: start,
            payload: payload
          });
          throw err;
        });
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Wrap navigator.sendBeacon
  if (navigator && typeof navigator.sendBeacon === 'function') {
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function (url, data) {
      if (isTargetNetworkUrl(url)) {
        let payload = null;
        try {
          payload = typeof data === 'string' ? JSON.parse(data) : data;
        } catch {
          payload = data;
        }
        sendToContentScript('NETWORK_REQUEST_CAPTURED', {
          url: url,
          method: 'POST',
          status: 200,
          ok: true,
          timestamp: Date.now(),
          payload: payload,
          via: 'sendBeacon'
        });
      }
      return originalSendBeacon.apply(this, arguments);
    };
  }

  // ==========================================
  // 3. SPA Route Navigation Observer
  // ==========================================

  function notifyNavigation() {
    sendToContentScript('SPA_NAVIGATION_DETECTED', {
      url: window.location.href,
      pathname: window.location.pathname,
      search: window.location.search,
      title: document.title,
      timestamp: Date.now()
    });
  }

  const origPushState = history.pushState;
  history.pushState = function () {
    origPushState.apply(this, arguments);
    setTimeout(notifyNavigation, 50);
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function () {
    origReplaceState.apply(this, arguments);
    setTimeout(notifyNavigation, 50);
  };

  window.addEventListener('popstate', notifyNavigation);
  window.addEventListener('hashchange', notifyNavigation);

  // ==========================================
  // 4. Message Listeners & Initial Handshake
  // ==========================================

  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== CONTENT_SOURCE) {
      return;
    }
    const { type } = event.data;
    if (type === 'REQUEST_PAGE_STATE' || type === 'PING') {
      sendToContentScript('PAGE_STATE_RESPONSE', {
        url: window.location.href,
        hasOaiqGlobal: typeof window.oaiq !== 'undefined',
        isInitialized: isInitialized,
        pixelIds: Array.from(activePixelIds)
      });
    }
  });

  // Announce bridge ready
  sendToContentScript('BRIDGE_READY', {
    url: window.location.href,
    hasOaiqGlobal: typeof window.oaiq !== 'undefined',
    pixelIds: Array.from(activePixelIds),
    isInitialized: isInitialized
  });
})();
