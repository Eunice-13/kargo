export type FulfillmentAnalyticsStage =
  | "payment_confirmed"
  | "preparing"
  | "shipped"
  | "in_transit"
  | "delivered"
  | "cancelled"
  | "expired";

export type FulfillmentAnalyticsFilters = {
  period?: "today" | "last_7_days" | "last_30_days" | "all_time" | "custom";
  /** Inclusive Manila calendar dates (YYYY-MM-DD), custom period only. */
  start?: string;
  end?: string;
};

export type FulfillmentAnalytics = {
  period: NonNullable<FulfillmentAnalyticsFilters["period"]>;
  timezone: "Asia/Manila";
  startAt: string;
  endAt: string;
  grouping: "hour" | "day" | "week" | "month";
  generatedAt: string;
  snapshot: string;
  captureStartedAt: string;
  historicalCoverage: "partial_evidence_only";
  countingRule: "first_recorded_entry_per_order_per_stage";
  totalEntries: number;
  uniqueOrders: number;
  stageTotals: Record<FulfillmentAnalyticsStage, number>;
  chart: {
    bucketStart: string;
    bucketEnd: string;
    counts: Record<FulfillmentAnalyticsStage, number>;
  }[];
};

export type FulfillmentAnalyticsOrders = {
  generatedAt: string;
  total: number;
  nextOffset: number;
  rows: {
    order_id: string;
    order_number: string;
    stage: FulfillmentAnalyticsStage;
    occurred_at: string;
    source: "transition" | "order_timestamp" | "notification" | "admin_audit";
    current_status: string;
    current_fulfillment_stage: string | null;
  }[];
};
