import { useCallback, useEffect, useState } from "react";
import api from "../../../plugins/axios";

const cacheMap = {};
const inflightMap = {};

export function useBankAccounts(enabled = true, entityId = null) {
  const key = entityId ?? "default";
  const [banks, setBanks] = useState(cacheMap[key] ?? []);
  const [loading, setLoading] = useState(false);

  const fetchBanks = useCallback(async () => {
    if (!enabled) return;
    if (cacheMap[key]) {
      setBanks(cacheMap[key]);
      return;
    }

    try {
      setLoading(true);

      if (!inflightMap[key]) {
        const params = entityId ? { entityId } : {};
        inflightMap[key] = api
          .get("/api/bank/get-bank-accounts", { params })
          .then((r) => r.data?.bankAccounts ?? [])
          .then((accs) => {
            cacheMap[key] = accs;
            return accs;
          })
          .catch(() => [])
          .finally(() => {
            delete inflightMap[key];
          });
      }

      const accs = await inflightMap[key];
      setBanks(accs);
    } finally {
      setLoading(false);
    }
  }, [enabled, key, entityId]);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  return { banks, loading, refetch: fetchBanks };
}
