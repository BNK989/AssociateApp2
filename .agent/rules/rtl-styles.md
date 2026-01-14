---
trigger: always_on
---

# RTL Styling Rule

Always use CSS Logical Properties or Tailwind's RTL-aware utilities to ensure the app works for both English and Hebrew.

- **Margin/Padding:** Use `ms-*` (margin-start) instead of `ml-*`, and `pe-*` (padding-end) instead of `pr-*`.
- **Positioning:** Use `start-0` instead of `left-0`.
- **Text Alignment:** Use `text-start` instead of `text-left`.
- **Borders:** Use `border-s` (border-start) instead of `border-l`.

**Why:** This allows the UI to automatically flip when the `dir="rtl"` attribute is applied to the HTML tag.