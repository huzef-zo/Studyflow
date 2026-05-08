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
