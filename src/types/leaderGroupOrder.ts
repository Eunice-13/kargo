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
};
