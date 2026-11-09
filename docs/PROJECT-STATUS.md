# HoofPro project status — 10 November 2026

## Verified locally

- `npm run build`: passes TypeScript and Vite production compilation.
- `npm run test:orders`: all 13 tests pass using local PostgreSQL and isolated provider transport fixtures.
- `node scripts/check-catalogue.cjs`: passes for all 15 products, unchanged numeric amounts, cart calculations, professional storefront copy and routes.
- No restart or replacement of completed project work was needed for recovery.

## Implemented, pending cloud configuration and full verification

- Professional storefront copy, preserved catalogue/photos/branding, four-photo 2500ms hero and 500ms fades.
- Unpaid order submission, server-authoritative database prices, idempotency and durable email jobs.
- Admin authentication, order statuses/audit history, managed product/price/stock APIs and stock reservations.
- Persistent product-photo upload/gallery interface and Supabase Storage migration.
- Disabled Stripe hosted Checkout, signed webhook verification, payment-state persistence and replay protection.
- About/contact pages, explicit draft shipping/returns/privacy/terms, route metadata, sitemap/robots and security headers.
- Schema and local development API files. Updated setup instructions in ORDER-SETUP.md.

## Pending before commercial launch

1. Browser regression coverage for the new managed product/photo editor, catalogue refresh, permissions and mobile layouts. Older photo-manager browser scripts need to target the legacy localhost route when appropriate.
2. Real Supabase migrations/storage policies/admin access, Resend verified domain and delivery, cron execution, backups and cross-device persistence checks.
3. Stripe account setup and full test-mode hosted-session, failure, cancellation, expiry, replay and reconciliation checks. Review active-session cancellation and refunds before activation. Local signed-webhook tests are not end-to-end Stripe certification.
4. Business identity/contact details, GST treatment, selling prices, inventory, shipping rules and legal/policy review. Current policy pages explicitly identify missing decisions.
5. Commercial rights for every product and hero photograph.
6. Production security/operations review, including admin authentication policy/MFA support, upload failure recovery, abuse monitoring and notification backlog/failure procedures.
7. Explicit owner deployment approval, controlled verification and separate approval before accepting real orders or activating live payments.

## Current safety state

No deployment or live-provider mutation was performed during this review. Example configuration keeps ORDERING_ENABLED, STRIPE_CHECKOUT_ENABLED and STRIPE_LIVE_APPROVED false; missing service configuration fails closed. Local tests do not establish the state of the live Vercel deployment or prove real email delivery.

Recommended next stage: add and run isolated desktop/mobile browser tests for persistent product and photo management before requesting cloud credentials or deployment approval.
