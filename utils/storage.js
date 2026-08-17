/**
 * OpenAI Ads Pixel Inspector - Chrome Storage Wrapper
 */

const DEFAULT_SETTINGS = {
  debugLogging: false,
  autoExpandEvents: false,
  networkInterception: true,
  theme: 'dark',
  customEventValidation: true
};

export async function getSettings() {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve(DEFAULT_SETTINGS);
      return;
    }
    chrome.storage.local.get(['settings'], (result) => {
      resolve(Object.assign({}, DEFAULT_SETTINGS, result.settings || {}));
    });
  });
}

export async function saveSettings(settings) {
  return new Promise((resolve) => {
    if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
      resolve(settings);
      return;
    }
    chrome.storage.local.set({ settings: settings }, () => {
      resolve(settings);
    });
  });
}
