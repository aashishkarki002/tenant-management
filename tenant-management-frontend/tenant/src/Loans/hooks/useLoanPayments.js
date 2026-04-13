import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

export function useLoanPayments(loanId, open) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!open || !loanId) return;
    setPayments([]);
    setLoading(true);
    try {
      const r = await api.get(`/api/loan/${loanId}/payments`);
      setPayments(r.data?.data ?? []);
    } catch (err) {
      setPayments([]);
      toast.error(err.response?.data?.message ?? "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, [loanId, open]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { payments, loading, refetch: fetch };
}
