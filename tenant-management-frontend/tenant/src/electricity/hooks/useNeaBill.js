import { useState, useCallback } from "react";
import { uploadNeaBill, getNeaBills, parseNeaBillPdf, payNeaBill } from "../utils/electricityApi";

/**
 * useNeaBill
 * Manages NEA bill upload, listing, and PDF auto-parse for a property.
 *
 * @param {string|null} propertyId
 */
export function useNeaBill(propertyId) {
  const [bills, setBills]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [paying, setPaying]         = useState(false);
  const [parsing, setParsing]       = useState(false);
  const [error, setError]           = useState(null);
  const [parseError, setParseError] = useState(null);

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
      // Optimistically prepend the new bill, replacing same month/year if exists
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

  /**
   * parseFill(file)
   * Sends PDF to the parse-only endpoint and returns Formik-ready field values.
   * Non-throwing — returns null on failure so the dialog shows a soft warning.
   *
   * @param {File} file
   * @returns {Promise<object|null>} — { totalAmount, energyCharge, demandCharge, totalUnits, periodKey } | null
   */
  const parseFill = useCallback(async (file) => {
    if (!file || file.type !== "application/pdf") return null;
    if (!propertyId) return null;

    setParsing(true);
    setParseError(null);

    try {
      const formData = new FormData();
      formData.append("neaBillPdf", file);

      const parsed = await parseNeaBillPdf(propertyId, formData);

      // Build periodKey matching getRecentBillingPeriods / parsePeriodKey format
      let periodKey;
      if (parsed.nepaliYear && parsed.nepaliMonth) {
        periodKey = `${parsed.nepaliYear}-${String(parsed.nepaliMonth).padStart(2, "0")}`;
      }

      return {
        ...(parsed.totalAmount  != null && { totalAmount:  String(parsed.totalAmount)  }),
        ...(parsed.energyCharge != null && { energyCharge: String(parsed.energyCharge) }),
        ...(parsed.demandCharge != null && { demandCharge: String(parsed.demandCharge) }),
        ...(parsed.totalUnits   != null && { totalUnits:   String(parsed.totalUnits)   }),
        ...(periodKey !== undefined      && { periodKey }),
      };
    } catch (err) {
      setParseError(err.message ?? "Auto-parse failed");
      return null;
    } finally {
      setParsing(false);
    }
  }, [propertyId]);

  const payBill = useCallback(async (billId, paymentData) => {
    if (!propertyId) throw new Error("propertyId is required");
    setPaying(true);
    setError(null);
    try {
      const result = await payNeaBill(propertyId, billId, paymentData);
      // Update bill status in local state
      setBills((prev) =>
        prev.map((b) => (b._id === billId ? { ...b, status: "paid" } : b)),
      );
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setPaying(false);
    }
  }, [propertyId]);

  return { bills, loading, uploading, paying, parsing, error, parseError, fetchBills, upload, parseFill, payBill };
}