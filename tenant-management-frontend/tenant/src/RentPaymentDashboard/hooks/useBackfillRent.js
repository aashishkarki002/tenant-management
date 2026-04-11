import { useState } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

/**
 * Hook for admin-triggered historical rent backfill for a single tenant.
 *
 * @param {{ onSuccess?: () => void }} options
 */
export const useBackfillRent = ({ onSuccess } = {}) => {
  const [loading, setLoading] = useState(false);

  /**
   * @param {{ tenantId: string, months: { nepaliYear: number, nepaliMonth: number }[] }} params
   */
  const backfillRent = async ({ tenantId, months }) => {
    setLoading(true);
    try {
      const res = await api.post("/api/rent/backfill-tenant-rents", { tenantId, months });
      const { success, created = [], skipped = [], message } = res.data;

      if (success) {
        toast.success(
          `${message} — ${created.length} created, ${skipped.length} skipped.`,
        );
        onSuccess?.();
      } else {
        toast.error(message || "Backfill failed.");
      }
    } catch (err) {
      console.error("[useBackfillRent]", err);
      toast.error(err?.response?.data?.message || "Failed to backfill rent.");
    } finally {
      setLoading(false);
    }
  };

  return { backfillRent, loading };
};
