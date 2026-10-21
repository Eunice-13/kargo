# Phase 5 — UI polish and regression testing

Phase 5 development is complete. The compact horizontal payment cards and KARGO
theme are preserved, optional backend capabilities fail gracefully, and the
missing-batches compatibility fix remains intact. **No deployment or production
migration was performed.** Full-schema Supabase staging and authenticated
integration tests remain mandatory release blockers.

## Batch preservation and compatibility

Reviewed `docs/missing-batches-investigation.md` before implementation. The existing
`paymentReadCompatibility.ts` helper and its use in `kargoApi.ts` were preserved
without modification in Phase 5. Only explicit missing combined-payment schema
errors permit the previous order/payment read projection. Unexpected errors still
propagate; failed reads never become a successful empty catalog.

A new regression suite calls the real `loadCurrentAppData()` through a Supabase
client with intercepted HTTP responses. For **both Buyer and Seller profiles**, it
checks catalog/product loading with the full schema, a missing combined-payment
relationship and a missing group column. Authorization, unrelated relationship and
network failures must still reject. SDK transport retries are permitted, but none
may switch a network failure to the legacy query. Fixtures affect tests only.

Read-only REST counts against the configured project again returned **38 batch
records** and 61 catalog rows. The currently connected backend still lacks the
Phase 4 payment column/accounts. No record, permission or environment configuration
was changed. Existing signed-in buyer Latest Batches and Popular Batches were
also confirmed visible in Chrome. Seller loading was verified through the full
loader regression tests, not a separate authenticated seller browser session.

## Availability and error handling

Buyer and seller components distinguish missing combined-delivery tables/RPCs
from unexpected errors using exact error codes and feature identifiers. Known
unavailability presents a compact, neutral notice:

> Combined delivery is not available yet. Your individual reservations are unchanged.

The notice offers “Check again”; unexpected errors remain alerts with their
actual message and a Retry action. Permission failures, expired JWTs, transport
errors, unrelated missing fields and ambiguous relationships are not classified
as an unavailable feature.

Buyer reads await both optional results. If one reports missing schema while
another reports an authorization/network error, the unexpected error takes
precedence. A fast missing-schema failure cannot conceal the second failure.

Failed capability refreshes clear stale candidates/requests and dismiss affected
review dialogs. Unavailable components do not advertise request, approval, fee or
payment actions. Missing capabilities encountered during a mutation also disable
that workflow and present the availability notice; no mutation is retried through
a legacy payment route. Unrelated standalone reservations remain rendered.

Background refreshes disable actions while retaining open dialogs and payment
form state. Their Close action remains usable when no mutation is in flight.
Availability notices stay present while rechecking, avoiding removal of the
focused retry control. Successful reads restore the normal feature state.

## Presentation, accessibility and responsiveness

- Cards keep the existing thumbnail/details/right-aligned price-and-actions grid
  and mobile stacked arrangement. No table, seller-header redesign or new palette
  was introduced.
- Each combined card is a named article with a heading, labelled action group,
  readable product/quantity list and explicit combined-total label.
- Payment-state changes use a status region. Unexpected errors use alerts;
  routine unavailable-capability notices use polite status semantics.
- Invalid deadlines, incomplete membership or nonfinite financial display values
  cannot enable Pay Now. This is a presentation safeguard; authoritative payment
  validation remains unchanged on the server.
- Refreshing a combined proof form disables submission and explains that payment
  availability is being checked. The optional setting defaults off, retaining
  standalone payment/cash behavior.
- Keyboard focus rings use `--kargo-focus` on card, notice and dialog buttons.
  New availability/review controls use 44-pixel minimum tap targets.
- Seller payment labels are readable phrases, and closed/fee-assigned requests
  offer “View details” rather than suggesting another approval review.

The existing Modal accessibility/focus-management component, Card, ProductThumb,
Countdown and button variants are reused. No new dependencies were added. Existing
payment/shipping calculations, handlers, deadlines, inventory, RLS, SQL migrations
and reservation associations were not changed in Phase 5.

## Validation results

| Check                                                                                          | Result                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| All application/render tests                                                                   | **156/156 pass**                     |
| New full-loader buyer/seller cases                                                             | 9 pass                               |
| New availability/error-priority cases                                                          | 15 pass                              |
| New UI/form presentation regressions                                                           | 5 pass                               |
| Existing foundation native concurrency audit                                                   | **27/27 pass**                       |
| Existing Phase 4 native payment audit                                                          | **16/16 pass**                       |
| SQL suites: foundations, requests, seller review, recovery, batch integrity, combined payments | **6/6 pass**                         |
| Complete unused-state migration/rollback chain                                                 | Pass                                 |
| Four-case recovery audit                                                                       | **4/4 pass**                         |
| TypeScript and production build                                                                | Pass                                 |
| `git diff --check`                                                                             | Pass                                 |
| Read-only existing database batch count                                                        | **38**, unchanged from investigation |

Commands:

```sh
npm run typecheck
node --test --test-concurrency=1 --test-timeout=30000 tests/*.test.ts tests/*.test.mjs
npm run build
node scripts/test-combined-delivery-concurrency.mjs
node scripts/test-combined-delivery-concurrency.mjs --payments
```

The SQL runner/recovery audit used the existing temporary PGlite installation
through `KARGO_PGLITE_MODULE`. Native audits used disposable PostgreSQL 18.4
databases, never the production connection. The temporary native server was stopped
after testing.

In Chrome, a temporary static fixture of the real card/notice components was
checked at **320, 375, 768 and 1440 pixels**. All widths had matching page client
and scroll widths, with no overflowing cards. At 768 pixels the card retained
its horizontal three-column grid; narrow mobile used the existing stacked layout.
The notice's retry target measured 44 pixels high. Tabbing to Pay Now showed a
solid focus outline, and the accessibility tree exposed the labelled articles,
action groups, status text and disabled reviewing action. The fixture illustrated
independent available/unavailable presentation states; it was not a live payment
flow. Its file/tab were removed and the viewport reset.

These checks do not constitute a screen-reader user study, a complete accessibility
conformance audit, or authenticated payment integration validation.

`npm run format:check` remains non-zero for eight existing files: MyClaims,
pendingPayments.css, PaymentSubmitModal, RejectPaymentModal,
SellerPaymentVerification, verifyTypes, kargoApi and types/index. Their unchanged
HEAD copies also fail formatting; pendingPayments.css became newly visible to the
changed-file formatter because this phase added its focus rule. Unrelated
whole-file formatting was preserved. New files and the modified feature/test
files pass formatting. No separate lint script is configured.

## Files modified in Phase 5

Feature UI and availability:

- `src/features/combined-delivery/availability.ts` (new)
- `src/features/combined-delivery/DeliveryAvailabilityNotice.tsx` (new)
- `src/features/combined-delivery/combinedDelivery.css` (new)
- `src/features/combined-delivery/useBuyerDeliveryRequests.ts`
- `src/features/combined-delivery/BuyerCombinedDelivery.tsx`
- `src/features/combined-delivery/SellerCombinedDelivery.tsx`
- `src/features/combined-delivery/CombinedDeliveryRequestDialog.tsx`
- `src/features/combined-delivery/CombinedPaymentCard.tsx`
- `src/features/claims/pendingPayments.css`
- `src/features/payments/PaymentSubmitModal.tsx`

Regression coverage:

- `tests/appDataCompatibility.test.mjs` (new)
- `tests/fixtures/AppDataClient.ts` (new)
- `tests/combinedDeliveryAvailability.test.ts` (new)
- `tests/combinedDeliveryRequestUi.test.mjs`
- `tests/fixtures/PaymentModalShared.ts` (new SSR fixture isolating browser-only map imports)

Documentation:

- `docs/combined-delivery-phase-5.md` (this report)
- `docs/combined-delivery-phase-4-preflight.md` (current status link)

Earlier uncommitted work remains in the working tree. Other Phase 1–4 files and
the missing-batches compatibility implementation were preserved.

## Release gates and approval

Docker and Podman remain unavailable on PATH, and an isolated full-schema
Supabase staging environment was not available. Local SQL fixtures do not validate
the complete auth/storage/extensions schema, PostgREST cache or deployed policies.
Before any release, staging must validate the ordered migrations and real JWT
buyer/seller workflows, proof upload and signed receipt access, verification and
rejection, deadlines/scheduled sweeps, realtime notification delivery and batch
visibility with both deployed and unavailable optional capabilities.

The connected production project was used only for read-only count/schema checks.
All 38 existing batch records were preserved: no deletion, recreation, reset,
reseed, production migration, business-data write or deployment occurred.
Phase 5 only is completed locally. Await explicit approval before any deployment,
and do not bypass the mandatory staging and authenticated integration gates.
