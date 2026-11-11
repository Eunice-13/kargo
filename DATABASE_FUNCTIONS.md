# KARGO Database: Migrations and Functions

This document inventories the KARGO Supabase schema history and the database
functions, triggers, and jobs that back the platform.

## How the migration history is organized

The canonical migration history is split across two folders:

| Folder                                                   | Range                   | Role                      |
| -------------------------------------------------------- | ----------------------- | ------------------------- |
| `supabase/migrations (to update profile database name)/` | 2026-09-20 → 2026-10-23 | Older canonical history   |
| `supabase/migrations/`                                   | 2026-10-25 → 2026-11-10 | Current canonical history |

Two further locations are **deployment copies, not separate schema**:

| Path                                                     | Contents                                                                   |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| `supabase/release-bundles/combined-delivery/migrations/` | Re-timestamped (2026-10-24) duplicates of the combined-delivery migrations |
| `supabase/rollbacks/`                                    | Down-migrations for the combined-delivery set                              |

---

## Migrations

### Foundation and core commerce (2026-09-20 → 2026-10-10)

| Migration                                               | Purpose                                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `202609200001_initial_kargo_schema`                     | Base schema: user profiles, batches, products, orders/claims, payments, waitlist, reviews, notifications, RLS policies, and core RPCs. |
| `202609200002_batch_expenses`                           | Per-batch expense records used in the financial summary.                                                                               |
| `202609230001_profile_reviews`                          | Order reviews that feed seller profile ratings.                                                                                        |
| `202609240001_spec_updates`                             | Claim/payment adjustments and the seller receive-methods function.                                                                     |
| `202609250001_per_user_limit`                           | Per-buyer claim/order quantity limits.                                                                                                 |
| `202609260001_waitlist_offers_schema`                   | Waitlist offer fields and email-preference helper.                                                                                     |
| `202609260002_waitlist_offers_rpcs`                     | Available-stock, waitlist offer/response, and place-order-for-buyer RPCs.                                                              |
| `202609260003_expiry_sweep_cron`                        | Scheduled sweep for expired reservations.                                                                                              |
| `202609270001_expired_payment_guard`                    | Blocks payment on expired orders; adds expiry helper.                                                                                  |
| `202609270002_payment_proof_details`                    | Payment proof metadata fields.                                                                                                         |
| `202609270003_remove_payer_account_number`              | Removes payer account-number storage.                                                                                                  |
| `202609270004_fix_payment_method_mapping`               | Corrects payment-method mapping.                                                                                                       |
| `202609270005_payment_history_realtime`                 | Enables realtime on payment history.                                                                                                   |
| `202609270006_rejected_payment_deadline`                | Sets the deadline behavior after a rejected payment.                                                                                   |
| `202609280001_batch_reactions`                          | Batch favorites/likes storage.                                                                                                         |
| `202609280002_normalize_batch_categories`               | Normalizes batch categories.                                                                                                           |
| `202609280003_set_batch_reaction_rpc`                   | RPC to add/remove a batch reaction.                                                                                                    |
| `202609290001_profile_ratings`                          | Seller rating aggregates.                                                                                                              |
| `202609300001_consolidate_batch_categories`             | Consolidates categories.                                                                                                               |
| `202609300002_remove_unused_features`                   | Removes BIR badge verification and unused fields/functions.                                                                            |
| `202609300003_seller_batch_expense_totals`              | Seller expense aggregate view (later dropped).                                                                                         |
| `202609300004_pending_only_buyer_cancellation`          | Buyers may cancel only pending orders.                                                                                                 |
| `202609300005_notify_payment_resubmission`              | Notification when a buyer resubmits payment.                                                                                           |
| `202609300006_buyer_order_payment_states`               | Buyer-side payment-state RPC.                                                                                                          |
| `202609300007_reopen_mia_sk_ii_payment`                 | One-off data correction for a payment.                                                                                                 |
| `202610010001_auto_claim_waitlist_stock`                | Auto-claims released stock for waitlisted buyers.                                                                                      |
| `202610010002_drop_seller_batch_expense_totals`         | Drops the unused expense view.                                                                                                         |
| `202610010003_remove_unused_contact_fulfillment_fields` | Removes unused profile/contact/fulfillment fields.                                                                                     |
| `202610010004_waitlist_limits_and_cleanup`              | Per-product waitlist limits; converts stale waiters.                                                                                   |
| `202610010005_restore_payment_method_lifecycle`         | Restores active state and timestamps for receive methods.                                                                              |
| `202610010005_zero_waitlist_limit`                      | Allows a zero/unlimited waitlist limit.                                                                                                |
| `202610010007_rename_profiles_to_user_profiles`         | Renames `profiles` to `user_profiles`.                                                                                                 |
| `202610010008_waitlist_claim_priority`                  | Waitlist priority ordering for stock release.                                                                                          |
| `202610010009_update_profile_function_references`       | Updates functions after the profile rename.                                                                                            |

### Delivery, group orders, email (2026-10-12 → 2026-10-23)

| Migration                                            | Purpose                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `202610120001_nylas_email_queue`                     | Pending-email queue and the claim RPC for the worker.                            |
| `202610120002_buyer_transactional_emails`            | Queues payment, fulfillment, and deadline-reminder emails.                       |
| `202610180001_tracking_and_buyer_shipping`           | Tracking fields, shipping fee, location correction, decline-order, delivery pin. |
| `202610180002_delivery_pin_address`                  | Delivery address text and claim-with-address RPC.                                |
| `202610180003_restore_tracking_fields`               | Restores tracking fields.                                                        |
| `202610180004_signup_metadata_profile_fields`        | Populates profile fields from signup metadata.                                   |
| `202610180005_cascade_batches_on_seller_delete`      | Cascades deletes when a seller is removed.                                       |
| `202610190001_batch_media_uploads`                   | Batch media storage and records.                                                 |
| `202610190002_batch_group_orders`                    | Group-order schema and RPCs (start/join/commit/checkout/shipping/payment).       |
| `202610190002_branded_email_design`                  | Branded email templates, context, and asset bucket.                              |
| `202610200001_extension_request_emails`              | Extension-request and decision emails.                                           |
| `202610200001_read_notification_retention`           | Cleanup of read notifications.                                                   |
| `202610200002_batch_gallery_images`                  | Batch gallery images.                                                            |
| `202610200002_combined_delivery_foundations`         | Combined-delivery tables, eligibility, and guard triggers.                       |
| `202610210001_combined_delivery_buyer_requests`      | Buyer combined-delivery request RPCs.                                            |
| `202610210002_combined_delivery_seller_review`       | Seller review/approval of combined delivery.                                     |
| `202610210003_combined_delivery_recovery`            | Invalidation and recovery of combined requests.                                  |
| `202610210004_combined_delivery_batch_integrity`     | Batch identity and pin integrity triggers.                                       |
| `202610210005_combined_delivery_payments`            | Combined payment submission, review, and expiry.                                 |
| `202610230001_combined_payment_method_compatibility` | Payment-method compatibility for combined payments.                              |

### Admin, fulfillment, analytics (2026-10-25 → 2026-11-10)

| Migration                                                  | Purpose                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `202610250001_buyer_addresses`                             | Saved buyer addresses and address RPCs.                                       |
| `202610260001_group_membership_unique_batch`               | One active group per user per batch; membership triggers and start/join RPCs. |
| `202610270001_group_formation_expiration`                  | Formation deadline, expiry, and group checkout/commitment/member RPCs.        |
| `202610280001_group_order_payment_integrity`               | Group payment locking/expiry, shipping fee, submit/review, cancel, extension. |
| `202611010001_admin_foundation`                            | Admin tables, `is_admin`, `enable_seller_access`, audit helper.               |
| `202611010002_admin_users_dashboard`                       | Admin dashboard, user directory, account status, seller access RPCs.          |
| `202611010003_admin_batches_transactions`                  | Admin batches, orders, payments, combined payments, moderation RPCs.          |
| `202611010004_admin_team_audit`                            | Admin team and audit-log RPCs.                                                |
| `202611020001_admin_dashboard_performance`                 | Dashboard performance rewrite.                                                |
| `202611020002_admin_gmv_realization`                       | GMV realization in dashboard and user views.                                  |
| `202611020003_admin_order_detail_payment_order`            | Orders payment detail ordering.                                               |
| `202611030001_admin_invite_acceptance`                     | Admin invite accept/decline.                                                  |
| `202611030001_cascade_user_delete`                         | Cascades data on user deletion.                                               |
| `202611030002_account_status_notice`                       | Account-status history and notice RPC.                                        |
| `202611040001_forward_only_fulfillment`                    | Forward-only fulfillment status enforcement.                                  |
| `202611040001_group_notification_context`                  | Enriches group notification context.                                          |
| `202611050001_no_cancel_after_payment`                     | Blocks cancellation after payment; admin cancel rules.                        |
| `202611060001_fulfillment_analytics`                       | Fulfillment capture and analytics RPCs.                                       |
| `202611060002_admin_paid_missing_tracking`                 | "Paid, missing tracking" order filter.                                        |
| `202611060003_analytics_expired`                           | Adds expired stage to analytics.                                              |
| `202611060004_admin_flagged_hidden_batches`                | Flagged/hidden batch filter.                                                  |
| `202611070001_batch_auto_close`                            | Auto-closes batches on end date; reopen; claim/waitlist updates.              |
| `202611070001_top_sellers_by_orders`                       | Top sellers ranked by orders.                                                 |
| `202611070002_required_batch_images`                       | Requires images when creating batches.                                        |
| `202611070003_admin_batch_product_images`                  | Product images in admin batch detail.                                         |
| `202611080001_admin_list_users_alphabetical`               | Alphabetical user listing.                                                    |
| `202611090001_extension_request_limit`                     | Caps extension requests.                                                      |
| `202611090002_batch_gallery_from_batch_media`              | Gallery sourced from batch media.                                             |
| `202611090003_batch_catalog_item_gallery`                  | Catalog item gallery.                                                         |
| `202611090004_fulfillment_analytics_cohort`                | Cohort-based fulfillment analytics.                                           |
| `202611090005_fulfillment_analytics_full_history`          | Full-history analytics support.                                               |
| `202611090006_fulfillment_analytics_current_status`        | Current-status analytics.                                                     |
| `202611090007_fulfillment_analytics_current_status_orders` | Current-status order drill-down.                                              |
| `202611090008_fulfillment_analytics_current_status_chart`  | Current-status chart data.                                                    |
| `202611090009_admin_seller_buyer_count`                    | Seller/buyer counts on user detail.                                           |
| `202611100001_fulfillment_analytics_created_window`        | Created-window cohort analytics.                                              |
| `202611100001_payment_review_shortfall`                    | Shortfall/insufficient-payment handling.                                      |
| `202611100002_fulfillment_current_status_all_orders`       | Current status across all orders.                                             |
| `202611100002_verified_payment_covers_due`                 | Verified payment must cover amount due.                                       |
| `202611100003_fulfillment_reached_all_orders`              | Reached-stage across all orders.                                              |
| `202611100004_no_cancel_expired_orders`                    | Blocks cancelling expired orders.                                             |

### Signup requirements (2026-11-11)

| Migration                                      | Purpose                                                                                                                                                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `202611110001_signup_required_address_payment` | Requires a buyer delivery address + map pin, one seller payment method, and at least one social account at signup; saves the buyer address to `buyer_addresses` and inserts the seller method from auth metadata. |

### Deployment copies

| Path                                                            | Purpose                                                              |
| --------------------------------------------------------------- | -------------------------------------------------------------------- |
| `release-bundles/combined-delivery/migrations/202610240001…007` | Re-timestamped duplicates of the combined-delivery migrations above. |
| `rollbacks/202610200002…202610210005`                           | Down-migrations for the combined-delivery set.                       |

---

## Database functions and triggers

Several functions are redefined across migrations; the purpose shown reflects
the final behavior.

### Access, identity, and account

| Function                                         | Type       | Purpose                                                                                                                                                       |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `set_updated_at`                                 | Trigger    | Stamps `updated_at` on row updates.                                                                                                                           |
| `handle_new_auth_user`                           | Trigger    | Creates a profile when an auth user signs up, including the required social account, buyer signup address and seller payment method from the signup metadata. |
| `is_active`                                      | RPC/helper | Returns whether an account is active (not suspended).                                                                                                         |
| `can_sell`                                       | RPC/helper | Returns whether the user has seller capability.                                                                                                               |
| `enable_seller_access`                           | RPC        | Grants seller capability through a controlled path.                                                                                                           |
| `is_admin`                                       | RPC/helper | Returns whether the user is an active admin.                                                                                                                  |
| `wants_email`                                    | Helper     | Checks a user's email preference for a category.                                                                                                              |
| `my_account_status`                              | RPC        | Returns the caller's status and moderation history.                                                                                                           |
| `submit_bir_badge` / `complete_bir_verification` | Removed    | BIR badge verification (removed in `202609300002`).                                                                                                           |

### Batches, products, inventory, and claims

| Function                                 | Type       | Purpose                                                      |
| ---------------------------------------- | ---------- | ------------------------------------------------------------ |
| `create_batch_with_products`             | RPC        | Creates a batch and its products, enforcing required images. |
| `claim_batch_product`                    | RPC        | Claims stock with availability and per-user limits.          |
| `claim_batch_product_with_address`       | RPC        | Claims stock and stores the delivery address/pin.            |
| `available_stock`                        | RPC        | Returns remaining stock for a product.                       |
| `place_order_for_buyer`                  | RPC        | Creates an order on behalf of a buyer (waitlist conversion). |
| `get_financial_summary`                  | RPC        | Batch revenue, expenses, tax, discounts, and net.            |
| `close_expired_batches`                  | RPC/helper | Closes batches past their end date.                          |
| `reopen_batch`                           | RPC        | Reopens a closed batch with a new end date.                  |
| `set_batch_reaction`                     | RPC        | Adds/removes a buyer's favorite/like on a batch.             |
| `seller_receive_methods`                 | RPC        | Lists a seller's active receive methods.                     |
| `set_product_waitlist_limit`             | RPC        | Sets a product's waitlist limit.                             |
| `cancel_order`                           | RPC        | Cancels an order under the allowed conditions.               |
| `create_buyer_request`                   | RPC        | Records a buyer's request for an unlisted item.              |
| `create_order_review`                    | RPC        | Records a review/rating for a completed order.               |
| `submit_order_payment`                   | RPC        | Submits payment proof and method details.                    |
| `review_order_payment`                   | RPC        | Seller verifies, rejects, or marks insufficient.             |
| `notify_payment_resubmission`            | RPC        | Queues a resubmission notification.                          |
| `buyer_order_payment_states`             | RPC        | Buyer-side effective payment state.                          |
| `received_payment_total`                 | Helper     | Sum of verified payments for an order.                       |
| `request_order_extension`                | RPC        | Buyer requests a payment extension (cap enforced).           |
| `decide_order_extension`                 | RPC        | Seller approves/denies an extension.                         |
| `set_fulfillment_status`                 | RPC        | Advances an order's fulfillment stage.                       |
| `set_order_shipping_fee`                 | RPC        | Sets the shipping fee and resumes the timer.                 |
| `request_location_correction`            | RPC        | Asks the buyer to correct the delivery pin.                  |
| `decline_delivery_order`                 | RPC        | Declines an order with a reason and releases stock.          |
| `update_order_delivery_pin`              | RPC        | Updates an order's delivery pin.                             |
| `update_order_delivery_pin_with_address` | RPC        | Updates pin plus address text.                               |
| `set_order_tracking`                     | RPC        | Stores courier and tracking-link details.                    |

### Waitlist and expiry

| Function                                | Type       | Purpose                                                     |
| --------------------------------------- | ---------- | ----------------------------------------------------------- |
| `join_waitlist`                         | RPC        | Joins a product waitlist (limit-aware).                     |
| `offer_to_next_waitlist`                | RPC/helper | Offers or auto-claims released stock for the next waiter.   |
| `respond_waitlist_offer`                | Legacy     | Accept/decline a waitlist offer (superseded by auto-claim). |
| `sweep_expirations`                     | RPC/cron   | Expires reservations, groups, and combined payments.        |
| `sweep_standalone_delivery_expirations` | RPC/cron   | Expires standalone delivery-related reservations.           |
| `expire_claim_if_due`                   | Helper     | Expires one claim if past its deadline.                     |
| `reject_expired_payment_insert`         | Trigger    | Rejects payment inserts for expired orders.                 |

### Group orders

| Function                               | Type     | Purpose                                      |
| -------------------------------------- | -------- | -------------------------------------------- |
| `generate_group_referral_code`         | Helper   | Generates a unique referral code.            |
| `group_formation_deadline`             | Helper   | Computes the group's formation deadline.     |
| `can_view_group_order`                 | Helper   | Checks whether the caller may read a group.  |
| `start_group_order`                    | RPC      | Creates a group and makes the caller leader. |
| `join_group_order`                     | RPC      | Joins by referral code.                      |
| `set_group_commitment`                 | RPC      | Saves a member's item quantity.              |
| `leave_group_order`                    | RPC      | Member leaves a forming group.               |
| `remove_group_member`                  | RPC      | Leader removes a member.                     |
| `regenerate_group_code`                | RPC      | Issues a new invitation code.                |
| `checkout_group_order`                 | RPC      | Leader checkout with payment method and pin. |
| `set_group_order_shipping_fee`         | RPC      | Sets the group's shipping fee.               |
| `request_group_location_correction`    | RPC      | Requests a group delivery-pin correction.    |
| `update_group_delivery_pin`            | RPC      | Updates the group delivery pin.              |
| `decline_group_delivery_order`         | RPC      | Declines a group delivery with a reason.     |
| `submit_group_order_payment`           | RPC      | Submits the group payment proof.             |
| `review_group_order_payment`           | RPC      | Seller reviews the group payment.            |
| `expire_forming_group_orders`          | RPC/cron | Expires groups past formation.               |
| `lock_payable_group_orders`            | Helper   | Locks payable group orders for update.       |
| `expire_group_order_payment`           | Helper   | Expires one group's payment.                 |
| `expire_group_order_payments`          | RPC/cron | Expires all due group payments.              |
| `sync_group_membership_context`        | Trigger  | Keeps membership context consistent.         |
| `sync_group_membership_activity`       | Trigger  | Maintains membership activity state.         |
| `enforce_group_aware_order_inventory`  | Trigger  | Enforces group-aware stock rules.            |
| `prevent_started_batch_rule_changes`   | Trigger  | Blocks rule changes once a batch starts.     |
| `prevent_started_product_unit_changes` | Trigger  | Blocks unit changes once a batch starts.     |

### Combined delivery

| Function                                                                                                                                                                                                                                                                          | Type     | Purpose                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `combined_delivery_candidates`                                                                                                                                                                                                                                                    | RPC      | Lists orders eligible to be combined.                                    |
| `combined_delivery_request_candidates`                                                                                                                                                                                                                                            | RPC      | Lists candidates for a new request.                                      |
| `combined_delivery_eligibility`                                                                                                                                                                                                                                                   | RPC      | Validates a set of order IDs.                                            |
| `combined_delivery_batch_reasons` / `combined_delivery_batch_feedback`                                                                                                                                                                                                            | Helper   | Batch-eligibility reasons and messages.                                  |
| `combined_delivery_order_reasons`                                                                                                                                                                                                                                                 | Helper   | Per-order eligibility reasons.                                           |
| `assert_combined_delivery_batch`                                                                                                                                                                                                                                                  | Helper   | Asserts orders share one batch.                                          |
| `request_combined_delivery`                                                                                                                                                                                                                                                       | RPC      | Creates a combined-delivery request.                                     |
| `cancel_combined_delivery_request`                                                                                                                                                                                                                                                | RPC      | Buyer cancels a request.                                                 |
| `invalidate_combined_delivery_request`                                                                                                                                                                                                                                            | RPC      | Invalidates and releases an ineligible request.                          |
| `review_combined_delivery`                                                                                                                                                                                                                                                        | RPC      | Seller approves/rejects or sets the shared fee.                          |
| `seller_combined_delivery_requests`                                                                                                                                                                                                                                               | RPC      | Lists requests for the seller.                                           |
| Guard triggers (`guard_delivery_destination_snapshot`, `guard_combined_delivery_group`, `guard_combined_delivery_member`, `guard_order_combined_delivery`, `guard_active_delivery_batch_identity`, `guard_individual_combined_delivery_payment`, `guard_combined_payment_review`) | Triggers | Enforce destination, membership, batch identity, and payment invariants. |
| `check_combined_delivery_member_count`                                                                                                                                                                                                                                            | Trigger  | Enforces member-count rules.                                             |
| `audit_combined_delivery_group` / `audit_combined_delivery_member`                                                                                                                                                                                                                | Trigger  | Write audit rows for changes.                                            |
| `stamp_combined_delivery_order_revision`                                                                                                                                                                                                                                          | Trigger  | Stamps order revision for integrity.                                     |
| `sync_combined_delivery_batch_pin`                                                                                                                                                                                                                                                | Trigger  | Syncs the batch-level delivery pin.                                      |
| `combined_payment_context`                                                                                                                                                                                                                                                        | Helper   | Resolves combined-payment context.                                       |
| `lock_combined_payment`                                                                                                                                                                                                                                                           | Helper   | Locks the group for payment.                                             |
| `transition_combined_payment_orders`                                                                                                                                                                                                                                              | Helper   | Moves member orders through payment states.                              |
| `activate_combined_payment`                                                                                                                                                                                                                                                       | Helper   | Activates a combined payment.                                            |
| `notify_combined_payment`                                                                                                                                                                                                                                                         | Helper   | Queues combined-payment notifications.                                   |
| `submit_combined_delivery_payment`                                                                                                                                                                                                                                                | RPC      | Submits one payment for the group.                                       |
| `review_combined_delivery_payment`                                                                                                                                                                                                                                                | RPC      | Seller reviews the combined payment.                                     |
| `expire_combined_payments`                                                                                                                                                                                                                                                        | RPC/cron | Expires combined payments.                                               |

### Buyer addresses

| Function                    | Type | Purpose                          |
| --------------------------- | ---- | -------------------------------- |
| `save_buyer_address`        | RPC  | Creates/updates a saved address. |
| `set_default_buyer_address` | RPC  | Marks an address as default.     |
| `delete_buyer_address`      | RPC  | Deletes a saved address.         |

### Notifications and transactional email

| Function                            | Type           | Purpose                                         |
| ----------------------------------- | -------------- | ----------------------------------------------- |
| `claim_pending_emails`              | RPC            | Claims a batch of queued emails for the worker. |
| `queue_payment_email`               | Trigger/helper | Queues payment-related emails.                  |
| `queue_fulfillment_email`           | Trigger/helper | Queues shipping/delivery emails.                |
| `queue_payment_deadline_reminders`  | RPC/cron       | Queues deadline reminders.                      |
| `cleanup_read_notifications`        | RPC/cron       | Deletes old read notifications.                 |
| `enrich_group_notification_context` | Trigger        | Adds group context to notifications.            |

### Admin and moderation

| Function                                                             | Type    | Purpose                                    |
| -------------------------------------------------------------------- | ------- | ------------------------------------------ |
| `admin_assert`                                                       | Helper  | Asserts the caller is an active admin.     |
| `admin_audit`                                                        | Helper  | Writes an immutable audit entry.           |
| `admin_dashboard`                                                    | RPC     | KPIs, attention queue, top sellers, GMV.   |
| `admin_list_users` / `admin_search_users` / `admin_get_user`         | RPC     | User directory, search, and detail.        |
| `admin_set_account_status`                                           | RPC     | Suspends/restores an account with reason.  |
| `admin_set_seller_access`                                            | RPC     | Grants/revokes seller capability.          |
| `admin_list_batches` / `admin_get_batch` / `admin_moderate_batch`    | RPC     | Batch directory, detail, and moderation.   |
| `admin_list_orders` / `admin_get_order` / `admin_cancel_order`       | RPC     | Order directory, detail, and cancellation. |
| `admin_list_payments` / `admin_get_payment` / `admin_review_payment` | RPC     | Payment directory, detail, and override.   |
| `admin_list_combined_payments`                                       | RPC     | Combined-payment oversight.                |
| `admin_list_team`                                                    | RPC     | Admin team directory.                      |
| `admin_grant_admin` / `admin_revoke_admin`                           | RPC     | Grant/revoke admin access.                 |
| `admin_my_invite` / `admin_accept_invite` / `admin_decline_invite`   | RPC     | Invitation lifecycle.                      |
| `admin_list_audit`                                                   | RPC     | Audit-log listing.                         |
| `guard_order_hidden_batch`                                           | Trigger | Prevents orders against hidden batches.    |

### Fulfillment analytics and guards

| Function                                    | Type       | Purpose                                  |
| ------------------------------------------- | ---------- | ---------------------------------------- |
| `fulfillment_analytics_stage`               | Helper     | Maps a status to an analytics stage.     |
| `capture_order_fulfillment_entry`           | Trigger    | Records stage-entry history.             |
| `fulfillment_analytics_range`               | Helper     | Resolves analytics date ranges.          |
| `fulfillment_analytics_reached`             | RPC/helper | Reached-stage aggregation.               |
| `fulfillment_analytics_current_cohort`      | RPC        | Current-status cohort.                   |
| `fulfillment_analytics_current_cohort_rows` | Helper     | Cohort row source.                       |
| `fulfillment_analytics_current_stage`       | Helper     | Maps current status to a stage.          |
| `admin_fulfillment_analytics`               | RPC        | Stage/trend analytics for admins.        |
| `admin_fulfillment_orders`                  | RPC        | Order drill-down for an analytics point. |
| `admin_fulfillment_current_status`          | RPC        | Current-status analytics.                |
| `admin_fulfillment_current_status_orders`   | RPC        | Current-status order drill-down.         |
| `guard_forward_fulfillment`                 | Trigger    | Blocks backward status moves.            |
| `guard_order_payment_confirmation`          | Trigger    | Validates payment confirmation.          |
| `guard_verified_payment_covers_due`         | Trigger    | Requires verified amount to cover due.   |
| `phase3_review_order_payment`               | Helper     | Internal payment-review transition.      |

### Edge Function

| Function                 | Purpose                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `process-pending-emails` | Drains `pending_emails` once per minute, renders branded HTML/text, and sends via Nylas or Brevo. |

---

## Accuracy notes

- `submit_bir_badge` and `complete_bir_verification` no longer exist; BIR
  verification was removed in `202609300002`. Remaining BIR references are only
  in CSS, imports, and comments.
- `respond_waitlist_offer` and the manual offer flow are legacy; current
  behavior is auto-claim of released stock.
- `admin_dashboard`, `admin_list_users`, `admin_get_user`, `admin_list_batches`,
  `admin_list_orders`, `admin_fulfillment_*`, `review_order_payment`,
  `request_order_extension`, `set_fulfillment_status`, and `admin_cancel_order`
  are redefined several times; the tables above show their final behavior.
- Combined-delivery SQL appears twice: the `20261020*`–`20261023*` files in the
  older migrations folder and the `20261024*` files under
  `release-bundles/combined-delivery`. They describe the same schema.
