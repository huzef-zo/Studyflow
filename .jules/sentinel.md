# Sentinel's Journal

## 2025-05-14 - Initial Setup
**Vulnerability:** N/A
**Learning:** Initializing the sentinel journal.
**Prevention:** N/A

## 2025-05-14 - Robust HTML Escaping
**Vulnerability:** XSS via Attribute Injection
**Learning:** Using document.createElement('div').textContent to escape HTML is insufficient because it does not escape single or double quotes, making it unsafe for use within HTML attributes.
**Prevention:** Use a robust regex-based replacement map that explicitly handles &, <, >, ", and ' to ensure safety in both text content and attribute contexts.

## 2025-05-15 - Data Import as XSS Vector
**Vulnerability:** Persistent XSS via Malicious Backup Import
**Learning:** Security controls must be applied at the rendering layer even for "internal" fields like IDs, dates, and priorities. Since the application supports importing JSON backups, any field in the storage can be manipulated by an attacker to execute scripts if not escaped during render.
**Prevention:** Treat all data retrieved from Storage as untrusted. Consistently escape all dynamic values injected into HTML templates (including attribute values), regardless of their source or perceived safety.

## 2025-05-30 - Inline Event Handlers as XSS Vector
**Vulnerability:** XSS via Attribute Decoding in Event Handlers
**Learning:** Inline event handlers like `onclick` are particularly dangerous because browsers decode HTML entities within attribute values before executing them as JavaScript. This means that even if a value is "escaped" for HTML, it may still execute script if injected into an event handler.
**Prevention:** Avoid inline event handlers for dynamic content. Use event delegation with `addEventListener` on a stable parent element, and store dynamic data (like IDs) in `data-*` attributes which are properly HTML-escaped.

## 2026-06-05 - CSS Injection via Unvalidated Colors
**Vulnerability:** CSS Injection/XSS via Sector Color Strings
**Learning:** `App.escapeHtml` is insufficient for preventing injection within `style` attributes. A malicious user can provide a color value like `red; background-image: url('javascript:alert(1)')` to break out of the intended CSS property and inject arbitrary styles or script (in older/vulnerable browsers).
**Prevention:** Strictly validate dynamic CSS properties using regex (e.g., hex code validation `/^#([0-9A-F]{3}){1,2}$/i`) at both the Storage layer (input/import) and the UI layer. Ensure validation logic is encapsulated within the data module to provide defense-in-depth even for programmatic or imported updates.
