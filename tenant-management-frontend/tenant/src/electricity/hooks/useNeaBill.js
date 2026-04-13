import { useState, useCallback } from "react";
import { uploadNeaBill, getNeaBills } from "../utils/electricityApi";

/**
 * useNeaBill
 * Manages NEA bill upload and listing for a property.
 *
 * @param {string|null} propertyId
 */
export function useNeaBill(propertyId) {
  const [bills, setBills]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState(null);

  const fetchBills = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getNeaBills(propertyId);
      setBills(data.bills ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  const upload = useCallback(async (formData) => {
    if (!propertyId) throw new Error("propertyId is required");
    setUploading(true);
    setError(null);
    try {
      const result = await uploadNeaBill(propertyId, formData);
      // Optimistically prepend the new bill
      setBills((prev) => [result.neaBill, ...prev.filter(
        (b) => !(b.nepaliYear === result.neaBill.nepaliYear && b.nepaliMonth === result.neaBill.nepaliMonth)
      )]);
      return result; // { neaBill, reconciliation }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setUploading(false);
    }
  }, [propertyId]);

  return { bills, loading, uploading, error, fetchBills, upload };
}
