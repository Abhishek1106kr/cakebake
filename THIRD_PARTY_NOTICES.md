# THIRD_PARTY_NOTICES — Tresor

## Reference corpus

No files from the reference captures are included in Tresor. This covers photography, fonts, icons, logos, theme code and scripts from:
- amintiri.in
- belagio.in
- lapatisseriecyrillignac.com
- parisbaguette.com
- bakingo.com

See `REFERENCES.md` §7 for the audit.

## Planned open-source dependencies

| Component | Licence | Use |
|---|---|---|
| Next.js | MIT | Framework |
| React / React DOM | MIT | UI |
| Framer Motion | MIT | Motion system |
| lucide-react | ISC | Icons |
| Cormorant Garamond (Google Fonts, via `next/font`) | SIL Open Font License 1.1 | Display type |
| Inter (Google Fonts, via `next/font`) | SIL Open Font License 1.1 | UI / body type |

Fonts are self-hosted at build time by `next/font`, so no request goes to Google at runtime.

## Generated media

Video and image assets generated with Higgsfield for Tresor are original outputs, stored under `public/`.

**To check before launch:**
- Confirm that the Higgsfield plan used grants commercial usage rights for the outputs.
- Record the plan, account and generation date for each asset here.

## Pending

Real Tresor photography and video will replace generated placeholders when supplied. Credit the photographer here if the contract requires it.
