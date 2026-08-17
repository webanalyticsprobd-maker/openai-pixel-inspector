# Changelog

All notable changes to the **OpenAI Ads Pixel Inspector** Chrome Extension will be documented in this file.

## [1.0.0] - 2026-08-17

### Added
- **Manifest V3 Architecture**:
  - Secure 4-way execution model across `MAIN` world (Page Bridge), `ISOLATED` world (Content Script), Background Service Worker, and Popup UI.
  - Least-privilege permissions (`activeTab`, `storage`, `tabs`).
- **OpenAI Ads Measurement Verification**:
  - Official SDK detection (`https://bzrcdn.openai.com/sdk/oaiq.min.js`).
  - Global `window.oaiq` stub hooking, queue replay, and proxy engine.
  - Extraction of Pixel IDs from `oaiq("init", { pixelId: "..." })`.
- **Standard & Custom Event Monitoring**:
  - Full support for standard events: `page_viewed` (`PageView`), `order_created`, `lead_created`, `contents_viewed`, `subscription_created`, `add_to_cart`, `checkout_started`.
  - Comprehensive custom event engine detecting and validating arbitrary custom event names and properties.
- **Attribution & `oppref` Inspector**:
  - Detection of `oppref` URL query parameters.
  - Inspection of `__oppref` 1st-party cookie and client-side storage.
- **Parameter Validation & Schemas**:
  - Decoupled schema registry (`validators/schemas.js`).
  - Strict type checking, ISO 4217 currency validation, and minor-unit checks for `amount`.
  - Issue engine generating structured error, warning, and recommendation items.
- **Lifecycle & Network Correlation**:
  - 4-stage tracking state verification: `Fired (JS) -> Sent (Network POST) -> HTTP 200 OK -> Validated`.
  - Interception of outgoing `fetch` and `sendBeacon` requests to `bzr.openai.com`.
- **Duplicate & Deduplication Diagnostics**:
  - Detection of multiple pixel initializations and duplicate conversion events.
  - Diagnostic comparison of browser `event_id` with server-side CAPI pairing requirements.
- **UI & Analytics Features**:
  - Multi-tab UI: Overview, Events Timeline, Attribution (`oppref`), Issues, and Audit & Export.
  - Live search and category filters (`All`, `Standard`, `Custom`, `Errors`, `Warnings`, `Network`).
  - Raw JSON modal viewer with one-click copy.
  - Audit report generation with Markdown, JSON, and CSV export.
  - Options page for customizing preferences and debug logging.
- **SPA Support**:
  - History state listener for `pushState`, `replaceState`, and `popstate` supporting Next.js, React, Vue, Angular, and Shopify.
- **Complete Test Suite**:
  - 7 interactive test bench scenarios in `test-site/`.
