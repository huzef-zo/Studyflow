## 2025-05-15 - [Initial UX Audit]
**Learning:** The application uses custom `div`-based checkboxes which are completely inaccessible to keyboard users and screen readers. They lack focus indicators, ARIA roles, and keyboard event handlers.
**Action:** Transition custom checkboxes to use `tabindex="0"`, `role="checkbox"`, and appropriate ARIA attributes. Implement a global focus-visible style to ensure all interactive elements have clear visual feedback when navigated via keyboard.

## 2026-05-23 - [Calendar Accessibility Pattern]
**Learning:** Interactive grid elements (calendar days) and custom checkboxes in secondary views often lack the accessibility markers established in primary views. Ensuring consistent keyboard interaction (Enter/Space) and ARIA roles across all views is critical for a unified accessible experience.
**Action:** When implementing or auditing new views, verify that all custom interactive elements replicate the accessible patterns (tabindex, role, keyboard listeners) used in the main Task Manager.

## 2026-05-30 - [Global Modal and Deep Linking Patterns]
**Learning:** Standardizing modal components with ARIA roles (dialog) and accessible labeling (aria-labelledby) improves screen reader navigation across the entire app. Additionally, using URL parameters for deep-linking (e.g., action=add) provides a seamless "Quick Action" experience from the Dashboard to secondary modules.
**Action:** Always include 'role="dialog"' and linked title IDs in modal utilities. Implement URL parameter detection in module initializers to support context-aware navigation.

## 2024-06-05 - [Discoverability of Keyboard-Only Features]
**Learning:** Features only accessible via keyboard shortcuts (like "Skip Session") are effectively non-existent for mobile users and remain hidden from new users. Bringing these features into the UI via icon buttons (with appropriate ARIA labels) significantly improves discoverability and touch accessibility without cluttering the interface.
**Action:** Audit logic for keyboard-only triggers and ensure corresponding UI elements exist for touch/mouse users.

## 2026-06-13 - [Knowledge Vault Accessibility & Shortcuts]
**Learning:** List-based navigation in secondary modules (like Notes) often relies on click-only `div` elements, creating barriers for keyboard and screen reader users. Additionally, text-heavy editors lack standard productivity shortcuts found in native apps.
**Action:** Enhance item lists with `role="button"`, `tabindex="0"`, and `aria-current` to indicate state. Implement event delegation for `Enter`/`Space` keys. For editor fields, add standard shortcuts like `Ctrl/Cmd + S` to bridge the gap between web and desktop experiences.
