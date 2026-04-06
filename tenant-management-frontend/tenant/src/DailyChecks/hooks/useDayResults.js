import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";

export function useDayResults(propertyId, nepaliISO) {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async (signal) => {
        if (!propertyId || !nepaliISO) return;
        setLoading(true);
        try {
            const res = await api.get("/api/checklists/today", {
                params: { propertyId, nepaliDate: nepaliISO },
                signal,
            });
            const rows = res.data?.data ?? [];
            setResults(rows.filter((r) => r.nepaliDate === nepaliISO));
        } catch (err) {
            const e = err;
            if (e?.name === "CanceledError" || e?.name === "AbortError") return;
            console.error("[useDayResults]", err);
        } finally {
            setLoading(false);
        }
    }, [propertyId, nepaliISO]);

    useEffect(() => {
        if (!propertyId || !nepaliISO) return;
        const controller = new AbortController();
        setResults([]);
        reload(controller.signal);
        return () => controller.abort();
    }, [propertyId, nepaliISO, reload]);

    const updateResult = useCallback((updated) => {
        setResults((prev) => {
            const idx = prev.findIndex((r) => r._id === updated._id);
            return idx >= 0
                ? prev.map((r, i) => (i === idx ? updated : r))
                : [...prev, updated];
        });
    }, []);

    return { results, loading, reload: () => reload(), updateResult };
}
