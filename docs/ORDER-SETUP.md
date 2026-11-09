# Real unpaid orders — setup and verification

The implementation is complete locally but is NOT live. No account, database, email domain, credential or deployment has been created. Production ordering fails closed until configured and explicitly enabled. Do not deploy or turn ordering on before completing the verification below.

## What changed

- `/api/orders`: server-validated POST, transactional database order + owner/customer notification jobs, idempotency, anonymous receipt GET with an HttpOnly capability cookie. Prices come from the managed `store_products` database catalogue, not the browser request. Static `src/products.json` preserves the browsing fallback and seeds the database. All amounts are integer AUD cents. No card details are collected here; only a matching signed Stripe webhook can mark a payment Paid when the optional integration is enabled.
- `/api/admin-session`: server-side Supabase Auth login, verified email and database admin membership, one-hour HttpOnly session. Passwords/tokens are never placed in localStorage. No public admin registration. Password recovery is handled in your Supabase dashboard, not by a public reset form in this app.
- `/api/admin-orders`: authenticated list and status updates, optimistic concurrency and status audit history. Page size 25. Status transitions: New → Processing/Cancelled; Processing → Shipped/Completed/Cancelled; Shipped → Completed. Completed/Cancelled are terminal.
- `/api/notifications`: secret-protected cron worker reading a durable queue. No Resend request is made until an order transaction has committed. Two jobs per order; the order persists independently of delivery. Normal delivery starts at the next scheduled cron run.
- Receipt refresh on the submitting browser works for 24 hours; it contains products/totals, not customer address/email/phone. The admin dashboard retains all orders across devices/deployments. Customers are not given accounts or a public searchable order database.
- The `/admin` route leads to protected Orders at `/admin/orders`. Persistent product, price, stock and photo management is at `/admin/products`. The previous browser-only photo manager is retained at `/admin/local-photos` on localhost only; it is a migration aid, not the commercial admin.

## 1. Create Supabase

1. Create an account at https://supabase.com/dashboard and create a project. Choose a strong database password; store it in your password manager. Prefer the Sydney region if available.
2. Choose a suitable plan. Free is useful for development; production should consider Pro backups and avoiding inactivity pauses. Do not delete or recreate the database during website deployments.
3. Open SQL Editor and run migrations in order: `supabase/migrations/001_orders.sql`, then `002_commerce.sql`, then `003_product_storage.sql`. Run each once. If 001 has already been applied, preserve existing orders and apply only the later migrations. Migration 002 adds managed products, stock reservation, product auditing and payment records; 003 creates the photo bucket and restricts browser writes. Products are seeded with online ordering approval disabled. Do not rerun migrations blindly or recreate order tables.
4. In Authentication settings, disable public sign-ups. Create your administrator under Authentication → Users with a strong password and a confirmed email. Use your owner email if desired. This is a Supabase Auth user, not merely your Supabase dashboard account.
5. Copy the user's UUID (not an API key) and run this after replacing the explicit placeholder:

   ```sql
   insert into public.order_admins(user_id)
   values ('REPLACE_WITH_AUTH_USER_UUID');
   ```

   Only an explicitly listed, confirmed Auth user can sign in to Orders. Additional users require an additional membership row. Remove the membership row to revoke access immediately on the next API request.
6. Under Project Settings / Connect / API keys, copy your project URL, publishable key and server secret key into your private environment configuration. Use the current `sb_publishable_...` / `sb_secret_...` keys. The secret key bypasses RLS and must NEVER be placed in a VITE_ variable, shared in chat or committed.
7. Confirm RLS is enabled on every newly created table. Anonymous and authenticated browser roles have no order-table or RPC permissions; only server credentials may access them. Your own authenticated admin is separately checked by the API before any privileged read/update.
8. Configure backups appropriate to your plan and business. Orders contain personal data; restrict Supabase dashboard team access. Sydney database selection is not a guarantee that email processing and every provider operation stays in Australia.

## 2. Create Resend and verify your sending domain

1. Create an account at https://resend.com and add a domain/subdomain you control, such as a dedicated orders subdomain of your actual store domain.
2. Add the exact DNS verification records shown by Resend at your domain's DNS provider. Wait until the domain is verified. Configure the recommended SPF/DKIM records and review DMARC.
3. Create a sending API key scoped to the verified sending domain when available. Save it privately as `RESEND_API_KEY`.
4. Choose `ORDER_FROM_EMAIL` on that verified domain, for example `HoofPro Supplies <orders@YOUR_ACTUAL_VERIFIED_DOMAIN>` (replace the placeholder; do not use it literally).
5. Set `ORDER_NOTIFICATION_EMAIL=saberhussain7788@gmail.com`. This is the recipient, not your authenticated sender domain. A Gmail inbox cannot be used to prove ownership of gmail.com.
6. For a staging test, use inboxes you control. Resend's unverified/test sender restrictions cannot establish production delivery to arbitrary customers.
7. Check your plan's daily/monthly limits. Each order uses two emails; authentication/password recovery messages can consume additional quota if configured through the same provider.

## 3. Configure Vercel environment variables

Use the existing HoofPro Vercel project → Settings → Environment Variables. Add values to the intended environment only. Keep development/staging data separate from production.

| Variable | Value / purpose |
| --- | --- |
| `ORDERING_ENABLED` | Start with `false`; change to `true` only for controlled verification, then for approved launch |
| `SITE_URL` | Exact public origin for that deployment, e.g. your actual `https://...` domain, without a path; checkout rejects other origins |
| `SUPABASE_URL` | Your project's HTTPS URL |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key; used by server Auth requests |
| `SUPABASE_SECRET_KEY` | Supabase secret server key; privileged database access |
| `RESEND_API_KEY` | Your Resend sending key |
| `ORDER_FROM_EMAIL` | Address on the verified sending domain |
| `ORDER_NOTIFICATION_EMAIL` | `saberhussain7788@gmail.com` |
| `RATE_LIMIT_SECRET` | A separately generated random 32-byte secret for hashing IP rate-limit keys |
| `CRON_SECRET` | A separately generated random 32-byte secret; Vercel sends it as a Bearer header to the cron worker |

Generate secrets privately in your terminal, one command per secret:

```bash
openssl rand -hex 32
```

Never use VITE_ prefixes for any of these values. `.env.example` contains names and blank values; actual local values belong in ignored `.env.local`. Do not paste keys here. `VERCEL_OIDC_TOKEN` is unrelated and must not be repurposed as an email/database key.

The app uses strict same-origin checks. Pick one canonical storefront hostname and redirect other storefront hostnames there. For preview testing, set the exact preview hostname through an environment-specific configuration. Do not broadly disable origin checks to work around hostname mismatches.

## 4. Runtime and durable notification scheduling

- Node 22 or newer. Vercel builds the React app with `npm run build`, output `dist`, and deploys `api/*.js` as serverless functions.
- `vercel.json` preserves API routing outside the SPA fallback and schedules `/api/notifications` every minute. This requires a Vercel plan that supports the configured frequency (typically Pro); do not deploy that cron configuration on an unsupported plan.
- The worker requires `Authorization: Bearer <CRON_SECRET>`. It processes two jobs per invocation (normally one order's two emails), with a five-minute lease, bounded network timeouts, exponential backoff and ten maximum attempts. At higher volumes, monitor backlog and increase throughput deliberately with corresponding function duration/rate-limit testing.
- Cron normally operates on production deployments. For development/staging verification, invoke the protected endpoint manually using the secret privately from your environment; do not put the token in a URL or commit it. Local `npm run dev` does not run cron for you.
- Email `sent` means Resend accepted the request, not proof of inbox delivery. Check Resend for bounces/delivery events. No live delivery is claimed by local tests.
- Every retry uses the same immutable email payload and Resend idempotency key. Resend's idempotency window is 24 hours; automatic retries stop before 23 hours or after ten attempts. Failed jobs remain visible in Orders and in Supabase. Before any manual resend, inspect Resend for the original key `hoofpro-order/<notification UUID>` to avoid duplicate mail; there is intentionally no blind Resend button.
- If a worker dies mid-send, leases expire and pending work is reclaimed. Order transactions are not rolled back by mail outages.

## 5. Price and delivery approval before enabling

The original catalogue amounts and existing $12.95/free-from-$150 shipping rule require owner review. The database is seeded from `src/products.json`, with sale approval disabled per product. After setup, edit and approve products in `/admin/products`. The backend uses database prices and reserves tracked stock transactionally; it does not invent supplier price verification. The JSON browsing fallback is not an alternative live order database. Review and approve every amount, variant, GST label and delivery rule before real customers can order. The final saved order/receipt is authoritative if displayed prices changed between cart creation and submission.

Stripe hosted Checkout and signed webhook handling are implemented locally but disabled. New orders start Unpaid. Migration 002 permits Paid or Failed only through the protected server workflow; no administrator payment-status toggle is provided. Submitting an order, clicking a payment link or returning from Stripe does not establish payment. Refund processing and active-session cancellation remain operational procedures requiring review; do not activate payments until the full Stripe lifecycle is validated.

## 6. Test locally first

```bash
npm ci
npm run test:orders
npm run build
node scripts/check-catalogue.cjs
```

`test:orders` applies the real SQL migration to an isolated local PostgreSQL engine (PGlite), invokes the real API handlers, and substitutes only external Supabase HTTP routing/Auth and Resend transport. It tests input/price validation, concurrent duplicate protection, transactional queue creation, RLS/privilege denial, admin authorization, status concurrency/auditing, email outage retries, ambiguous expiry, receipt access, database failures and abuse limits. It sends no live email and does not prove cloud configuration or inbox delivery.

For real local integration after configuring your own development accounts, run these in two terminals:

```bash
npm run dev:api
npm run dev
```

Set `SITE_URL` to the exact Vite origin printed in that terminal (default `http://127.0.0.1:5173`). Vite proxies `/api` to the real local API on port 3001. The local API has no database/email fallback. Do not expose these development servers publicly. If your admin Supabase Auth project enforces MFA, this first version's password login does not implement an MFA challenge; keep storefront deployment blocked until the desired admin authentication policy is tested/extended.

Optional isolated frontend checks with an external Playwright installation:

```bash
PLAYWRIGHT_MODULE=/path/to/playwright TEST_URL=http://127.0.0.1:5173 node scripts/check-checkout-browser.cjs
```

Those browser checks explicitly substitute API response fixtures to verify rendering, failure handling, retry keys, receipt reload, admin login/status updates/logout and responsive layout. They do not save cloud orders or send real mail.

## 7. Controlled live verification — requires accounts and deployment approval

After credentials, migration, email domain, cron plan and price review are ready, obtain approval for a controlled deployment. Do not claim readiness based solely on mocks.

1. Confirm public ordering is disabled before enabling a controlled test.
2. Submit one unpaid order with a customer inbox you control. Confirm it appears once in Supabase with correct authoritative prices and two queued notification records.
3. Refresh the receipt page; sign in at `/admin/orders` from another device and confirm the same record appears.
4. Trigger/run the protected worker. Confirm the owner notification arrives at `saberhussain7788@gmail.com` and the customer confirmation arrives at your test inbox. Check spam and provider logs.
5. Verify the deployed cron runs automatically, queued jobs are processed and failed jobs are monitored.
6. Retry the same submission key and confirm one order/two notifications only. Use an unauthorized session and confirm order data cannot be read or changed.
7. Update the order status and verify the audit entry. Confirm payment remains Unpaid.
8. Confirm no server keys or customer records appear in public bundles and no checkout response claims successful email delivery or payment.
9. Only after all checks and your approval, enable general ordering on the canonical production domain. Keep Stripe disabled until the separate account configuration, test-mode lifecycle checks and explicit live-payment approval below are complete.

Official references:
- https://supabase.com/docs/guides/getting-started/api-keys
- https://supabase.com/docs/guides/auth
- https://resend.com/docs/dashboard/emails/idempotency-keys
- https://vercel.com/docs/functions/runtimes/node-js
- https://vercel.com/docs/cron-jobs/manage-cron-jobs


## Optional Stripe setup — keep disabled during recovery

1. Create/configure your Stripe account and complete its business verification with accurate owner-supplied details. Start in test mode. Do not supply invented registration or tax information.
2. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as server-only values. Keep `STRIPE_CHECKOUT_ENABLED=false`, `STRIPE_MODE=test` and `STRIPE_LIVE_APPROVED=false` until controlled test approval. Never use a VITE_ prefix.
3. Configure the endpoint `/api/stripe-webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` and `checkout.session.expired`. Verify the signing secret belongs to the same test/live mode as the account key. The endpoint verifies the raw body, signature, mode, order reference, reservation, AUD currency and amount.
4. After explicit approval for isolated test-mode verification, enable Checkout only in that test environment. Exercise success, decline, cancellation, expiry, duplicate/out-of-order webhooks and delayed payment. A verified Paid order must never be downgraded by a later failure event.
5. Verify hosted session creation and recovery against Stripe itself; local signed-event fixtures do not test the entire Stripe-hosted checkout lifecycle. Confirm refunds, cancellation handling, stock reconciliation and payment monitoring before launch.
6. Live mode requires matching live credentials, `STRIPE_MODE=live`, `STRIPE_CHECKOUT_ENABLED=true` and the separate `STRIPE_LIVE_APPROVED=true` flag. Do not set these flags or deploy without owner approval.

## Persistent product and photo setup

- After migrations and admin login, use `/admin/products` to review existing products, prices, GST labels, availability and gallery order. Products cannot be ordered until their individual sale approval is enabled.
- Blank stock means availability on request; tracked stock is available-to-order quantity. Orders reserve it and cancellation releases only quantities actually reserved. Reconcile manual stock changes with open orders.
- The `product-images` Supabase Storage bucket is intentionally public for storefront photography. New uploads are authenticated and server-side, restricted to JPEG/PNG/WebP up to 2 MB, and require publication-rights confirmation. Never upload private customer documents there.
- Verify bucket policies against the actual Supabase project. Test upload, metadata persistence, concurrent edits, gallery changes and failure recovery on two devices before commercial use. Original local files are preserved.
- The existing static product and hero photographs still require documented commercial publication rights. An image being present in the project does not establish a licence.
