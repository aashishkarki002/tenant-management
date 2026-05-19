import { useState, useEffect } from "react";
import api from "../../../plugins/axios";

/**
 * Fetches active (non-vacated) tenants for a given entity.
 */
export function useActiveTenants(entityId) {
    const [tenants, setTenants] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!entityId) { setTenants([]); return; }
        setLoading(true);
        api.get("/api/tenant", { params: { entityId, limit: 200 } })
            .then(r => {
                const all = r.data?.tenants ?? r.data?.data ?? [];
                setTenants(all.filter(t => t.vacateStatus !== "vacated"));
            })
            .catch(() => setTenants([]))
            .finally(() => setLoading(false));
    }, [entityId]);

    return { tenants, loading };
}
