# OpenAI Ads Pixel Inspector

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-10a37f.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OpenAI Ads Spec](https://img.shields.io/badge/OpenAI-Ads%20Measurement%20v1.1-black.svg)](https://developers.openai.com/ads/measurement-pixel)

A professional, high-performance browser extension (Manifest V3) for debugging, schema validation, journey auditing, deduplication diagnostics, and live network monitoring for the **OpenAI Ads Pixel** (`oaiq`).

---

## 1. Key Features

### ⚙️ 1. Generic Schema-Driven Parameter Validation Engine
* **Decoupled Declarative Schemas**: Validation rules match the official OpenAI specifications (`developers.openai.com/ads/supported-events`).
* **Strict Parameter Error Detection**:
  - **Presence**: Verifies required and conditional parameters (`currency` required when `amount` is present).
  - **Data Types**: Strictly validates `string`, `integer`, `number`, `boolean`, `array`, `object`.
  - **ISO 4217 Currency**: Enforces 3-letter uppercase ISO currency codes (`USD`, `EUR`, `GBP`, etc.).
  - **Minor Currency Units (Cents)**: Detects and flags decimal floats and major unit mistakes (e.g. sending `350` instead of `35000` for a $350.00 product).
  - **Catalog Items (`contents[]`)**: Deep validation of item objects (`id`, `name`, `content_type`, `quantity`, `amount`, `variant_dict`).
  - **Empty / Null Values**: Flags `null`, `undefined`, and empty strings (`""`).
* **4-Level UI Severity Badges**:
  - `✅ Valid` — Fully compliant parameter.
  - `⚠️ Warning` — Minor formatting recommendation.
  - `❌ Error` — Missing required parameter or invalid data type.
  - `ℹ️ Info` — Extra custom parameters or optional empty collections.

---

### 🚦 2. 5-Stage Lifecycle Separation (Fired vs. Sent vs. Validated)
Never collapses tracking states into a single generic "working" status. Each event drawer provides an independent 5-stage lifecycle audit:
* **Pixel Call**: `✅ Fired` (Captured in JavaScript execution via `oaiq()`).
* **Network Request**: `✅ Sent` vs `⏳ Pending` vs `⚠️ Not Observed`.
* **Server Response**: `✅ Successful (HTTP 200)` vs `❌ HTTP 4xx/5xx` vs `⏳ Awaiting`.
* **Parameters**: `✅ Valid` vs `⚠️ Warning` vs `❌ Error`.
* **Validation**: `✅ Passed` vs `⚠️ Warning` vs `❌ Failed`.

---

### 🌐 3. Real-Time Network Monitor
* **Observable HTTP POST & Beacon Log**: Intercepts and logs all outgoing requests to `bzr.openai.com/v1/sdk/events`.
* **Complete Network Details**:
  - **Method**: `POST`
  - **Endpoint URL**: Normalized target endpoint
  - **HTTP Status**: `HTTP 200`, `HTTP 400`, or `Blocked / Net Error`
  - **Timestamp**: Exact execution time
  - **Correlated Event**: `order_created`, `items_added`, `page_viewed`, etc.
  - **Safe Headers**: Permitted metadata (`Content-Type`, `Origin`, `User-Agent`).
  - **Request Body**: Parsed parameter keys and structured payloads.
* **Zero-Leak Security**: Passwords, auth tokens, secrets, cookies, and personal data are strictly redacted (`[REDACTED]`).

---

### 🗺️ 4. Full Session User Journey Timeline & Deduplication Audit
* **Multi-Page Session Persistence**: Retains event history across navigations, reloads, and multi-step checkouts instead of clearing on navigation.
* **Action-Based Duplicate Detection**: Distinguishes intentional repeated user actions (e.g. browsing Product A then Product B) from accidental duplicate double-fires on the same action.
* **Strict Real Event ID Tracking**: Displays authentic `event_id` values sent by the site; never generates synthetic UUIDs.
* **Dedicated Audit Tables**:
  - **User Journey Timeline**: Chronological steps, event names, page URLs, request counts, and duplicate statuses.
  - **Event Health Summary**: Aggregate counts and assessment breakdown per event type.

---

### 🗂️ 5. Native Chrome Side Panel Support
* **One-Click Header Button (`[ | ]`)**: Opens the inspector inside Chrome's native Side Panel.
* **Browse Without Interruptions**: Pinned alongside your website so you can click, add to cart, and checkout without the extension popup closing.
* **Responsive Layout**: Dynamically expands from standard popup (`480px`) to 100% full height and width.

---

### 🌓 6. Dark & Light Theme with Persistence
* **One-Click Theme Toggle (`☀️ / 🌙`)**: Seamless switching between clean Light mode and sleek Dark mode.
* **Local Storage Persistence**: Automatically remembers your preferred theme across browser restarts.

---

### 🎯 7. Attribution Inspector (`oppref`)
* **Automatic Detection**: Captures `oppref` query parameters from ChatGPT / OpenAI Ads traffic.
* **Cookie & Storage Auditing**: Verifies `__oppref` 1st-party cookie storage (approx. 30-day TTL) and local storage persistence.
* **CAPI Compatibility Guidance**: Helps ensure hybrid Conversions API pairing.

---

### 📊 8. Comprehensive Audit Export (Markdown, CSV, JSON)
* **📋 Copy Markdown**: Formatted audit report ready to paste into GitHub, Jira, Slack, or client documentation.
* **📊 Export CSV**: Spreadsheet-ready table compatible with Google Sheets and Microsoft Excel.
* **📥 Export JSON**: Full structured state dump for technical analysis.

---

### ⚡ 9. SPA & Modern Framework Support
* **Virtual Navigation Tracking**: Listens to `history.pushState`, `history.replaceState`, and `popstate`.
* **Universal Compatibility**: Works seamlessly with React, Next.js, Vue, Angular, Shopify, WooCommerce, Webflow, and custom web apps.

---

## 2. Verified OpenAI Ads Measurement Specifications

The extension is grounded in official OpenAI conversion tracking specifications:
- **Global SDK API**: `window.oaiq` (with fallback queue `oaiq.q = []`)
- **Official SDK Source**: `https://bzrcdn.openai.com/sdk/oaiq.min.js`
- **Click Identifier / Attribution**: `oppref` URL query parameter & `__oppref` 1st-party cookie (approx. 30-day TTL)
- **Ingestion Endpoint**: `https://bzr.openai.com/v1/sdk/events`
- **Initialization Signatures**:
  - `oaiq("init", { pixelId: "<PIXEL-ID>", debug?: boolean })`
  - `oaiq("measureSingle", "<PIXEL-ID>", eventName, properties, options)`
- **Standard Events Supported**:
  - `page_viewed` (traffic)
  - `contents_viewed` (catalog / product views)
  - `items_added` (add to cart)
  - `checkout_started` (begin checkout)
  - `order_created` (purchase e-commerce)
  - `lead_created` (lead forms)
  - `registration_completed` (sign-ups)
  - `appointment_scheduled` (bookings)
  - `subscription_created` (recurring memberships)
  - `trial_started` (free trials)
  - `app_installed`, `app_opened`
- **Custom Events Supported**: Arbitrary custom action names with custom event parameters.

---

## 3. High-Level Architecture

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           CURRENT WEBPAGE (MAIN WORLD)                      │
 │                                                                             │
 │    window.oaiq <───> [ content/page-bridge.js ]                             │
 │    - Proxy oaiq("init"), oaiq("measure"), oaiq("measureSingle")             │
 │    - Intercept outgoing fetch / sendBeacon to bzr.openai.com                │
 │    - Observe SPA history.pushState / popstate                               │
 └──────────────────────────────────┬──────────────────────────────────────────┘
                                    │ window.postMessage (Structured Token)
 ┌──────────────────────────────────▼──────────────────────────────────────────┐
 │                        CONTENT SCRIPT (ISOLATED WORLD)                      │
 │                                                                             │
 │                      [ content/content.js ]                                 │
 │    - DOM Script Scanner (bzrcdn.openai.com)                                 │
 │    - Attribution Parser (oppref URL query + __oppref cookie)                │
 └──────────────────────────────────┬──────────────────────────────────────────┘
                                    │ chrome.runtime.sendMessage
 ┌──────────────────────────────────▼──────────────────────────────────────────┐
 │                       BACKGROUND SERVICE WORKER (MV3)                       │
 │                                                                             │
 │                   [ background/service-worker.js ]                          │
 │    - Normalizer & EventStore (Map<tabId, EventStore>)                       │
 │    - Schema-Driven Parameter Validator Engine                               │
 │    - Browser Network Interceptor (chrome.webRequest)                        │
 │    - Full Session Journey History & Duplicate Deduplication                 │
 │    - Dynamic Action Badge Counter                                           │
 └──────────────────────────────────▲──────────────────────────────────────────┘
                                    │ chrome.runtime.sendMessage / state sync
 ┌──────────────────────────────────┴──────────────────────────────────────────┐
 │                     POPUP UI & CHROME SIDE PANEL                            │
 │                                                                             │
 │  [ Overview | Events | Network | oppref | Issues | Journey Audit & Export ] │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Installation & Loading in Chrome

1. Clone or download this repository:
   ```bash
   git clone https://github.com/webanalyticsprobd-maker/openai-pixel-inspector.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** in the upper-left corner.
5. Select the `openai-pixel-inspector` project directory.
6. Open any live website or test page.

---

## 5. Local Test Suite

The repository includes a standalone test bench with 6 pre-built scenarios located in `test-site/`:

| Test Page | Purpose |
|---|---|
| `test-site/index.html` | Hub connecting all test scenarios |
| `test-site/pixel-valid.html` | Valid pixel initialization, `oppref` token, and standard conversions |
| `test-site/custom-events.html` | Arbitrary custom event builder and presets |
| `test-site/pixel-invalid.html` | Missing required fields, invalid types, and error flags |
| `test-site/duplicate-pixel.html` | Multiple pixel IDs and duplicate event deduplication |
| `test-site/spa-test.html` | Single Page Application route navigation simulation |
| `test-site/pixel-missing.html` | Clean page with no tracking scripts |

---

## 6. Privacy & Security

- **100% Local In-Browser Processing**: No telemetry, no external server callbacks, and no third-party tracking.
- **Least-Privilege MV3 Permissions**: Uses standard `activeTab`, `storage`, `cookies`, `webRequest`, and `sidePanel` permissions.
- **Sensitive Data Redaction**: Automatically redacts sensitive fields (`password`, `secret`, `token`, `bearer`) if present in payloads.
- **Strict Origin & Source Guards**: Message channels validate origin sources to prevent cross-origin injection.

---

## 7. License

MIT License. Developed for web analytics professionals, conversion engineers, and digital marketers.
