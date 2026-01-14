---
name: i18n-expert
description: Use this skill when adding new translations, refactoring hardcoded text to i18n keys, or fixing RTL layout issues for Hebrew.
---

# Hebrew i18n Expert Skill

## Workflow
1. **Key Extraction:** When I give you a component, extract all strings into `messages/he.json`.
2. **Translation:** Provide accurate Hebrew translations. If unsure, ask for the "vibe" (formal vs. informal).
3. **RTL Checking:** Ensure the `dir="rtl"` attribute is respected and that icons are mirrored where appropriate.

## Library Preference
- Use `next-intl` for translations.
- Use `useTranslations` hook in Client Components and `getTranslations` in Server Components.