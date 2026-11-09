# Cloudflare Pages preparation — browse-only storefront

## Current result

This project can be built for Cloudflare Pages as a static product catalogue with a browsing cart. Payments, order submission, order confirmation retrieval and hosted admin operations are disabled in that build. The exact message is **Payments and online ordering coming soon**. No customer checkout fields are presented, no customer details are submitted and no `/api` requests are made by the Cloudflare frontend.

The existing Vercel project, server code, migrations and local admin migration aid are preserved. No deployment has been performed. This is not a migration of the ordering backend, nor a claim that a complete commercial checkout is ready.

## Build locally

```bash
npm ci
npm run build
npm run test:orders
node scripts/check-catalogue.cjs
npm run build:cloudflare
npm run check:cloudflare
```

The final command verifies the Cloudflare artifact, including byte-for-byte product/hero/category images and exclusion of backend code and credential names. `dist/` after `build:cloudflare` is the artifact intended for Cloudflare Pages. Running the standard build afterward replaces that artifact; rebuild with `build:cloudflare` before a future manual upload.

Optional local preview:

```bash
npm run preview -- --port 5182
```

Optional browser regression using a separately installed Playwright and Chrome:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright TEST_URL=http://127.0.0.1:5182 node scripts/check-cloudflare-browser.cjs
```

This checks desktop/mobile image decoding, two complete 2500ms hero loops, product details, cart browsing, disabled checkout/admin routes and absence of backend requests or console errors. Actual hosted Cloudflare routing must also be checked after an approved deployment.

## Cloudflare Pages settings — apply only after deployment approval

- Framework preset: **React (Vite)**.
- Build command: **`npm run build:cloudflare`**.
- Build output directory: **`dist`**.
- Root directory: this project folder; use `.` if it is the repository root, otherwise its actual repository-relative path.
- Build Node version: **22** (`NODE_VERSION=22` if explicitly setting it).
- Optional public variable: `PUBLIC_SITE_URL=https://YOUR_ACTUAL_CLOUDFLARE_OR_CUSTOM_DOMAIN`.
- Do not add Supabase, Resend, Stripe, Vercel OIDC or other secret credentials to this static frontend build.

`wrangler.toml` declares a suggested Pages project name and `pages_build_output_dir=./dist`; it does not create an account/project or run a deployment. Cloudflare's build-provided `CF_PAGES_URL` is used for sitemap/Open Graph URLs when `PUBLIC_SITE_URL` is absent. Without either URL, the local Cloudflare artifact omits the sitemap rather than publishing the old Vercel hostname. Runtime canonical links use the actual origin as a fallback. Set the final public URL when known; no pages.dev hostname is invented here.

`public/_headers` supplies security headers and immutable caching for Vite's hashed assets. No top-level `404.html` is emitted, allowing Cloudflare Pages' documented SPA fallback to serve React routes such as `/product/2` and `/contact`. No wildcard redirect is used that could rewrite product photographs. Vercel's `vercel.json` is retained but is not a Cloudflare routing configuration.

When approved, either upload **only the contents of the final `dist/` artifact** using the Pages static upload flow, or configure Git integration using the settings above. Creating a Git integration and pressing Save/Deploy may immediately publish; do not do so before approval. Never upload the complete project, `.env.local`, `.vercel`, `node_modules`, backups or server source as website assets.

## Backend functions requiring migration

Cloudflare Pages does not execute the existing Vercel-style `api/*.js` handlers just because those files exist in the repository. They are not included in the static output.

| Existing Vercel endpoint | Work needed before enabling on Cloudflare |
| --- | --- |
| `api/catalogue.js` | Port to a Pages Function/Worker with Supabase server bindings; verify public fields and database error handling |
| `api/orders.js` | Port authenticated receipt cookies, server validation, database price/stock checks, idempotency, origin checks and abuse protection |
| `api/admin-session.js` | Port Supabase Auth login and HttpOnly cookies; review admin authentication/MFA policy |
| `api/admin-orders.js` | Port server-side admin authorization, pagination, status updates and audit records |
| `api/admin-products.js` | Port product authorization, validation, price/stock edits and concurrency protection |
| `api/admin-product-photo.js` | Port authenticated uploads, request-size checks, Supabase Storage and metadata/failure recovery |
| `api/notifications.js` | Port the durable email worker; use a scheduled Cloudflare Worker/Cron Trigger or another protected scheduler instead of Vercel cron |
| `api/payment-checkout.js` | Port hosted Stripe Checkout with private bindings, account-mode gates and idempotency; keep disabled until approved |
| `api/stripe-webhook.js` | Port raw Request body handling and Stripe signature verification; validate AUD amount/session/order/mode and replay handling |

Shared `server/*.js` uses Node request/response objects, `process.env`, Node crypto/Buffer and catalogue loading. Cloudflare handlers need Fetch API Request/Response interfaces, environment bindings and reviewed Node compatibility or Web Crypto equivalents. Do not simply rename the files. Supabase migrations and Resend/Stripe account requirements remain; neither Cloudflare static hosting nor a changed hostname makes them configured.

After migration, revisit CORS/origin checks, trusted client-IP headers, cookie security, canonical `SITE_URL`, provider secrets, email retry scheduling, storage policies and payment webhook URLs. Port and retest the existing local SQL/API tests and add real provider verification before lifting the static-mode gate.

## Remaining launch decisions

- Cloudflare account/project and final public domain; controlled deployment approval and hosted smoke tests.
- Documented commercial rights for existing product and hero photographs.
- Business identity/contact information, tax treatment, approved prices, stock and delivery rules.
- Final review of the clearly marked policy drafts. No ABN, address, delivery promise or additional warranty has been invented.
- Backend migration/configuration and separate approval before accepting real orders or payments.

## Official references

- Build configuration: https://developers.cloudflare.com/pages/configuration/build-configuration/
- SPA serving behavior: https://developers.cloudflare.com/pages/configuration/serving-pages/
- Pages Functions routing: https://developers.cloudflare.com/pages/functions/routing/
