## 2025-05-15 - [Initial UX Audit]
**Learning:** The application uses custom `div`-based checkboxes which are completely inaccessible to keyboard users and screen readers. They lack focus indicators, ARIA roles, and keyboard event handlers.
**Action:** Transition custom checkboxes to use `tabindex="0"`, `role="checkbox"`, and appropriate ARIA attributes. Implement a global focus-visible style to ensure all interactive elements have clear visual feedback when navigated via keyboard.
