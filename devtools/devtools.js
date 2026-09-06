/**
 * OpenAI Ads Pixel Inspector - Chrome DevTools Extension Initializer
 */

chrome.devtools.panels.create(
  'OpenAI Pixel',
  'icons/icon32.png',
  'devtools/panel.html',
  function (panel) {
    // DevTools panel created successfully
  }
);
