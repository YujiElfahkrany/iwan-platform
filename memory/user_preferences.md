---
name: user-preferences
description: Yuji's working preferences for this project
metadata:
  type: user
---

- Builds in Arabic + English (ar/en) — always update both message files together.
- Currency is LE (Egyptian Pounds), not USD — update any "USD" labels to LE.
- Prefers features shipped end-to-end in one go (model → API → UI → i18n).
- Spotted hardcoded English strings quickly — always use next-intl `useTranslations` in client pages.
