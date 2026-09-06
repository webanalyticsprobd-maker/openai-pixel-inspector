/**
 * OpenAI Ads Pixel Inspector - Page Context Bridge (MAIN World)
 * 
 * Runs in the website's execution context to hook into window.oaiq, proxy
 * measure/init calls, monitor outgoing network tracking requests, and push
 * rich, color-coded, organized and raw payloads directly to the browser console.
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
  let isConsoleLoggingEnabled = true;

  // Check stored preference
  try {
    const pref = localStorage.getItem('__oai_console_debug_enabled');
    if (pref === 'false') isConsoleLoggingEnabled = false;
  } catch {}

  function formatTime(ts) {
    const d = new Date(ts || Date.now());
    return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  }

  function maskHash(hash) {
    if (!hash || typeof hash !== 'string') return hash;
    if (hash.length >= 32) return hash.slice(0, 8) + '...' + hash.slice(-6);
    return hash;
  }

  function maskMatchingData(matching) {
    if (!matching || typeof matching !== 'object') return matching;
    const masked = {};
    for (const [k, v] of Object.entries(matching)) {
      if (typeof v === 'string') {
        masked[k] = maskHash(v);
      } else if (typeof v === 'object' && v !== null) {
        masked[k] = maskMatchingData(v);
      } else {
        masked[k] = v;
      }
    }
    return masked;
  }

  function parseQueryParams(url) {
    const params = {};
    try {
      const qIdx = url.indexOf('?');
      if (qIdx !== -1) {
        const usp = new URLSearchParams(url.slice(qIdx));
        for (const [k, v] of usp.entries()) {
          params[k] = v;
        }
      }
    } catch {}
    return params;
  }

  function getHumanDescription(eventName, p) {
    const curr = p.currency || 'USD';
    const amt = typeof p.amount === 'number' ? (p.amount / 100).toFixed(2) : null;

    if (eventName === 'openai::sdk_init') {
      return 'SDK initialized. Browser connected to OpenAI Ads.';
    }
    if (eventName === 'page_viewed') {
      return 'Page view tracked. Tells OpenAI the visitor loaded this URL.';
    }
    if (eventName === 'item_viewed') {
      const title = p.contents?.[0]?.name || p.title || 'Product';
      return 'Viewed item "' + title + '"' + (amt ? ' (' + curr + ' ' + amt + ')' : '') + '.';
    }
    if (eventName === 'items_added') {
      return 'Added item to cart' + (amt ? ' (' + curr + ' ' + amt + ')' : '') + '.';
    }
    if (eventName === 'checkout_started') {
      return 'Checkout initiated with ' + (p.contents?.length || 1) + ' item(s)' + (amt ? ' totaling ' + curr + ' ' + amt : '') + '.';
    }
    if (eventName === 'order_created') {
      return 'Conversion completed! Order placed' + (amt ? ' for ' + curr + ' ' + amt : '') + '.';
    }
    if (eventName === 'lead_submitted') {
      return 'Lead form submitted. High-intent conversion event.';
    }
    return 'Event "' + eventName + '" sent to OpenAI with ' + Object.keys(p).length + ' parameter(s).';
  }

  function getAttributionPurpose(eventName) {
    switch (eventName) {
      case 'page_viewed':
        return 'Top of funnel audience tracking, retargeting pool building, and click-through attribution.';
      case 'item_viewed':
        return 'Catalog interaction analysis, intent detection, and dynamic product recommendations.';
      case 'items_added':
        return 'High-intent cart tracking, abandoned cart recovery, and mid-funnel bid optimization.';
      case 'checkout_started':
        return 'Checkout pipeline progression and purchase propensity scoring.';
      case 'order_created':
        return 'ROAS calculation, conversion attribution, machine-learning smart bidding optimization.';
      case 'lead_submitted':
        return 'B2B lead generation conversion attribution and customer lifetime value modeling.';
      default:
        return 'Custom audience segmentation and campaign conversion measurement.';
    }
  }

  /**
   * PUSHES LIVE FORMATTED DEBUGGER LOG TO BROWSER CONSOLE
   */
  function logLiveDebuggerToConsole(details) {
    if (!isConsoleLoggingEnabled) return;

    const {
      type,
      eventName,
      pixelId,
      status,
      statusMessage,
      parameters,
      rawPayload,
      url,
      method,
      httpStatus,
      duration,
      timestamp
    } = details;

    const timeStr = formatTime(timestamp);
    const badgeColor = status === 'ERROR' ? '#ef4444' : (status === 'WARNING' ? '#f59e0b' : '#10a37f');
    const typeLabel = type === 'NETWORK_REQUEST' ? 'HTTP BATCH' : 'oaiq("measure")';

    console.groupCollapsed(
      '%c[OpenAI Pixel Live Debugger]%c %c' + (eventName || 'Batch Request') + '%c %c' + (status || '200 OK') + '%c @ ' + timeStr,
      'background: #0f172a; color: #10a37f; font-weight: 700; padding: 2px 7px; border-radius: 3px; font-size: 11px;',
      '',
      'background: #0284c7; color: #ffffff; font-weight: 700; padding: 2px 7px; border-radius: 3px; font-size: 11px;',
      '',
      'background: ' + badgeColor + '; color: #ffffff; font-weight: 700; padding: 2px 7px; border-radius: 3px; font-size: 11px;',
      'color: #94a3b8; font-size: 11px; margin-left: 4px;'
    );

    // 1. Client-Friendly Human Explanations
    const humanSummary = getHumanDescription(eventName || '', parameters || {});
    const whySent = getAttributionPurpose(eventName || '');

    console.log('%c[WHAT WAS SENT / HUMAN SUMMARY]:%c ' + humanSummary, 'font-weight: bold; color: #10a37f; font-size: 11.5px;', 'color: #334155; font-size: 11.5px;');
    console.log('%c[WHY IS THIS SENT / ATTRIBUTION]:%c ' + whySent, 'font-weight: bold; color: #0284c7; font-size: 11.5px;', 'color: #334155; font-size: 11.5px;');

    // 2. Organized Request Breakdown
    console.group('%c📊 ORGANIZED REQUEST & PARAMETERS', 'font-weight: bold; color: #0f172a;');
    console.log('Event Name:', eventName || 'N/A');
    console.log('Pixel ID (pid):', pixelId || Array.from(activePixelIds)[0] || 'Auto-detected');
    console.log('Trigger Mechanism:', typeLabel);
    console.log('Timestamp (ms):', timestamp, '(' + new Date(timestamp).toISOString() + ')');
    
    if (statusMessage) {
      console.log('Validation Note:', statusMessage);
    }

    if (parameters) {
      if (typeof parameters.amount === 'number') {
        const curr = parameters.currency || 'USD';
        const major = (parameters.amount / 100).toFixed(2);
        console.log('Monetary Amount:', parameters.amount, 'minor units (=' + curr + ' ' + major + ')');
      }
      if (parameters.contents && Array.isArray(parameters.contents) && parameters.contents.length > 0) {
        console.log('Commerce Contents Items (' + parameters.contents.length + ' item' + (parameters.contents.length > 1 ? 's' : '') + '):');
        console.table(parameters.contents);
      }
      if (parameters.user) {
        console.log('Customer Matching Data (SHA-256 Masked):', maskMatchingData(parameters.user));
      }
      console.log('All Organized Parameters:', parameters);
    }
    console.groupEnd();

    // 3. Raw Request Payload & Transport Data
    console.group('%c⚡ RAW NETWORK PAYLOAD & TRANSPORT', 'font-weight: bold; color: #0f172a;');
    if (url) {
      console.log('Request Endpoint URL:', url);
      console.log('HTTP Method:', method || 'POST');
      if (typeof httpStatus !== 'undefined') console.log('HTTP Status Code:', httpStatus);
      if (typeof duration !== 'undefined') console.log('Network Latency:', duration + 'ms');
      console.log('Parsed Query String Parameters:', parseQueryParams(url));
    }
    console.log('Exact Raw Payload:', rawPayload || parameters || {});
    console.groupEnd();

    console.groupEnd();
  }

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

      logLiveDebuggerToConsole({
        type: 'API_CALL',
        eventName: 'openai::sdk_init',
        pixelId: pixelId,
        status: 'INITIALIZED',
        statusMessage: 'Pixel initialized successfully on page',
        parameters: config,
        rawPayload: Array.from(args),
        timestamp: Date.now()
      });

      sendToContentScript('PIXEL_INIT_DETECTED', {
        pixelId: pixelId,
        config: config,
        allPixelIds: Array.from(activePixelIds),
        timestamp: Date.now(),
        rawArgs: Array.from(args)
      });
    } else if (command === 'measure') {
      const eventName = args[1] || 'unknown';
      const properties = (args.length >= 3 && typeof args[2] === 'object' && args[2] !== null) ? args[2] : {};
      const options = (args.length >= 4 && typeof args[3] === 'object' && args[3] !== null) ? args[3] : {};
      const recipients = Array.from(activePixelIds);
      const now = Date.now();

      logLiveDebuggerToConsole({
        type: 'API_CALL',
        eventName: eventName,
        pixelId: recipients[0] || null,
        status: 'CAPTURED',
        statusMessage: 'Event captured via window.oaiq("measure")',
        parameters: properties,
        rawPayload: Array.from(args),
        timestamp: now
      });

      sendToContentScript('PIXEL_EVENT_CAPTURED', {
        name: eventName,
        parameters: properties,
        options: options,
        args: Array.from(args).slice(1),
        method: 'measure',
        pixelId: recipients[0] || null,
        recipients: recipients,
        allPixelIds: recipients,
        url: window.location.href,
        pathname: window.location.pathname,
        title: document.title,
        timestamp: now,
        caller: 'oaiq("measure")'
      });
    } else if (command === 'measureSingle') {
      const targetPixelId = args[1] || null;
      const eventName = args[2] || 'unknown';
      const properties = (args.length >= 4 && typeof args[3] === 'object' && args[3] !== null) ? args[3] : {};
      const options = (args.length >= 5 && typeof args[4] === 'object' && args[4] !== null) ? args[4] : {};

      if (targetPixelId) activePixelIds.add(targetPixelId);
      const allPixels = Array.from(activePixelIds);
      const now = Date.now();

      logLiveDebuggerToConsole({
        type: 'API_CALL',
        eventName: eventName,
        pixelId: targetPixelId,
        status: 'CAPTURED',
        statusMessage: 'Event captured via window.oaiq("measureSingle")',
        parameters: properties,
        rawPayload: Array.from(args),
        timestamp: now
      });

      sendToContentScript('PIXEL_EVENT_CAPTURED', {
        name: eventName,
        parameters: properties,
        options: options,
        args: Array.from(args).slice(2),
        method: 'measureSingle',
        pixelId: targetPixelId,
        targetPixelId: targetPixelId,
        recipients: targetPixelId ? [targetPixelId] : [],
        allPixelIds: allPixels,
        url: window.location.href,
        pathname: window.location.pathname,
        title: document.title,
        timestamp: now,
        caller: 'oaiq("measureSingle")'
      });
    }
  }

  function hookOaiqFunction(oaiqFn) {
    if (!oaiqFn || oaiqFn.__OPENAI_INSPECTOR_WRAPPED__) return oaiqFn;

    if (Array.isArray(oaiqFn.q)) {
      for (const callArgs of oaiqFn.q) {
        handleOaiqCall(callArgs);
      }
    }

    const wrappedOaiq = function () {
      handleOaiqCall(arguments);
      return oaiqFn.apply(this, arguments);
    };

    for (const key of Object.keys(oaiqFn)) {
      wrappedOaiq[key] = oaiqFn[key];
    }
    wrappedOaiq.q = oaiqFn.q || [];
    wrappedOaiq.__OPENAI_INSPECTOR_WRAPPED__ = true;

    return wrappedOaiq;
  }

  if (typeof window.oaiq !== 'undefined') {
    window.oaiq = hookOaiqFunction(window.oaiq);
  }

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

  function isTargetNetworkUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const clean = url.toLowerCase();
    return (
      clean.includes('bzr.openai.com') ||
      clean.includes('bzrcdn.openai.com') ||
      clean.includes('/v1/sdk/events') ||
      (clean.includes('/events') && (clean.includes('pid=') || clean.includes('oaiq')))
    );
  }

  function processCapturedNetworkRequest(netData) {
    const { url, method, status, payload, duration, timestamp } = netData;
    const queryParams = parseQueryParams(url);
    const pid = queryParams.pid || null;

    if (payload && typeof payload === 'object' && Array.isArray(payload.events)) {
      payload.events.forEach((evt, idx) => {
        logLiveDebuggerToConsole({
          type: 'NETWORK_REQUEST',
          eventName: evt.type || 'unknown_event',
          pixelId: pid,
          status: status >= 200 && status < 300 ? '202 ACCEPTED' : ('STATUS ' + status),
          statusMessage: 'Batch Item #' + (idx + 1) + ' of ' + payload.events.length + ' transmitted to bzr.openai.com',
          parameters: evt.data || {},
          rawPayload: evt,
          url: url,
          method: method,
          httpStatus: status,
          duration: duration,
          timestamp: evt.timestamp_ms || timestamp
        });
      });
    } else {
      logLiveDebuggerToConsole({
        type: 'NETWORK_REQUEST',
        eventName: 'OpenAI Network Transmission',
        pixelId: pid,
        status: status >= 200 && status < 300 ? '202 ACCEPTED' : ('STATUS ' + status),
        statusMessage: 'Direct payload sent to ' + url,
        parameters: payload || {},
        rawPayload: payload,
        url: url,
        method: method,
        httpStatus: status,
        duration: duration,
        timestamp: timestamp
      });
    }
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
          const netData = {
            url: url,
            method: method,
            status: response.status,
            ok: response.ok,
            duration: Date.now() - start,
            timestamp: start,
            payload: payload
          };
          processCapturedNetworkRequest(netData);
          sendToContentScript('NETWORK_REQUEST_CAPTURED', netData);
          return response;
        }).catch((err) => {
          const netData = {
            url: url,
            method: method,
            status: 0,
            ok: false,
            error: err.message,
            duration: Date.now() - start,
            timestamp: start,
            payload: payload
          };
          processCapturedNetworkRequest(netData);
          sendToContentScript('NETWORK_REQUEST_CAPTURED', netData);
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
        const netData = {
          url: url,
          method: 'POST',
          status: 200,
          ok: true,
          timestamp: Date.now(),
          payload: payload,
          via: 'sendBeacon'
        };
        processCapturedNetworkRequest(netData);
        sendToContentScript('NETWORK_REQUEST_CAPTURED', netData);
      }
      return originalSendBeacon.apply(this, arguments);
    };
  }

  // Wrap XMLHttpRequest
  if (typeof window.XMLHttpRequest === 'function') {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__oaiq_url = url;
      this.__oaiq_method = method;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const url = this.__oaiq_url;
      if (isTargetNetworkUrl(url)) {
        let payload = null;
        try {
          payload = typeof body === 'string' ? JSON.parse(body) : body;
        } catch {
          payload = body;
        }

        const start = Date.now();
        this.addEventListener('loadend', () => {
          const netData = {
            url: url,
            method: this.__oaiq_method || 'POST',
            status: this.status,
            ok: this.status >= 200 && this.status < 300,
            duration: Date.now() - start,
            timestamp: start,
            payload: payload,
            via: 'xhr'
          };
          processCapturedNetworkRequest(netData);
          sendToContentScript('NETWORK_REQUEST_CAPTURED', netData);
        });
      }
      return origSend.apply(this, arguments);
    };
  }

  // SPA navigation notification
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

  // Initial announcement
  sendToContentScript('BRIDGE_READY', {
    url: window.location.href,
    hasOaiqGlobal: typeof window.oaiq !== 'undefined',
    pixelIds: Array.from(activePixelIds),
    isInitialized: isInitialized
  });
})();
