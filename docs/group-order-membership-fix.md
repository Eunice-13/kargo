# Group Order membership fix

Read-only inspection of project `leylmztbknmlwnwgvaud` found **zero duplicate buyer/batch active memberships** and zero collisions when confirmed history was included. Only anonymous aggregates and schema/function metadata were inspected; no production records were changed. The specific reported incident cannot be conclusively reconstructed from that snapshot.

Confirmed defects:

- Deployed `join_group_order` checks for another membership but locks only the requested group. Concurrent joins into different groups can both pass the check. The existing unique constraint covers `(group_order_id,user_id)`, not buyer/batch exclusivity. RLS governs participant reads, not this invariant.
- `loadMyGroupOrder` uses an unordered `limit(1)` and mixes active groups with confirmed history.
- Opening an invitation can silently display a previous confirmed group instead of the invitation entry flow.

## Changes

`202610260001_group_membership_unique_batch.sql` adds database-derived batch/activity metadata to memberships and a partial unique `(user_id,batch_id)` index. Triggers maintain metadata from the real parent group, reject membership identity/batch relocation, and synchronize activity when group status changes. Forging metadata cannot bypass the invariant. The migration refuses existing duplicates rather than choosing survivors or deleting commitments.

Active group statuses preserve the existing backend definition: forming, waiting_for_seller, payment_pending and payment_submitted. Confirmed/cancelled/expired groups are history. Leaving/removal and terminal transitions release the active slot without deleting membership history.

The start/join functions retain their business logic, return a structured friendly conflict, and translate unique-index race failures. Repeated joining of one's current group is idempotent. No inventory or checkout function is modified.

Frontend loading prefers the sole active group, rejects conflicting active rows, and chooses confirmed history deterministically by creation time and ID. Invitation entry does not silently reopen confirmed history. Rejected mutations reload the buyer's current membership; friendly leave guidance depends on the freshly loaded group still being forming. No automatic group switching or membership repair occurs.

## Validation and rollout

- 16 focused application tests passed, including real service query selection with a mocked client, exact-group access regressions, friendly guidance and deterministic history selection.
- Authenticated isolated-local integration passed: first join; rejected second same-batch join; cross-batch membership; leave/rejoin; concurrent invitation attempts (exactly one accepted); forged metadata rejection; idempotent repeats; non-leavable conflict guidance; terminal slot release; unchanged commitments/reservation/inventory snapshots on rejected joins.
- TypeScript and whitespace checks passed. Synthetic integration fixtures were cleaned up.
- The migration was applied **only to the existing isolated local Supabase database**. Production still requires separate explicit migration approval. Until applied, the database concurrency gap remains on production.
- No production repair is currently indicated. If duplicates are later detected, stop rollout and review a survivor plus commitments/payment/inventory consequences with the owner before any separately authorized repair. Never automatically remove members, cancel groups or reallocate stock.
