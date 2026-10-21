import test from "node:test";
import assert from "node:assert/strict";
import { verifyStaging } from "../scripts/verify-staging.mjs";

const ref = "abcdefghijklmnopqrst";
const valid = () => ({
  environment: "staging",
  projectRef: ref,
  confirmedProjectRef: ref,
  supabaseUrl: `https://${ref}.supabase.co`,
  publishableKey: "sb_publishable_synthetic_test_only",
  databaseUrl: `postgresql://postgres:synthetic@db.${ref}.supabase.co:5432/postgres?sslmode=verify-full`,
  isolationApproved: true,
  schemaBaselineVerified: true,
});

test("accepts only an explicitly confirmed separate staging target", () => {
  assert.equal(verifyStaging(valid()).projectRef, ref);
});
for (const [name, patch] of Object.entries({
  production: { projectRef: "leylmztbknmlwnwgvaud", confirmedProjectRef: "leylmztbknmlwnwgvaud" },
  unapproved: { isolationApproved: false },
  unverifiedSchema: { schemaBaselineVerified: false },
  confirmationMismatch: { confirmedProjectRef: "zyxwvutsrqponmlkjihg" },
  productionApi: { supabaseUrl: "https://leylmztbknmlwnwgvaud.supabase.co" },
  productionDatabase: {
    databaseUrl:
      "postgresql://postgres:synthetic@db.leylmztbknmlwnwgvaud.supabase.co:5432/postgres?sslmode=verify-full",
  },
  ambiguousPooler: {
    databaseUrl: "postgresql://postgres:synthetic@pooler.example:5432/postgres?sslmode=verify-full",
  },
  weakTls: { databaseUrl: valid().databaseUrl.replace("verify-full", "disable") },
  connectionOverride: { databaseUrl: valid().databaseUrl + "&host=production.example" },
  secretInBrowser: { publishableKey: "sb_secret_synthetic" },
  apiRedirect: { supabaseUrl: `https://${ref}.supabase.co/other` },
})) {
  test(`rejects ${name} without exposing credentials`, () => {
    assert.throws(() => verifyStaging({ ...valid(), ...patch }), /configuration rejected/);
  });
}
