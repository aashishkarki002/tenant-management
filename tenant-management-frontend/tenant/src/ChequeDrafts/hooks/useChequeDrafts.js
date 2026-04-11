import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

export function useChequeDrafts(filters = {}) {
  const [drafts, setDrafts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/cheque-drafts", { params: filters });
      setDrafts(res.data?.drafts ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err) {
      toast.error(
        err.response?.data?.message ?? "Failed to load cheque drafts",
      );
      setDrafts([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { drafts, total, loading, refetch: fetch };
}

export function useChequeDraftSummary(entityId) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await api.get("/api/cheque-drafts/summary", {
        params: { entityId },
      });
      setSummary(res.data?.data ?? null);
    } catch {
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { summary, loading, refetch: fetch };
}

export async function depositCheque(id, data) {
  const res = await api.patch(`/api/cheque-drafts/${id}/deposit`, data);
  return res.data;
}

export async function bounceCheque(id, data) {
  const res = await api.patch(`/api/cheque-drafts/${id}/bounce`, data);
  return res.data;
}

export async function cancelCheque(id, data) {
  const res = await api.patch(`/api/cheque-drafts/${id}/cancel`, data);
  return res.data;
}
