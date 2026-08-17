# Chrome Web Store Submission Guide & Listing Metadata — OpenAI Ads Pixel Inspector

> Last Updated: 2026-08-17  
> Extension Version: `1.1.0`  
> Target Manifest: `Manifest V3`

---

## 1. Store Listing Information

### **Extension Name** (Max 75 chars)
`OpenAI Ads Pixel Inspector`

### **Short Description** (Max 132 chars)
`Debug, validate, audit, and inspect OpenAI Ads Pixel (oaiq) events, parameters, schemas, network beacons, and conversion attribution.`

### **Detailed Description** (Formatted for Chrome Web Store)
```text
OpenAI Ads Pixel Inspector is the definitive developer and analytics diagnostic tool built for inspecting, validating, and auditing OpenAI Ads Pixel (oaiq) tracking implementations.

Whether you are configuring OpenAI Ads tracking through Google Tag Manager (GTM), custom JavaScript, Shopify, WooCommerce, or Single Page Applications (Next.js, React, Vue), this extension gives you complete visibility into pixel lifecycles, schemas, parameters, and network beacons in real time.

━━━━━━━━━━━━━━━━━━━━━
🌟 KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━

1. Strict Schema & Parameter Validation
• Validates standard OpenAI Pixel events (page_viewed, item_viewed, item_added_to_cart, search_performed, checkout_started, purchase_made, lead_generated, contact_us_requested, content_viewed, feedback_submitted).
• Validates ISO 4217 currency minor units (e.g. integer cents for USD/BDT/EUR) across event-level and item-level contents arrays.
• Enforces non-empty strings, numeric types, boolean flags, and ISO 8601 timestamps.

2. Real-Time Network Beacon Monitor
• Observes HTTP POST requests and beacon transmissions dispatched to OpenAI Ads ingestion endpoints (bzr.openai.com).
• Inspects request headers, payload objects, timestamps, and HTTP 200 delivery statuses.

3. Conversion Attribution Diagnostics (oppref)
• Automatically detects OpenAI click reference tokens (?oppref=...) across URL query parameters, local storage, and the __oppref first-party cookie.
• Verifies attribution readiness for hybrid client-side pixel and Conversions API (CAPI) setups.

4. Multi-Page User Journey Audit & Deduplication
• Tracks events across the full browsing journey with step counters and page path history.
• Automatically flags double-fired events and rapid consecutive duplicates.

5. Chrome Side Panel & Professional UI
• Switch effortlessly between popup mode and Chrome's native Side Panel for wide-screen debugging alongside DevTools.
• Features sleek Dark and Light themes with polished typography.

6. One-Click Audit Export
• Copy formatted Markdown audit reports directly into your clipboard.
• Export CSV and JSON logs for client reporting, documentation, and QA sign-offs.

━━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY & SECURITY FIRST
━━━━━━━━━━━━━━━━━━━━━
• 100% Client-Side: Operates entirely in your browser without collecting, storing, or transmitting data to any external server.
• Zero telemetry or third-party tracking scripts.
• Fully open source on GitHub: https://github.com/webanalyticsprobd-maker/openai-pixel-inspector

━━━━━━━━━━━━━━━━━━━━━
🛠️ HOW TO USE
━━━━━━━━━━━━━━━━━━━━━
1. Navigate to any website with OpenAI Ads Pixel (oaiq) installed.
2. Open the extension icon or dock it in the Side Panel.
3. Browse products, add items to cart, or trigger conversion actions.
4. Inspect real-time parameter validation, network signals, and journey audit tables!
```

### **Category**
`Developer Tools`

### **Single Purpose**
`Inspect, validate, and audit OpenAI Ads Pixel tracking events, parameters, network requests, and conversion attribution.`

### **Primary Language**
`English`

---

## 2. Permissions Justification (For Chrome Reviewers)

| Permission | Type | Detailed Plain-English Justification for Review Team |
|---|---|---|
| `storage` | `permissions` | Used to save developer UI preferences (Dark/Light mode) and maintain local session journey logs across tab refreshes. No data leaves the device. |
| `tabs` | `permissions` | Required to read the active tab URL and domain name to display the current target website hostname in the inspector header and target scans. |
| `activeTab` | `permissions` | Allows temporary diagnostic access to inspect the active tab when the developer clicks the extension icon. |
| `cookies` | `permissions` | Required to verify the presence, value, and expiration of OpenAI's privacy-safe click reference cookie (`__oppref`) for attribution audits. |
| `webRequest` | `permissions` | Used to passively monitor background HTTP POST beacon requests sent to OpenAI ingestion endpoints (`bzr.openai.com`) to confirm event transmission. |
| `sidePanel` | `permissions` | Allows opening the inspector in Chrome's native Side Panel for wide-screen debugging alongside DevTools. |
| `<all_urls>` | `host_permissions` | Required to allow developers and analytics engineers to test and debug OpenAI Pixel implementations across any website they develop or manage. |

---

## 3. Privacy & Data Use Disclosures (CWS Form)

- **Does the extension collect user data?** `No`
- **Data Use Certifications:**
  - ✅ *The extension does NOT sell data to third parties.*
  - ✅ *The extension does NOT use or transfer data for purposes unrelated to the item's core functionality.*
  - ✅ *The extension does NOT use or transfer data to determine creditworthiness or for lending purposes.*

---

## 4. Graphics & Asset Requirements

| Asset | Dimensions | Purpose |
|---|---|---|
| **Store Icon** | 128 × 128 px PNG | Official Chrome Web Store listing icon (already in `icons/icon128.png`) |
| **Screenshot 1** | 1280 × 800 px (or 640 × 400) | Overview Tab showing Tracking Summary, Event Metrics, and Dark Theme |
| **Screenshot 2** | 1280 × 800 px (or 640 × 400) | Events Tab showing Parameter Validation Table and 3-row Lifecycle Box |
| **Screenshot 3** | 1280 × 800 px (or 640 × 400) | Network Tab showing real-time `bzr.openai.com` requests and payload viewer |
| **Screenshot 4** | 1280 × 800 px (or 640 × 400) | Journey Audit Tab with timeline table and Markdown/CSV export buttons |
| **Promo Tile (Small)** *(Optional)* | 440 × 280 px | Featured store tile |
| **Marquee Promo** *(Optional)* | 1400 × 560 px | Web store hero banner |
