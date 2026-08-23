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

## 2026-07-19 - [Updating Scheduled Study Windows and Modal Forms]
**Learning:** Configurable study schedules should always provide equal-parity actions for creation and updating (CRUD parity). When a scheduling block can only be deleted and recreated, users experience high friction during minor schedule changes. Standardizing modal forms to accept an optional ID parameter allows single-function dialog reusability with contextual labeling, while custom validation (e.g., ensuring start time is before end time) prevents database corruption before state persistence.
**Action:** Refactor study window lists to expose accessible edit actions with consistent icons and screen-reader tags. Update modal forms to support dual add/edit paths using single dynamic modals, backed by robust validation and success toasts.

## 2026-07-25 - [Duplicate Input ID Elimination in Search]
**Learning:** Having duplicate input elements with identical IDs (like the double `#search-notes` in `notes.html`) causes severe accessibility and functional degradation. Screen readers get confused by redundant form controls, and standard DOM bindings like `document.getElementById` only capture the first element, leaving the other one visually present but entirely non-functional.
**Action:** Always audit form HTML files to ensure unique DOM element IDs and remove redundant duplicate input fields to preserve assistive technology clarity and reliable interactivity.

## 2026-08-01 - [ARIA Labels for Icon-Only and Symbolic Buttons]
**Learning:** Decorative icon buttons and custom control elements (such as close icons or action items in settings) that lack text labels are completely unannounced or misannounced (e.g. reading multiplication signs like "&times;" as "times") to screen readers. Failing to include clear ARIA labels makes these vital interactive pathways completely inaccessible.
**Action:** Consistently supply descriptive `aria-label` attributes to any button that uses only an SVG icon, symbol, or shorthand text character for its content. Incorporate a pre-commit static scan or verification script to catch missing ARIA indicators on interactive elements.

## 2026-08-05 - [Interactive Chronological Study History and Period Navigation]
**Learning:** Replacing planned slots/schedules ("Chronological Map") with an interactive actual Focus History log categorized by Day, Week, or Month relative to the active selected date on the calendar dramatically increases the usability and utility of a temporal map view. Standardizing the period filters with the established accessible `tablist`/`tab` pattern keeps navigation fully keyboard and screen-reader accessible.
**Action:** Always map chronologically recorded telemetry (like focus sessions) to their contextual objects (like tasks and subjects) with safe fallback handlers for deleted entities. Implement accessible filter selectors using `role="tablist"` and keydown listeners to synchronize filtered lists without manual reload.

## 2026-08-08 - [Dynamic ARIA Labels for Dynamic Subtask Controls]
**Learning:** In highly dynamic views where list elements like subtasks have repetitive action buttons (such as cycle increment/decrement controls), using static ARIA labels results in a confusing experience for screen reader users because they cannot tell which subtask the control belongs to. Providing context-aware dynamic ARIA labels (e.g. including the subtask title in the label) significantly enhances accessibility.
**Action:** Always interpolate the parent or context entity's title/name into the `aria-label` of repetitive inline buttons (e.g., `"Increase completed cycles for [Subtask Title]"`) during rendering instead of relying on generic labels.

## 2026-08-15 - [Simplifying Subtask Cycle Estimations to Spent Sessions Only]
**Learning:** Forcing users to estimate and configure a session/cycle target for minor subtasks adds unnecessary planning overhead. Showing progress as a simple, non-fractional "X sessions spent" count instead of "X/Y Cycles" aligns better with intuitive tracking and results in a cleaner, less cluttered interface.
**Action:** Completely remove the target estimation configuration ("Estimated Cycles") input field from subtask editor forms and streamline the display indicators in list and active views to show only the count of completed sessions (e.g., "1 session" or "3 sessions").

## 2026-08-22 - [Explicit Label Associations and ARIA Names for Form Controls]
**Learning:** Form controls that rely solely on `placeholder` attributes or adjacent `<label>` text without explicit `for="..."` bindings fail accessibility standards. Screen readers cannot properly announce unlabelled inputs (such as textareas or note editors), and clicking adjacent label text fails to focus the associated form field.
**Action:** Ensure every form `<label>` specifies `for="[input-id]"` matching the target input's ID, and add explicit `aria-label` attributes to standalone or unlabelled inputs.

## 2026-08-22 - [Responsive Horizontal Scroll Layout for Daily Progress Metrics]
**Learning:** Dynamic SVG components (such as circular progress indicators rendered within daily status cards) without explicit layout containers and dimension constraints can lose responsive context and overflow into massive vertical blocks. Using CSS flex containers with smooth horizontal scrolling (`overflow-x: auto`), explicit card flex parameters (`flex: 0 0 110px`), and fixed dimensions on inner SVGs ensures clean, mobile-friendly horizontal progression cards.
**Action:** Always encapsulate dynamic multi-day or repeated metric cards within a scrollable horizontal flex container (`.daily-bar-scroll`), specifying `flex-shrink: 0` on card items and fixed `width`/`height` on SVG graphics.
