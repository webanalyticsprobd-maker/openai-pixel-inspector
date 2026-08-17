# OpenAI Ads Pixel Inspector

[![Manifest V3](https://img.shields.io/badge/Chrome%20Extension-Manifest%20V3-10a37f.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A professional, high-performance browser extension (Manifest V3) for debugging, event parameter validation, attribution diagnostics, and implementation auditing for the **OpenAI Ads Pixel** (`oaiq`).

---

## 1. Overview & Core Product Principles

Similar to *Meta Pixel Helper*, *Google Tag Assistant*, and *TikTok Pixel Helper*, the **OpenAI Ads Pixel Inspector** is purpose-built specifically for OpenAI's conversion measurement architecture.

The inspector separates the tracking lifecycle into 4 distinct verification stages:
```text
Pixel Script Detected
       ↓
Pixel Initialized (oaiq("init", { pixelId: "..." }))
       ↓
Event Function Executed (oaiq("measure", eventName, ...))
       ↓
Event Captured & Normalized
       ↓
Network Request Observed (POST to bzr.openai.com)
       ↓
HTTP Delivery Confirmed (Status 200 OK)
       ↓
Event Parameters & Schema Validated (Types, Formats, Required Fields)
```

---

## 2. Verified OpenAI Ads Measurement Specifications

The extension is grounded in official OpenAI conversion tracking specifications:
- **Global SDK API**: `window.oaiq` (with fallback queue `oaiq.q = []`)
- **Official SDK Source**: `https://bzrcdn.openai.com/sdk/oaiq.min.js`
- **Click Identifier / Attribution**: `oppref` URL query parameter & `__oppref` 1st-party cookie (approx. 30-day TTL)
- **Ingestion Endpoint**: `https://bzr.openai.com/v1/sdk/events` (and `bzr.openai.com` endpoints)
- **Initialization Signature**: `oaiq("init", { pixelId: "<PIXEL-ID>", debug?: boolean })`
- **Consent Signature**: `oaiq("consent", true | false)`
- **Event Signature**: `oaiq("measure", eventName, properties, options)`
- **Standard Events Supported**:
  - `page_viewed` (alias `PageView`)
  - `order_created` (purchase e-commerce conversions)
  - `lead_created` (lead forms / actions)
  - `contents_viewed` (product / content catalog views)
  - `subscription_created` (recurring memberships)
  - `add_to_cart` / `AddToCart`
  - `checkout_started` / `BeginCheckout`
- **Custom Events Supported**: Arbitrary custom action names (e.g. `video_play_milestone`, `quote_calculator_submitted`, `ai_assistant_interaction`).

---

## 3. High-Level Architecture

```text
 ┌─────────────────────────────────────────────────────────────────────────────┐
 │                           CURRENT WEBPAGE (MAIN WORLD)                      │
 │                                                                             │
 │    window.oaiq <───> [ content/page-bridge.js ]                             │
 │    - Proxy measure/init calls                                               │
 │    - Intercept outgoing fetch / sendBeacon to bzr.openai.com                │
 │    - Observer SPA history.pushState / popstate                              │
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
 │    - Parameter & Event Validator Engine                                     │
 │    - Duplicate Pixel & Event Deduplication Engine                           │
 │    - Dynamic Action Badge Counter                                           │
 └──────────────────────────────────▲──────────────────────────────────────────┘
                                    │ chrome.runtime.sendMessage / state sync
 ┌──────────────────────────────────┴──────────────────────────────────────────┐
 │                                 POPUP UI                                    │
 │                                                                             │
 │    [ Overview | Events Timeline | oppref | Issues | Audit & Export ]        │
 └─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Features

### 🔍 1. Real-time Event Timeline & Custom Events
- Real-time stream of all standard and custom OpenAI events.
- Expandable event drawers showing every parameter, data type validation check, and minor-unit recommendations.
- Interactive Search and Category Filters (`All`, `Standard`, `Custom`, `Errors`, `Warnings`, `Network`).
- Raw JSON modal viewer with a single-click "Copy JSON" action.

### 🎯 2. Attribution Inspector (`oppref`)
- Automatic detection of `oppref` query parameters from ad traffic.
- Inspection of `__oppref` 1st-party cookie and storage persistence.

### 🛡️ 3. Validation & Issue Engine
- Flags missing required parameters (e.g. missing `currency` on `order_created`).
- Checks ISO 4217 currency codes (`USD`, `EUR`, `GBP`, etc.).
- Verifies minor currency units (cents, e.g. `2599` for $25.99).
- Enforces valid custom event name patterns and flags SDK keyword collisions.

### 🔄 4. Duplicate Detection & CAPI Diagnostics
- Detects multiple conflicting Pixel IDs initialized on the same page.
- Identifies duplicate events dispatched with identical `event_id` or payloads within short timeframes.
- Validates presence of `event_id` for hybrid browser + server (CAPI) deduplication.

### 📊 5. Audit Report & Export
- Generates a full tracking audit summary score (`Pass`, `Warning`, `Fail`).
- Export actions:
  - **Copy Markdown Report**: Formatted markdown summary ready for client sharing.
  - **Export JSON**: Complete structured data dump of tab state and events.
  - **Export CSV**: Tabular breakdown of events, timestamps, IDs, and parameters.

### ⚡ 6. SPA & Modern Framework Support
- Hooks into `history.pushState`, `history.replaceState`, and `popstate`.
- Monitors virtual route transitions across React, Next.js, Vue, Angular, and Shopify.

---

## 5. Installation & Loading in Chrome

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle on **Developer mode** in the upper-right corner.
4. Click **Load unpacked** in the upper-left corner.
5. Select the `openai-pixel-inspector` project directory.
6. Open any website or load the included test suite (`test-site/index.html`).

---

## 6. Testing with the Local Test Suite

The repository includes a standalone test bench with 6 pre-built scenarios located in `test-site/`:

| Test Page | Purpose |
|-----------|---------|
| [test-site/index.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/index.html) | Hub connecting all test scenarios |
| [test-site/pixel-valid.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/pixel-valid.html) | Valid pixel initialization, `oppref` token, and standard conversions |
| [test-site/custom-events.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/custom-events.html) | Arbitrary custom event builder and presets |
| [test-site/pixel-invalid.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/pixel-invalid.html) | Missing required fields, invalid types, and error flags |
| [test-site/duplicate-pixel.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/duplicate-pixel.html) | Multiple pixel IDs and duplicate event deduplication |
| [test-site/spa-test.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/spa-test.html) | Single Page Application route navigation simulation |
| [test-site/pixel-missing.html](file:///C:/Users/FLS/.gemini/antigravity/scratch/openai-pixel-inspector/test-site/pixel-missing.html) | Clean page with no tracking scripts |

---

## 7. Privacy & Security

- **100% Local In-Browser Processing**: No telemetry, no external server callbacks, and no analytics collection.
- **Least-Privilege Permissions**: Uses standard `activeTab`, `storage`, and `tabs` permissions.
- **Sensitive Data Redaction**: Automatically redacts sensitive fields (`password`, `secret`, `token`, `bearer`) if present in payloads.
- **Strict Origin & Source Guards**: Message channels validate origin sources to prevent cross-origin injection.
