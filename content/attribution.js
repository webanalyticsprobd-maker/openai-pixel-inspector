/**
 * OpenAI Ads Pixel Inspector - Attribution & oppref Inspector
 */

export function inspectAttribution() {
  const attribution = {
    oppref: null,
    obref: null,
    source: null, // 'url' | 'cookie' | 'storage' | 'network'
    urlDetected: false,
    cookieDetected: false,
    storageDetected: false,
    details: {}
  };

  // 1. Inspect URL parameters (oppref, obref)
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const refVal = urlParams.get('obref') || urlParams.get('oppref') || urlParams.get('__obref') || urlParams.get('__oppref');
    if (refVal && refVal.trim()) {
      attribution.obref = refVal.trim();
      attribution.oppref = refVal.trim();
      attribution.source = 'url';
      attribution.urlDetected = true;
      attribution.details.urlParam = refVal.trim();
    }
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] URL param inspection error:', err);
  }

  // 2. Inspect Cookies (__obref, __oppref, obref, oppref)
  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [name, ...rest] = c.trim().split('=');
      if (name === '__obref' || name === '__oppref' || name === 'obref' || name === 'oppref') {
        const val = rest.join('=');
        if (val) {
          attribution.cookieDetected = true;
          const decoded = decodeURIComponent(val);
          if (!attribution.obref) {
            attribution.obref = decoded;
            attribution.oppref = decoded;
            attribution.source = 'cookie';
          }
          attribution.details.cookieValue = decoded;
        }
      }
    }
  } catch (err) {
    console.debug('[OpenAI Pixel Inspector] Cookie inspection error:', err);
  }

  // 3. Inspect Client-side Storage
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('__obref') || localStorage.getItem('obref') || localStorage.getItem('__oppref') || localStorage.getItem('oppref');
      if (stored) {
        attribution.storageDetected = true;
        if (!attribution.obref) {
          attribution.obref = stored;
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
