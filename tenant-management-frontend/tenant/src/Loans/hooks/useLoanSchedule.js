import { useCallback, useEffect, useState } from "react";
import api from "../../../plugins/axios";

export function useLoanSchedule(loanId, open) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!open || !loanId) return;
    setScheduleData(null);
    setLoading(true);
    try {
      const r = await api.get(`/api/loan/${loanId}/schedule`);
      setScheduleData(r.data?.data ?? null);
    } catch {
      setScheduleData(null);
    } finally {
      setLoading(false);
    }
  }, [loanId, open]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { scheduleData, loading, refetch: fetch };
}

