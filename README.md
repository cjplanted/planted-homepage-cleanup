# Planted Website Monorepo

Consumer website prototype + availability backend for [Planted Foods](https://eatplanted.com).

## Structure

| Directory | What it is |
|---|---|
| `planted-astro/` | Astro 5 frontend — 18 locales, ~3,500 static pages, deployed to GitHub Pages |
| `planted-availability-db/` | Firebase backend monorepo (Cloud Functions API, Firestore, scrapers, admin dashboard) |
| `scripts/` | Dev tooling (Chrome debug launcher for the website-review skill) |

## Frontend (`planted-astro`)

- **Stack**: Astro 5, GSAP + Lenis scroll animations, optional Sanity CMS (configured, not active)
- **Content**: products, recipes, retailers as local JSON in `src/content/`; images served from the Shopify CDN with on-the-fly resizing (`src/utils/images.ts`)
- **i18n**: 6 languages / 18 locale variants in `src/i18n/locales/` — validate with `pnpm exec tsx scripts/validate-translations.ts`
- **Store locator**: talks to the Firebase API at runtime (`src/data/padApi.ts`)

```bash
cd planted-astro
pnpm install
pnpm dev        # http://localhost:4321
pnpm build      # static build into dist/
pnpm preview
```

Deployment: pushes to `main` trigger `.github/workflows/deploy.yml`, which builds `planted-astro` and publishes `dist/` to GitHub Pages at <https://cjplanted.github.io/planted-homepage-cleanup/>.

Analytics: GTM only renders when `PUBLIC_GTM_ID` is set at build time (consent-gated via the cookie banner).

## Brand

- Purple `#61269E`, green `#6BBF59`, cream `#FDF8F3`
- Type: VC Henrietta (display) + Galano Grotesque (body), self-hosted in `planted-astro/public/fonts/`

## Backend (`planted-availability-db`)

See `planted-availability-db/README.md` and `CLAUDE.md` for architecture, commit policy, and deploy commands (`firebase deploy --only functions`).
