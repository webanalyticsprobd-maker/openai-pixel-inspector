# Privacy Policy for OpenAI Ads Pixel Inspector

**Last Updated:** August 17, 2026

## 1. Overview
**OpenAI Ads Pixel Inspector** is a developer debugging and audit tool designed to inspect and validate OpenAI Ads Pixel (`oaiq`) tracking events, schemas, parameters, network signals, and conversion attribution (`oppref`).

Your privacy is paramount. This extension operates **strictly locally on your device** within your browser and does not transmit, collect, or store any personal data on external servers.

---

## 2. Information Handled by the Extension
- **Webpage Diagnostics & Pixel Signals:** The extension passively listens to client-side `oaiq(...)` JavaScript calls and outgoing network beacons to OpenAI's ingestion endpoints (`bzr.openai.com`) on pages you actively browse.
- **Conversion Attribution Parameters:** The extension reads URL query parameters (e.g., `?oppref=...`) and cookies (`__oppref`) strictly for diagnosing whether conversion attribution is working on the inspected site.
- **Local Storage:** Session state, theme preferences (Dark/Light), and audit logs are stored locally in your browser via `chrome.storage.local` and `chrome.storage.session`.

---

## 3. Data Collection & Third-Party Sharing
- **No Remote Data Collection:** We do NOT collect, harvest, sell, or transmit any user data, browsing history, form inputs, credentials, or personally identifiable information (PII) to any external server or third party.
- **No Analytics / Telemetry:** The extension contains zero tracking pixels, telemetry SDKs, or third-party analytics scripts.
- **No Data Monetization:** We do not monetize, rent, or transfer user data under any circumstances.

---

## 4. Permissions & Justification
- `storage`: Required to save user preferences (Dark/Light mode) and local session logs.
- `tabs` & `activeTab`: Required to display the inspected website domain name in the inspector header and target tabs for debugging.
- `cookies`: Required to audit the presence and expiration of OpenAI's privacy-safe click reference cookie (`__oppref`).
- `webRequest`: Required to passively detect HTTP 200 responses for background beacons dispatched to `bzr.openai.com`.
- `sidePanel`: Required to allow users to dock the inspector in Chrome's side panel for a wide-screen developer experience.
- `host_permissions (<all_urls>)`: Required to inspect OpenAI pixel implementations across any website where tracking is installed.

---

## 5. User Control & Data Deletion
All captured event data and journey timelines can be cleared instantly by clicking the **Clear / Reset (🗑️)** button in the inspector header. Uninstalling the extension completely deletes all locally stored data.

---

## 6. Contact & Support
If you have questions or feedback regarding this Privacy Policy, please contact:
- **Repository Issues:** [https://github.com/webanalyticsprobd-maker/openai-pixel-inspector/issues](https://github.com/webanalyticsprobd-maker/openai-pixel-inspector/issues)
- **Developer:** Web Analytics Pro BD (`support@webanalyticsprobd.com`)
