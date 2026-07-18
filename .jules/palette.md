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

## 2026-06-20 - [Ambient Sound Toggle Feedback]
**Learning:** Toggle buttons for ambient background processes (like noise generators) require immediate visual and programmatic feedback to confirm state. Without an "active" class and `aria-pressed` attribute, users are left uncertain if a sound is playing, especially in noisy environments or when using assistive technology.
**Action:** Always implement a dedicated `.active` visual state and synchronized `aria-pressed` attribute for toggle controls. Refactor toggle logic to support mutually exclusive modes (e.g., Pink vs Brown noise) to prevent audio stacking and UI confusion.

## 2026-06-27 - [Filter Tab Accessibility Pattern]
**Learning:** Navigation filters built with custom `div` elements are often overlooked in accessibility audits because they visually resemble tabs but lack the underlying semantic structure. This prevents keyboard users from discovering and interacting with content filtering options.
**Action:** Always apply the ARIA `tablist` and `tab` pattern to filter groups. This includes `role="tablist"`, `role="tab"`, `tabindex="0"`, and `aria-selected` state management, along with dedicated keyboard listeners for `Enter` and `Space`.

## 2026-07-11 - [Context-Aware Search & Shortcut Hints]
**Learning:** Global search shortcuts (Ctrl+K) should prioritize the relevant search input for the current module to minimize user interaction steps. Additionally, embedding shortcut hints directly into input placeholders significantly increases user awareness and adoption of productivity features.
**Action:** Implement context-aware focus logic in global shortcut listeners. Update input placeholders to include keyboard shortcut hints (e.g., "(Ctrl+K)") in all searchable modules.

## 2026-07-18 - [Calendar Task Entry Points & Contextual Modal Open]
**Learning:** Custom calendar views and detail panels often present "dead-end" states where task listing details are shown but the ability to add new tasks for that date is missing. Ensuring that any dynamic view element (like a selected day pane) includes a clear, accessible, and focusable add-task button linked directly to the task creation modal with pre-filled context prevents navigation frustration and ensures complete functional coverage across both Calendar and Task managers.
**Action:** Always provide contextual action buttons (e.g., "+" or "Add Task") in date-specific visual elements. When rendering these dynamically, manage their visibility and event bindings programmatically, and ensure they carry descriptive `aria-label` properties.
