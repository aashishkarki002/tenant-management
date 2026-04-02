import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { resolveEntityId } from "../loan.service";

export function useLoans() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [entityId, setEntityId] = useState(null);

  useEffect(() => {
    let mounted = true;
    resolveEntityId()
      .then((id) => {
        if (!mounted) return;
        setEntityId(id);
      })
      .catch(() => {
        if (!mounted) return;
        setError("No entity found — check EntityContext or SystemConfig.defaultEntityId");
      });
    return () => {
      mounted = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/loan", { params: { entityId } });
      setLoans(res.data?.data ?? []);
    } catch (err) {
      const msg = err.response?.data?.message ?? "Failed to load loans";
      setError(msg);
      toast.error(msg);
      setLoans([]);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { loans, loading, error, refetch: fetch };
}

