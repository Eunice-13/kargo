import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  displayClaimStatus,
  sellerOrderReceivedStatus,
} from "../src/features/claims/claimPaymentState.ts";
import {
  effectiveOrderPaymentStatus,
  orderStatusToClaimLabel,
} from "../src/services/orderPaymentState.ts";

const migration = readFileSync(
  new URL("../supabase/migrations/202611100001_payment_review_shortfall.sql", import.meta.url),
  "utf8",
);

test("insufficient payments display as Pending, never as their own status", () => {
  assert.equal(displayClaimStatus("Insufficient Payment"), "Pending");
  assert.equal(displayClaimStatus("Awaiting Verification"), "Awaiting Verification");
  assert.equal(sellerOrderReceivedStatus("Insufficient Payment", "Rejected"), "Pending");
});

test("new submissions stay awaiting verification and approval sets Paid and Reserved", () => {
  assert.equal(
    effectiveOrderPaymentStatus("payment_submitted", [
      { status: "pending_review", submitted_at: "2026-11-03T02:31:50Z" },
    ]),
    "payment_submitted",
  );
  assert.equal(orderStatusToClaimLabel("payment_submitted"), "Awaiting Verification");
  assert.equal(
    orderStatusToClaimLabel(
      effectiveOrderPaymentStatus("payment_submitted", [
        { status: "verified", submitted_at: "2026-11-03T03:00:00Z" },
      ]),
    ),
    // A verified row alone does not confirm the order; the explicit review
    // changes the order status, and that maps to Paid and Reserved.
    "Awaiting Verification",
  );
  assert.equal(orderStatusToClaimLabel("payment_confirmed"), "Paid and Reserved");

  // Only a reviewed payment can produce payment_confirmed.
  assert.match(migration, /new\.status = 'payment_confirmed'/);
  assert.match(migration, /p\.status = 'verified'/);
  assert.match(migration, /p\.reviewed_by is not null/);
});

test("insufficient rejection stores the shortfall and maps to Pending + Insufficient", () => {
  assert.equal(
    effectiveOrderPaymentStatus("payment_submitted", [
      {
        status: "rejected",
        submitted_at: "2026-11-03T03:00:00Z",
        shortfall_amount: 395,
      },
    ]),
    "insufficient_payment",
  );
  assert.match(migration, /add column if not exists shortfall_amount/);
  assert.match(migration, /shortfall_amount = case when is_insufficient/);
  assert.match(migration, /'insufficient_payment'::public\.order_status/);
});

const coversDueMigration = readFileSync(
  new URL(
    "../supabase/migrations/202611100002_verified_payment_covers_due.sql",
    import.meta.url,
  ),
  "utf8",
)

test("a short payment can never be verified at the same time as being insufficient", () => {
  assert.match(coversDueMigration, /guard_verified_payment_covers_due/)
  assert.match(
    coversDueMigration,
    /A short payment cannot be verified; record the shortfall instead/,
  )
  // Received money (verified + rejected-with-shortfall) counts toward the due.
  assert.match(coversDueMigration, /received_payment_total/)
  assert.match(
    coversDueMigration,
    /p\.status = 'rejected' and coalesce\(p\.shortfall_amount, 0\) > 0/,
  )
})

test("direct jumps to Paid and Reserved are blocked server-side", () => {
  assert.match(migration, /create trigger orders_require_reviewed_payment/);
  assert.match(migration, /before insert or update of status on public\.orders/);
  assert.match(migration, /Order cannot be confirmed without an explicitly reviewed payment/);
  assert.match(migration, /Order is not awaiting verification/);
});

test("all six buyer/seller surfaces render the Insufficient tag", () => {
  const dashboard = readFileSync(
    new URL("../src/features/dashboard/Dashboard.tsx", import.meta.url),
    "utf8",
  );
  const orders = readFileSync(
    new URL("../src/features/orders/Orders.tsx", import.meta.url),
    "utf8",
  );
  const claims = readFileSync(
    new URL("../src/features/claims/MyClaims.tsx", import.meta.url),
    "utf8",
  );
  const pendingCard = readFileSync(
    new URL("../src/features/claims/PendingPaymentCard.tsx", import.meta.url),
    "utf8",
  );

  // Dashboard: buyer + seller.
  assert.ok(
    (dashboard.match(/InsufficientPaymentNotice/g) ?? []).length >= 2,
    "buyer and seller dashboards show the tag",
  );
  // Orders: buyer cards + seller payment-issues panel.
  assert.ok(
    (orders.match(/InsufficientPaymentNotice/g) ?? []).length >= 2,
    "buyer and seller Orders tabs show the tag",
  );
  // Claims: buyer cards/table + seller status cell + pending payment card.
  assert.ok(
    (claims.match(/InsufficientPaymentNotice/g) ?? []).length >= 2,
    "buyer and seller Claims tabs show the tag",
  );
  assert.ok(pendingCard.includes("InsufficientPaymentNotice"));
  assert.ok(orders.includes("displayClaimStatus"));
  assert.ok(claims.includes("displayClaimStatus"));
});
