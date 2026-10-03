# Changelog

All notable changes to the **OpenAI Ads Pixel Inspector** Chrome Extension will be documented in this file.

## [1.8.6] - 2026-10-03

### Fixed & Enhanced
- **Custom Event Detection & Extraction**:
  - Fixed false-positive `MISSING_CUSTOM_EVENT_NAME` error when custom events are delivered via network request payloads containing `custom_event_name` (e.g. `{"type": "custom", "custom_event_name": "get_a_quote"}`).
  - Added multi-source resolution for `custom_event_name` across wire protocol envelope, request options, parameter dictionary, and payload data.
  - Dynamically displayed the actual custom event name (`get_a_quote`) across popup cards, devtools inspector, search filters, and audit summaries.
  - Preserved strict validation to catch genuine errors when custom event names are truly missing, empty, or violate naming constraints (>64 chars, invalid characters).
  - Categorized custom event names dynamically in event dictionary with distinct purple visual indicator and clean formatting.
  - Expanded automated test suite to 32 tests covering all custom event network and parameter scenarios.


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
