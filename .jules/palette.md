## 2025-05-15 - [Initial UX Audit]
**Learning:** The application uses custom `div`-based checkboxes which are completely inaccessible to keyboard users and screen readers. They lack focus indicators, ARIA roles, and keyboard event handlers.
**Action:** Transition custom checkboxes to use `tabindex="0"`, `role="checkbox"`, and appropriate ARIA attributes. Implement a global focus-visible style to ensure all interactive elements have clear visual feedback when navigated via keyboard.

## 2026-05-23 - [Calendar Accessibility Pattern]
**Learning:** Interactive grid elements (calendar days) and custom checkboxes in secondary views often lack the accessibility markers established in primary views. Ensuring consistent keyboard interaction (Enter/Space) and ARIA roles across all views is critical for a unified accessible experience.
**Action:** When implementing or auditing new views, verify that all custom interactive elements replicate the accessible patterns (tabindex, role, keyboard listeners) used in the main Task Manager.

## 2026-05-30 - [Global Modal and Deep Linking Patterns]
**Learning:** Standardizing modal components with ARIA roles (dialog) and accessible labeling (aria-labelledby) improves screen reader navigation across the entire app. Additionally, using URL parameters for deep-linking (e.g., action=add) provides a seamless "Quick Action" experience from the Dashboard to secondary modules.
**Action:** Always include 'role="dialog"' and linked title IDs in modal utilities. Implement URL parameter detection in module initializers to support context-aware navigation.
