/**
 * OpenAI Ads Pixel Inspector - Attribution & oppref Inspector
 */

export function inspectAttribution() {
  const attribution = {
    oppref: null,
    source: null, // 'url' | 'cookie' | 'storage'
    urlDetected: false,
    cookieDetected: false,
    storageDetected: false,
    details: {}
  };

  // 1. Inspect URL parameters
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
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] URL param inspection error:', err);
  }

  // 2. Inspect Cookies (__oppref)
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
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] Cookie inspection error:', err);
  }

  // 3. Inspect Client-side Storage
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
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] LocalStorage inspection error:', err);
  }

  return attribution;
}
