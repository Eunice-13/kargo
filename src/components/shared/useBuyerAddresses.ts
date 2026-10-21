import { useEffect, useState, useCallback } from "react";
import { loadBuyerAddresses, type BuyerAddress } from "@/services/buyerAddresses";
import { isSupabaseConfigured } from "@/lib/supabase";
export default function useBuyerAddresses() {
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAddresses(isSupabaseConfigured ? await loadBuyerAddresses() : []);
    } catch (e) {
      setError(
        e && typeof e === "object" && "message" in e
          ? String(e.message)
          : "Unable to load saved addresses.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { addresses, loading, error, reload };
}
