/**
 * OpenAI Ads Pixel Inspector - Server-Side Tracking Detection Engine
 * 
 * Inspects and correlates multi-layer signals to determine if Server-Side
 * tracking (Server GTM, Cloudflare Zaraz, Meta CAPI Gateway, First-Party Proxy)
 * is active on the website.
 */

const KNOWN_STANDARD_HOSTS = new Set([
  'www.googletagmanager.com',
  'googletagmanager.com',
  'www.google-analytics.com',
  'google-analytics.com',
  'analytics.google.com',
  'connect.facebook.net',
  'bzrcdn.openai.com',
  'bzr.openai.com'
]);

const SERVER_TAGGING_SUBDOMAIN_KEYWORDS = [
  'sgtm', 'ss', 'server', 'data', 'metrics', 'tagging', 'analytics', 'collect', 'track', 'gtm'
];

/**
 * Checks if a URL represents a Server-Side GTM or First-Party Tagging Loader
 */
export function isCustomTaggingServerUrl(url, pageHostname) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, 'https://example.com');
    const host = parsed.hostname.toLowerCase();
    
    // Ignore official 3rd party vendor CDNs
    if (KNOWN_STANDARD_HOSTS.has(host)) return false;

    const path = parsed.pathname.toLowerCase();
    const isGtmScript = path.endsWith('/gtm.js') || path.includes('/gtag/js') || path.includes('/gtm-');
    const isCollectEndpoint = path.includes('/g/collect') || path.includes('/mp/collect') || path.includes('/j/collect') || path.includes('/collect');
    const isStapeHost = host.includes('stape.io') || host.includes('stape.net') || host.includes('stape.cloud');

    // If it's a Stape hosted tagging server
    if (isStapeHost) return true;

    // If it's a first-party subdomain (e.g. sgtm.brand.com or metrics.brand.com) serving GTM or collection endpoints
    if (isGtmScript || isCollectEndpoint) {
      return true;
    }

    // Check subdomain keywords matching page root domain
    if (pageHostname) {
      const pageDomain = pageHostname.replace(/^www\./, '');
      if (host.endsWith(pageDomain) && host !== pageDomain && host !== 'www.' + pageDomain) {
        const subdomainPart = host.replace('.' + pageDomain, '');
        if (SERVER_TAGGING_SUBDOMAIN_KEYWORDS.some((kw) => subdomainPart.includes(kw))) {
          if (isGtmScript || isCollectEndpoint || path.includes('/events')) {
            return true;
          }
        }
      }
    }
  } catch {}
  return false;
}

/**
 * Evaluates full tabState to detect server-side tracking infrastructure
 */
export function analyzeServerSideTracking(tabState = {}) {
  const signals = [];
  const technologies = new Set();
  const serverEndpoints = new Set();

  const url = tabState.url || '';
  let pageHostname = '';
  try {
    pageHostname = new URL(url).hostname;
  } catch {}

  const serverSignals = tabState.serverSideSignals || {};
  const dataLayer = tabState.dataLayer || [];
  const network = tabState.network || [];
  const serverHeaders = tabState.serverHeaders || [];
  const events = tabState.events || [];

  // =========================================================================
  // 1. DOM Script Loaders (sGTM custom loaders, Zaraz, Stape)
  // =========================================================================
  const scriptSources = [
    ...(tabState.pixel?.scriptSources || []),
    ...(serverSignals.scriptSources || []),
    ...(serverSignals.customLoaders || [])
  ];

  for (const src of scriptSources) {
    if (isCustomTaggingServerUrl(src, pageHostname)) {
      try {
        const u = new URL(src);
        serverEndpoints.add(u.origin);
      } catch {}
      technologies.add('Server Google Tag Manager (sGTM)');
      signals.push({
        type: 'sgtm_custom_loader',
        category: 'DOM Loader',
        name: 'Server GTM Custom Domain Loader',
        detail: `Script loaded from custom endpoint: ${src}`,
        confidence: 'HIGH'
      });
    }

    if (src.includes('/zaraz/s.js') || src.includes('zaraz.js')) {
      technologies.add('Cloudflare Zaraz Edge Tagging');
      signals.push({
        type: 'zaraz_loader',
        category: 'Edge Worker',
        name: 'Cloudflare Zaraz Edge Script',
        detail: `Zaraz edge worker injected: ${src}`,
        confidence: 'HIGH'
      });
    }
  }

  // Cloudflare Zaraz Global Object
  if (serverSignals.hasZarazGlobal) {
    technologies.add('Cloudflare Zaraz Edge Tagging');
    signals.push({
      type: 'zaraz_global',
      category: 'Edge Worker',
      name: 'Cloudflare Zaraz Runtime Global',
      detail: 'window.zaraz runtime object detected on page',
      confidence: 'HIGH'
    });
  }

  // =========================================================================
  // 2. Data Layer Transport URLs & GA4 server_container_url
  // =========================================================================
  for (const item of dataLayer) {
    const itemData = item.data || item;
    if (typeof itemData === 'object' && itemData !== null) {
      // Check config object with transport_url or server_container_url
      for (const [key, val] of Object.entries(itemData)) {
        if (typeof val === 'string' && (key === 'transport_url' || key === 'server_container_url' || key === 'server_url')) {
          try {
            serverEndpoints.add(new URL(val).origin);
          } catch {}
          technologies.add('Server Google Tag Manager (sGTM)');
          signals.push({
            type: 'transport_url',
            category: 'Data Layer Configuration',
            name: `GTM / GA4 ${key} Override`,
            detail: `Configured Tagging Server Container: ${val}`,
            confidence: 'HIGH'
          });
        }
      }
    }
  }

  if (serverSignals.transportUrls && Array.isArray(serverSignals.transportUrls)) {
    for (const tUrl of serverSignals.transportUrls) {
      try {
        serverEndpoints.add(new URL(tUrl).origin);
      } catch {}
      technologies.add('Server Google Tag Manager (sGTM)');
      signals.push({
        type: 'transport_url',
        category: 'Tag Configuration',
        name: 'GTM Transport URL Override',
        detail: `Tagging server endpoint: ${tUrl}`,
        confidence: 'HIGH'
      });
    }
  }

  // =========================================================================
  // 3. Network Requests to Custom Tagging Server Endpoints
  // =========================================================================
  for (const req of network) {
    const reqUrl = req.url || '';
    if (isCustomTaggingServerUrl(reqUrl, pageHostname)) {
      try {
        serverEndpoints.add(new URL(reqUrl).origin);
      } catch {}
      technologies.add('Server Google Tag Manager (sGTM)');
      signals.push({
        type: 'server_network_hit',
        category: 'Network Stream',
        name: 'First-Party Server Collection Request',
        detail: `${req.method || 'POST'} ${reqUrl}`,
        confidence: 'HIGH'
      });
    }
  }

  // =========================================================================
  // 4. Response Headers from Tagging Server
  // =========================================================================
  for (const h of serverHeaders) {
    const hName = (h.name || '').toLowerCase();
    const hVal = h.value || '';

    if (hName === 'x-gtm-server-preview' || hName === 'x-server-gtm') {
      technologies.add('Server Google Tag Manager (sGTM)');
      signals.push({
        type: 'sgtm_header',
        category: 'Server Response Header',
        name: 'sGTM Preview/Server Header',
        detail: `${h.name}: ${hVal}`,
        confidence: 'HIGH'
      });
    }

    if (hName.includes('stape')) {
      technologies.add('Stape Cloud Tagging Server');
      signals.push({
        type: 'stape_header',
        category: 'Server Infrastructure',
        name: 'Stape Tagging Container Header',
        detail: `${h.name}: ${hVal}`,
        confidence: 'HIGH'
      });
    }

    if (hName === 'server' && hVal.toLowerCase().includes('cloudflare zaraz')) {
      technologies.add('Cloudflare Zaraz Edge Tagging');
      signals.push({
        type: 'zaraz_header',
        category: 'Server Response Header',
        name: 'Cloudflare Zaraz Server Header',
        detail: `Server: ${hVal}`,
        confidence: 'HIGH'
      });
    }
  }

  // =========================================================================
  // 5. CAPI Event Deduplication Pairing (event_id)
  // =========================================================================
  const conversionEvents = events.filter((e) => {
    const n = (e.name || '').toLowerCase();
    return n.includes('order_created') || n.includes('purchase') || n.includes('initiate_checkout') || n.includes('add_to_cart');
  });

  const eventsWithId = conversionEvents.filter((e) => e.eventId && String(e.eventId).trim() !== '');
  if (conversionEvents.length > 0 && eventsWithId.length === conversionEvents.length) {
    technologies.add('CAPI Deduplication Pairing Active');
    signals.push({
      type: 'capi_pairing',
      category: 'Event Schema',
      name: 'Server-Side Event ID Pairing',
      detail: `All ${conversionEvents.length} conversion event(s) carry a unique event_id for dual-channel browser & server deduplication.`,
      confidence: 'MEDIUM'
    });
  }

  // =========================================================================
  // 6. Synthesis & Confidence Calculation
  // =========================================================================
  let detected = signals.length > 0;
  let confidence = 'NONE';
  let status = 'not_detected';

  const hasHighConfidenceSignal = signals.some((s) => s.confidence === 'HIGH');
  const hasMediumConfidenceSignal = signals.some((s) => s.confidence === 'MEDIUM');

  if (hasHighConfidenceSignal) {
    confidence = 'HIGH';
    status = 'active';
  } else if (hasMediumConfidenceSignal) {
    confidence = 'MEDIUM';
    status = 'potential';
  }

  let primaryTechnology = 'None';
  if (technologies.has('Server Google Tag Manager (sGTM)')) {
    primaryTechnology = 'Server Google Tag Manager (sGTM)';
  } else if (technologies.has('Cloudflare Zaraz Edge Tagging')) {
    primaryTechnology = 'Cloudflare Zaraz Edge Tagging';
  } else if (technologies.has('Stape Cloud Tagging Server')) {
    primaryTechnology = 'Stape Tagging Server';
  } else if (technologies.has('CAPI Deduplication Pairing Active')) {
    primaryTechnology = 'Conversions API (CAPI) Hybrid Setup';
  }

  let summaryText = 'No server-side tracking or custom tagging server containers detected on this page.';
  if (status === 'active') {
    const epStr = serverEndpoints.size > 0 ? ` on ${Array.from(serverEndpoints).join(', ')}` : '';
    summaryText = `Server-side tracking actively detected via ${primaryTechnology}${epStr}.`;
  } else if (status === 'potential') {
    summaryText = 'Potential server-side tracking indicators detected (conversion event deduplication IDs configured).';
  }

  return {
    detected: detected,
    status: status,
    confidence: confidence,
    primaryTechnology: primaryTechnology,
    technologies: Array.from(technologies),
    serverEndpoints: Array.from(serverEndpoints),
    signals: signals,
    signalsCount: signals.length,
    summaryText: summaryText
  };
}
