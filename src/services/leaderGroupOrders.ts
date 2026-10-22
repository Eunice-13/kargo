import { requireSupabase } from "@/lib/supabase";
import type { LeaderGroupOrder } from "@/types/leaderGroupOrder";
export async function loadLedGroupOrders(): Promise<LeaderGroupOrder[]> {
  const client = requireSupabase();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Sign in to view your group orders.");
  const { data, error } = await client
    .from("group_orders")
    .select(
      "id,leader_id,batch_id,status,formation_deadline,payment_deadline,created_at,batches(title)",
    )
    .eq("leader_id", auth.user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .filter((row) => row.leader_id === auth.user!.id)
    .map((row) => ({
      id: row.id,
      leaderId: row.leader_id,
      batchId: row.batch_id,
      batchTitle: (row.batches as unknown as { title: string } | null)?.title ?? null,
      status: row.status,
      formationDeadline: row.formation_deadline,
      paymentDeadline: row.payment_deadline,
      createdAt: row.created_at,
    }));
}
