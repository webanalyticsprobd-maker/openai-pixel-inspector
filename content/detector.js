/**
 * OpenAI Ads Pixel Inspector - DOM & Script Detector
 */

export function detectOpenAIPixelInDOM() {
  const result = {
    detected: false,
    confidence: 'none', // 'high' | 'medium' | 'low' | 'none'
    scriptSources: [],
    inlineScriptsFound: 0,
    pixelIds: []
  };

  const scripts = Array.from(document.querySelectorAll('script'));
  const OFFICIAL_SDK_PATTERN = /bzrcdn\.openai\.com\/sdk\/oaiq(?:\.min)?\.js/i;
  const PIXEL_ID_PATTERN = /oaiq\s*\(\s*["']init["']\s*,\s*(?:\{[^}]*pixelId\s*:\s*["']([^"']+)["']|["']([^"']+)["'])/g;

  for (const script of scripts) {
    // 1. External Script Check
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
      // 2. Inline Script Check
      const content = script.textContent;
      if (content.includes('oaiq')) {
        result.inlineScriptsFound++;
        if (!result.detected) {
          result.detected = true;
          result.confidence = 'medium';
        }

        // Try to regex extract pixelId
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
