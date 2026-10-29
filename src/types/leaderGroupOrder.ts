import type { GroupOrder } from "./index";
export type LeaderGroupOrder = {
  id: string;
  leaderId: string;
  batchId: string;
  batchTitle: string | null;
  status: GroupOrder["status"];
  formationDeadline: string;
  paymentDeadline: string | null;
  createdAt: string;
  sellerName?: string;
  // Whether the signed-in buyer leads this group or joined it. Only the leader
  // pays, and members cannot see the leader's order (shipping progress).
  viewerRole?: "leader" | "member";
  leaderName?: string;
  members?: { id: string; name: string }[];
  ownItemCount?: number;
  ownSubtotal?: number;
  amount?: number;
  amountIsSubtotal?: boolean;
  amountRemaining?: number;
  shippingPending?: boolean;
  fulfillmentStage?: string;
};
