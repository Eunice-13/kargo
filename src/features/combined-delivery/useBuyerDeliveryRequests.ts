import {
  deliveryFailureMessage,
  unavailableDeliveryBackend,
  readDeliveryCapabilities,
} from "./availability";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  CombinedDeliveryRequest,
  CombinedDeliveryRequestCandidate,
  CombinedDeliveryRequestInput,
} from "@/types/combinedDelivery";
import {
  loadCombinedDeliveryRequestCandidates,
  loadBuyerCombinedDeliveryRequests,
  requestCombinedDelivery,
  cancelCombinedDeliveryRequest,
  recoverCombinedDeliveryRequest,
} from "@/services/combinedDelivery";

export default function useBuyerDeliveryRequests(
  buyerId: string | undefined,
  enabled: boolean,
  revision: string,
) {
  const [candidates, setCandidates] = useState<CombinedDeliveryRequestCandidate[]>([]);
  const [requests, setRequests] = useState<CombinedDeliveryRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const mutation = useRef(false);
  const reload = useCallback(async () => {
    if (!enabled || !buyerId) return;
    const current = ++sequence.current;
    setLoading(true);
    try {
      const [nextCandidates, nextRequests] = await readDeliveryCapabilities(
        loadCombinedDeliveryRequestCandidates(),
        loadBuyerCombinedDeliveryRequests(),
      );
      if (current !== sequence.current) return;
      setUnavailable(false);
      setError("");
      setCandidates(nextCandidates.filter((candidate) => candidate.buyerId === buyerId));
      setRequests(nextRequests.filter((request) => request.buyer_id === buyerId));
    } catch (failure) {
      if (current === sequence.current) {
        setCandidates([]);
        setRequests([]);
        setUnavailable(unavailableDeliveryBackend(failure));
        setError(deliveryFailureMessage(failure));
      }
    } finally {
      if (current === sequence.current) setLoading(false);
    }
  }, [buyerId, enabled]);
  useEffect(() => {
    setCandidates([]);
    setRequests([]);
    setUnavailable(false);
    setError("");
    if (!enabled || !buyerId) {
      setLoading(false);
      return;
    }
    void reload();
    const refresh = () => {
      void reload();
    };
    window.addEventListener("focus", refresh);
    return () => {
      sequence.current++;
      window.removeEventListener("focus", refresh);
    };
  }, [reload, revision, enabled, buyerId]);
  async function run(operation: () => Promise<unknown>) {
    if (mutation.current || loading || error || unavailable) return false;
    mutation.current = true;
    setBusy(true);
    try {
      await operation();
      await reload();
      return true;
    } catch (failure) {
      if (unavailableDeliveryBackend(failure)) {
        setUnavailable(true);
        setCandidates([]);
        setRequests([]);
        setError(deliveryFailureMessage(failure));
      }
      throw failure;
    } finally {
      mutation.current = false;
      setBusy(false);
    }
  }
  return {
    candidates,
    requests,
    loading,
    unavailable,
    available: enabled && !error && !unavailable,
    error,
    busy,
    reload,
    submit: (input: CombinedDeliveryRequestInput) => run(() => requestCombinedDelivery(input)),
    recover: (groupId: string) => run(() => recoverCombinedDeliveryRequest(groupId)),
    cancel: (groupId: string) => run(() => cancelCombinedDeliveryRequest(groupId)),
  };
}
