/** Phase 1: these describe existing reservations; they never reserve new stock. */
export type CombinedDeliveryCandidate = {
  id: string;
  buyerId: string;
  sellerId: string;
  batchId: string;
  destinationId: string | null;
  destinationMatches: boolean;
  fulfillmentMethod: "delivery" | "meetup";
  paymentMethod: string | null;
  orderStatus: string;
  shippingState: string | null;
  shippingFee: number | null;
  shippingFeeSet: boolean;
  shippingAccepted: boolean;
  deadlinePausedAt: string | null;
  expiresAt: string;
  groupOrderId: string | null;
  activeDeliveryGroupId: string | null;
  hasPaymentHistory: boolean;
  itemSubtotal: number;
};

export type CombinedDeliveryIneligibility =
  | "at_least_two_reservations"
  | "duplicate_reservation"
  | "different_buyer"
  | "different_seller"
  | "different_batch"
  | "invalid_batch"
  | "unconfirmed_destination"
  | "different_destination"
  | "destination_changed"
  | "different_payment_method"
  | "not_delivery"
  | "not_unpaid"
  | "shipping_finalized"
  | "shipping_not_pending"
  | "shipping_not_accepted"
  | "not_paused"
  | "deadline_exhausted"
  | "already_grouped"
  | "payment_history";

export type CombinedDeliveryEligibility = {
  eligible: boolean;
  reasons: CombinedDeliveryIneligibility[];
  feedback: string[];
};

export type CombinedDeliveryGroup = {
  id: string;
  buyer_id: string;
  seller_id: string;
  batch_id: string;
  destination_id: string;
  payment_method: string;
  fulfillment_method: "delivery";
  status:
    | "pending_approval"
    | "awaiting_shipping_fee"
    | "shipping_fee_set"
    | "rejected"
    | "cancelled"
    | "invalidated"
    | "paid";
  shipping_fee: number | null;
  approved_at?: string | null;
  shipping_fee_set_at?: string | null;
  payment_window_seconds?: number | null;
  created_at: string;
  updated_at: string;
};

/** Buyer confirmation uses the original immutable-at-submit pin/address values. */
export type CombinedDeliveryRequestCandidate = CombinedDeliveryCandidate & {
  product: string;
  qty: number;
  batchName: string;
  sellerName: string;
  orderNumber: string;
  pinLat: number | null;
  pinLng: number | null;
  addressText: string | null;
};

export type CombinedDeliveryRequest = CombinedDeliveryGroup & {
  decision_reason: string | null;
  payment?: CombinedDeliveryPaymentAccount | null;
  members: Array<{
    order_id: string;
    item_subtotal: number;
    released_at: string | null;
    order: { quantity: number; batch_products: { name: string } | null } | null;
  }>;
  destination: { pin_lat: number; pin_lng: number; address_text: string };
};

export type CombinedDeliveryRequestInput = {
  orderIds: string[];
  destination: { lat: number; lng: number; address: string };
  confirmDestination: boolean;
};

export type SellerDeliveryRequest = CombinedDeliveryRequest & {
  buyerName: string | null;
  batchName: string;
};

export type CombinedDeliveryPaymentAccount = {
  group_id: string;
  items_subtotal: number;
  shipping_fee: number;
  total: number;
  deadline: string;
  status: "ready" | "pending_review" | "rejected" | "verified" | "expired" | "invalidated";
};
