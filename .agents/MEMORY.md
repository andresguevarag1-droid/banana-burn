# Repository memory

What AI Office's Agents have learned about this repository, one entry per line. Every Agent reads it at the start of a task. The Floor's Manager curates it through pull requests, merging duplicates and dropping stale entries: change it the same way.

- A fresh checkout has no node_modules: run `npm ci` (or `npm ci --ignore-scripts`) first, or vitest fails with "vitest: not found" / "Cannot find module 'vitest/config'"; the full `npx vitest run` takes about 6 s.
- CI runs `npx tsc --noEmit -p .`, `npx eslint src scripts --quiet` and `npx vitest run` from the repo root; all pass on main, and the marketing .mjs files fall under the lint.
- Marketing docs (e.g. marketing/estrategia/) get a vitest file src/lib/<doc-name>.test.ts that reads the Markdown with readFileSync and checks figures, tables and brand rules against the code; model it on meta-ads-noviembre.test.ts or embudo-noviembre.test.ts.
- The text in src/lib/trial.ts (PROMO_TERMS, reminderLine) uses a non-breaking space (U+00A0) before "%", so normalize it before comparing that copy with Markdown documents.
- The app's menu labels are in src/components/app-nav.tsx (for example, /app/nutricion is shown as "Comida" and /app/suscripcion as "Mi plan"), so check copy that names a tab against that file.
- `next dev` runs in demo mode without Supabase, so /admin/condominios and /c/<code> load with sample data; reach localhost with `curl --noproxy '*'` because the sandbox proxy answers 403 otherwise.
- The sandbox has no browser, pip or system ffmpeg, and blocks Chromium downloads, GitHub releases and the Higgsfield CDN (d8j0ntlcm91z4.cloudfront.net), but npm installs work.
- For PDFs use pdfkit with @fontsource/plus-jakarta-sans, and pdf-to-img to review them as images.
- Instagram generators live in marketing/instagram/ with their own package.json (resvg + opentype; `npm install && npm run k13`); for ad-hoc scripts install @resvg/resvg-js with `npm i --no-save --prefix /tmp/resvg` and never add it to the root package.json.
- resvg-js can't draw WebP: convert images such as public/brand/*.webp to lossless PNG first, e.g. with sharp installed in /tmp (`npm i --no-save --prefix /tmp/resvg sharp@0.33`).
- Las fuentes de marca en src/app/og son WOFF1 con la familia "Plus Jakarta Sans ExtraBold/SemiBold"; resvg (Node) no lee WOFF ni fuentes en memoria, así que hay que convertirlas a TTF en un archivo temporal (marketing/instagram/perfil/destacados/generar.mjs lo hace).
- Each Reel under marketing/videos/ has its own proyecto/ (npm install there) with @napi-rs/canvas and @ffmpeg-installer/ffmpeg; npm skips the postinstall, so run `chmod +x node_modules/@ffmpeg-installer/*/ffmpeg`.
- Local Coach Banana art is only the standing pose (public/brand/mascota-sola.webp, marketing/instagram/recursos/coach-banana-oficial.png); other poses (COACH_POSE in src/lib/aprende.ts) are on the unreachable CDN, so ask for missing ones as PNG. No PNG of El Nuevo exists.
- Other local brand assets: public/icons/logo.svg, the uncropped icon at assets/icon-only.png, and real app screenshots in public/landing/ (780 x 1688 px).
- The running screenshots in public/landing come from a 21K example with a 1:55:00 goal, so crop or retake them for 5K pieces. public/landing/nutricion.png is normal mode (2,500 kcal, 185 g), not Banana Shield.
- investigacion/evidencia-programas.md sí está en main (sección 7.1 para GLP-1), aunque algunos issues digan que no.
- The /condominios landing reads ?c= through condoName in src/lib/condominios.ts (letters, numbers and . , ' & ( ) - only, 60 characters); an unencoded & in the name breaks the query.
- The residents' link is /c/<code> (src/app/c/[code]); the ?c=Name page at /condominios is only for administraciones before the meeting, so don't mix them up.
- `/admin/condominios` is Banana Burn's internal panel: condominium administrations have no access to the app and only get counts that the team shares with them.
- A condo's free month runs 30 days from each resident's activation, not from the condo's free_ends_at, and the cron (sweepCondos) already notifies residents 3 days before their own end.
- La oferta de condominios "primer mes gratis para todos los residentes" hoy solo existe en Costa Rica (Harvey) y se activa con /c/<código>; los anuncios a residentes deben condicionarla a que el condominio se sume y no prometerla en otros países.
- UTMs are saved in Supabase only when the visit has ?ref= (src/components/ref-capture.tsx); funnel_events (0061) exists since 28 Oct 2026 and stores the path without UTMs.
- `src/app/r/[code]/route.ts` descarta los parámetros al redirigir, así que cualquier UTM en un enlace /r/<código> se pierde hasta que eso cambie.
- Meta Subscribe fires only from /pago/exito, not from the trial-end auto-charge (trial-billing.ts, cobros cron), so count real payments in trial_charges with status 'succeeded'.
- LEAD_CTA en src/lib/meta-pixel.ts incluye registro-* y no incluye lo-mejor, pasos ni oferta; CompleteRegistration sale al terminar /bienvenida, no al crear la cuenta.
- The app already sends lifecycle emails through Resend from src/lib/email/templates.ts (bienvenida, pruebaIniciada, recordatorioCobro, daily reminders); any new marketing sequence has to say which of those it replaces.
- In src/lib/email/templates.ts, money() formats as es-CO ($9,99), which contradicts the brand book's es-419 ($9.99).
