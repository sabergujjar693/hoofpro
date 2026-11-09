# Commercial implementation plan

## Inspection findings

The existing project already has an unpaid order API, Supabase SQL migration, durable Resend notification queue, admin order login/status management, local SQL/API tests and a four-photo 2500ms hero. These require external configuration and have not been validated live. Product data and prices are still static JSON, the photo manager uses browser IndexedDB, the storefront contains university/demo wording, and there are no commercial policy pages or payment-provider integration.

## Safe changes authorized for local implementation

1. Preserve the catalogue IDs, original assets, HoofPro colours, layout and hero timing. Replace customer-facing fictional/simulated wording with factual store copy. Clearly label price/stock/tax uncertainties rather than invent verification.
2. Add persistent database-managed products/prices/inventory and authenticated product/photo management backed by Supabase Storage. Keep the old local photo manager available only on localhost as a migration aid; it is not the commercial admin.
3. Continue transactional unpaid ordering, idempotency and durable notifications. Read authoritative products from the managed database. Validate stock and reserve configured stock transactionally; support release on cancellation.
4. Prepare optional Stripe hosted Checkout and signed raw-body webhooks, disabled by default. Payment status changes occur only from verified provider events. Use a separate approval flag plus explicit Stripe account mode. No card fields, invented credentials, live charges or deployment.
5. Add About, Contact, Shipping, Returns, Privacy and Terms with explicit pending business/policy items and no fabricated registration, tax or delivery claims. Keep personal information out of public APIs/bundles.
6. Add route metadata, robots/sitemap, accessible navigation/admin states and security headers. Add build/schema/API/browser checks, setup/deployment instructions and an honest launch-blocker report.

## Boundaries

No account creation, external database mutation, real email delivery, Stripe activation or deployment in this phase. Orders remain disabled until migration, admin authentication, SMTP/domain, product pricing, inventory, business/policy details, image rights and delivery rules are approved and validated. Any legal policy wording is a review draft, not a claim of legal compliance. Customer-facing pages must not imply that configuration blockers are resolved.
