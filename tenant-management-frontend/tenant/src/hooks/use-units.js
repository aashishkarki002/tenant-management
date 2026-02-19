import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { toast } from "sonner";

/**
 * @param {Object} [options]
 * @param {string} [options.propertyId] - Filter units by property
 * @param {string} [options.blockId] - Filter units by block
 * @param {boolean|'all'} [options.occupied] - true = only occupied, false = only unoccupied, omitted or 'all' = all units
 */
function useUnits(options = {}) {
    const { propertyId, blockId, occupied } = options;
    const [units, setUnits] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);

        const getUnits = async () => {
            try {
                const params = new URLSearchParams();
                if (propertyId) params.set("property", propertyId);
                if (blockId) params.set("block", blockId);
                // Only send occupied when explicitly true/false; omit or 'all' = all units
                if (occupied === true) params.set("occupied", "true");
                else if (occupied === false) params.set("occupied", "false");

                const url = params.toString()
                    ? `/api/unit/get-units?${params.toString()}`
                    : "/api/unit/get-units";
                const response = await api.get(url);
                if (cancelled) return;
                if (response.data.success) {
                    setUnits(response.data.units || []);
                } else {
                    throw new Error(response.data.message || "Failed to fetch units");
                }
            } catch (error) {
                if (!cancelled) {
                    console.error("Error fetching units:", error);
                    toast.error("Failed to fetch units. Please try again.");
                    setUnits([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        getUnits();
        return () => { cancelled = true; };
    }, [propertyId, blockId, occupied]);

    return { units, loading };
}
export default useUnits;