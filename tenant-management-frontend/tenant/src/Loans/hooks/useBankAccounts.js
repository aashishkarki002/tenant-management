import { useCallback, useEffect, useState } from "react";
import api from "../../../plugins/axios";

let cache = null;
let inflight = null;

export function useBankAccounts(enabled = true) {
  const [banks, setBanks] = useState(cache ?? []);
  const [loading, setLoading] = useState(false);

  const fetchBanks = useCallback(async () => {
    if (!enabled) return;
    if (cache) {
      setBanks(cache);
      return;
    }

    try {
      setLoading(true);

      if (!inflight) {
        inflight = api
          .get("/api/bank/get-bank-accounts")
          .then((r) => r.data?.bankAccounts ?? [])
          .then((accs) => {
            cache = accs;
            return accs;
          })
          .catch(() => [])
          .finally(() => {
            inflight = null;
          });
      }

      const accs = await inflight;
      setBanks(accs);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  return { banks, loading, refetch: fetchBanks };
}

