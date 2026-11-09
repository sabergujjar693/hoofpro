# Earlier order system proposal

Implementation now exists locally. This historical proposal is superseded by [ORDER-SETUP.md](ORDER-SETUP.md); account configuration and controlled live verification are still required.

## Current checkout audit

`src/App.tsx` stores the cart and latest order in React state in Provider. Checkout.place creates a random DEMO number, calculates amounts in the browser, waits 650ms, saves the order in React state, clears the cart and navigates to /confirmation. Reloading loses the order. No database write, email send, order API, authenticated Orders page or durable duplicate prevention exists. All payment choices are simulations; no payment is collected. Existing /admin is a local photo manager, not an order-management login.

The project is a static React/Vite build with Vercel SPA rewrites. Its only existing environment variable name is VERCEL_OIDC_TOKEN; no value was read into this document. No order database or email configuration is present.

## Recommended setup, subject to approval

- Keep the React website and cart design; add server-side Vercel API endpoints.
- Supabase PostgreSQL for persistent shared orders and Supabase Auth for invited admin users. Prefer Sydney region where available. Disable public admin sign-up, require verified server-side admin membership, and support MFA. Use secure HttpOnly cookies, CSRF/origin checks and no-store admin responses.
- Resend for separate owner notifications and customer confirmations from a verified domain.
- Production planning: Supabase Pro starts at USD 25/month; Resend Free includes 3,000/month with 100/day, or Pro USD 20/month for 50,000/month; Vercel Pro starts at USD 20/month. Indicative production base USD 45/month with free email, or USD 65/month with paid email, before taxes, domain fees, extra seats and usage. Existing paid subscriptions may cover some costs. Verify pricing before subscribing.
- Free Supabase is suitable for development, with 500MB database capacity, inactivity pausing and no included automatic database backups. Vercel Hobby is for non-commercial personal projects. Do not treat free tiers as an assured production service.
- Two messages per order mean the free email allowance supports at most 50 orders/day and 1,500/month if no other messages use the allowance; authentication and retry traffic reduce that capacity. Provider acceptance does not guarantee inbox delivery.

Sources checked for this proposal:
https://supabase.com/pricing
https://supabase.com/docs/guides/platform/regions
https://supabase.com/docs/guides/platform/backups
https://resend.com/pricing
https://resend.com/changelog/domain-verification-events
https://vercel.com/pricing
https://vercel.com/docs/plans/hobby

## Accounts and configuration needed

1. Supabase account/project, selected plan, region and invited admin email(s).
2. Resend account, sending domain/subdomain and DNS access for verification. Specify owner notification inbox and sender address. Document any required attribution/domain ownership separately; an email inbox alone does not verify a sending domain.
3. Access to existing Vercel project environment settings; separate development and production configuration.
4. Server-only variables: SUPABASE_URL, SUPABASE_SECRET_KEY (or appropriate restricted database credentials), RESEND_API_KEY, ORDER_NOTIFICATION_EMAIL, ORDER_FROM_EMAIL, SITE_URL and a generated CRON_SECRET for protected retry jobs. Use current supported keys/SDKs after approval. Never prefix secrets with VITE_. Configure secrets directly in provider settings or ignored local environment files, never chat or committed code.
5. Confirm order acceptance is intended without payment and review the current demo catalogue prices/shipping before enabling real submissions.

## Planned behavior

- POST /api/orders accepts customer details, product IDs, quantities, supported variants and a checkout idempotency key. Validate all fields server-side, enforce size/quantity limits, rate-limit abuse and calculate AUD prices/shipping from the server catalogue using integer cents. Never trust totals or payment state submitted by a browser.
- Atomically save order, immutable item/price/customer snapshots and two pending email jobs in one database transaction. Database-generated unique order number, UTC creation timestamp, status New and payment status unpaid; render dates in Australia/Melbourne. Persist money/currency and delivery address, email and phone.
- A unique idempotency constraint prevents repeated clicks/network retries from creating duplicate orders. Associate retries with a checkout token and request hash; reject mismatched reuse. Do not make customer details retrievable from a public order-number lookup. Return a limited confirmation after commit; do not clear the cart on failure.
- Email workers claim durable jobs and use provider idempotency to limit duplicate sends. Retry transient failures with backoff, record delivery/failure state and expose failures to admins. Provider outages must not lose committed orders or produce duplicate orders. Confirmed database persistence and email delivery are separate states; delivery cannot be guaranteed during provider failure.
- Owner notification includes order number/date, customer name/email/phone, full delivery address, item names/variants/quantities/prices, shipping and AUD total. Customer email includes their order summary and an explicit statement that payment has not been collected.
- /admin/orders requires login and server authorization on every list/detail/update request. Support New, Processing, Shipped, Completed and Cancelled, with validated transitions, update concurrency protection and an audit trail. Keep the existing /admin photo manager separate.
- Enable database row-level security and deny anonymous order reads/writes. Secrets and existing customer records must never be embedded in public frontend code or logs. Customer details entered during checkout are sent over HTTPS; authenticated admin screens necessarily display authorized order data.
- Replace simulated payment selection with an unpaid order-review step. Do not collect card details or expose a manual paid toggle. Only a future verified payment-provider webhook may mark payment paid; order fulfillment status is separate.
- Update misleading demo checkout/confirmation copy only as needed for genuine unpaid order submission. Preserve navigation, images, product cards and cart behavior.
- Update Vercel routing to keep /api requests out of the SPA fallback. No deployment, live email, account creation or external database mutation until the approved setup and deployment authorization are supplied.

## Required verification before deployment approval

Test invalid inputs, altered client totals, simultaneous duplicate submissions, retry after commit, database outage, email outage/retry, unauthorized access, admin status changes/audit history, no customer data in public responses, no keys in Vite bundles, preserved cart on failed submission and unpaid confirmations. Run build and browser checkout/admin tests. Live persistence across devices and email delivery require configured accounts and controlled test recipients; local mocks alone cannot establish those outcomes.
