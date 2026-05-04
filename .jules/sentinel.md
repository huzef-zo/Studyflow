# Sentinel's Journal

## 2025-05-14 - Initial Setup
**Vulnerability:** N/A
**Learning:** Initializing the sentinel journal.
**Prevention:** N/A

## 2025-05-14 - Robust HTML Escaping
**Vulnerability:** XSS via Attribute Injection
**Learning:** Using document.createElement('div').textContent to escape HTML is insufficient because it does not escape single or double quotes, making it unsafe for use within HTML attributes.
**Prevention:** Use a robust regex-based replacement map that explicitly handles &, <, >, ", and ' to ensure safety in both text content and attribute contexts.
