import test from "node:test";
import assert from "node:assert/strict";
import {
  unavailableDeliveryBackend,
  deliveryFailureMessage,
  deliveryUnavailableMessage,
} from "../src/features/combined-delivery/availability.ts";
for (const error of [
  {
    code: "PGRST202",
    message:
      "Could not find function public.combined_delivery_request_candidates in the schema cache",
  },
  {
    code: "PGRST202",
    message: "Could not find function public.seller_combined_delivery_requests in the schema cache",
  },
  { code: "PGRST205", message: "Could not find table public.combined_delivery_payment_accounts" },
  { code: "PGRST200", message: "Could not find relationship combined_delivery_members" },
  { code: "42703", message: "column combined_delivery_group_id does not exist" },
])
  test(`recognizes explicit unavailable capability ${error.message}`, () => {
    assert.equal(unavailableDeliveryBackend(error), true);
    assert.equal(deliveryFailureMessage(error), deliveryUnavailableMessage);
  });
for (const error of [
  { code: "42501", message: "permission denied for combined_delivery_groups" },
  { code: "PGRST301", message: "JWT expired" },
  { code: "PGRST200", message: "Missing orders/batch_products relationship" },
  { code: "PGRST201", message: "Ambiguous combined_delivery_groups relationship" },
  { code: "PGRST202", message: "Missing unrelated_function" },
  { code: "42703", message: "column amount does not exist" },
  new TypeError("Network request failed"),
])
  test(`preserves unexpected failure ${error.message}`, () => {
    assert.equal(unavailableDeliveryBackend(error), false);
    assert.ok(deliveryFailureMessage(error).includes(error.message));
    assert.notEqual(deliveryFailureMessage(error), deliveryUnavailableMessage);
  });

test("mixed optional reads preserve the authorization failure rather than faster missing schema", async () => {
  const { readDeliveryCapabilities } =
    await import("../src/features/combined-delivery/availability.ts");
  const denied = { code: "42501", message: "permission denied" };
  await assert.rejects(
    readDeliveryCapabilities(
      Promise.reject({ code: "PGRST202", message: "Missing combined_delivery_request_candidates" }),
      Promise.reject(denied),
    ),
    (failure) => failure === denied,
  );
});
test("mixed optional reads preserve transport failure over missing schema", async () => {
  const { readDeliveryCapabilities } =
    await import("../src/features/combined-delivery/availability.ts");
  const network = new TypeError("Network unavailable");
  await assert.rejects(
    readDeliveryCapabilities(
      Promise.reject(network),
      Promise.reject({ code: "PGRST205", message: "Missing combined_delivery_groups" }),
    ),
    (failure) => failure === network,
  );
});
test("available optional reads retain both payloads without replacing failures with empty lists", async () => {
  const { readDeliveryCapabilities } =
    await import("../src/features/combined-delivery/availability.ts");
  assert.deepEqual(
    await readDeliveryCapabilities(Promise.resolve(["candidate"]), Promise.resolve(["request"])),
    [["candidate"], ["request"]],
  );
});
