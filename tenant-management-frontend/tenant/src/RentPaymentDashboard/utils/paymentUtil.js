/**
 * Finds matching CAM for a given rent based on tenant and month/year
 * @param {Array} cams - Array of CAM objects
 * @param {Object} rent - Rent object
 * @returns {Object|null} Matching CAM object or null
 */
export const findMatchingCam = (cams, rent) => {
  if (!cams || !rent || !rent.tenant) return null;

  return cams.find(
    (cam) =>
      cam.tenant?._id === rent.tenant?._id &&
      cam.nepaliMonth === rent.nepaliMonth &&
      cam.nepaliYear === rent.nepaliYear,
  );
};

/**
 * Calculates payment amounts (rent, CAM, late fee, total) for a given rent.
 * Handles both paisa and rupee formats for backward compatibility.
 *
 * Late fee fields (added with late fee module):
 *   rent.lateFeePaisa        — total late fee charged by the cron
 *   rent.latePaidAmountPaisa — portion of late fee already received
 *   → remainingLateFeePaisa  = lateFeePaisa - latePaidAmountPaisa
 *
 * @param {Object} rent - Rent object
 * @param {Array}  cams - Array of CAM objects
 * @returns {Object} Amounts in rupees for display + paisa values for calculations
 */
export const getPaymentAmounts = (rent, cams) => {
  const matchingCam = findMatchingCam(cams, rent);

  const tdsAmountPaisa = rent.tdsAmountPaisa || 0;
  const rentAmountPaisa = rent.rentAmountPaisa || 0;
  const rentAmount = rentAmountPaisa / 100;

  // ── CAM ───────────────────────────────────────────────────────────────────
  const camAmountPaisa =
    matchingCam?.amountPaisa ||
    (matchingCam?.amount ? matchingCam.amount * 100 : 0) ||
    rent.tenant?.camChargesPaisa ||
    (rent.tenant?.camCharges ? rent.tenant.camCharges * 100 : 0) ||
    0;
  const camAmount = camAmountPaisa / 100;
  const lateFeePaisa = rent.lateFeePaisa || 0;
  const latePaidAmountPaisa = rent.latePaidAmountPaisa || 0;
  const remainingLateFeePaisa = Math.max(0, lateFeePaisa - latePaidAmountPaisa);
  const lateFeeAmount = remainingLateFeePaisa / 100; // rupees

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalDuePaisa =
    rentAmountPaisa + camAmountPaisa + remainingLateFeePaisa;
  const totalDue = totalDuePaisa / 100;

  return {
    // Rupees (for display)
    rentAmount,
    camAmount,
    lateFeeAmount,
    totalDue,
    // Paisa (for allocation calculations)
    tdsAmountPaisa,
    rentAmountPaisa,
    camAmountPaisa,
    lateFeePaisa,
    latePaidAmountPaisa,
    remainingLateFeePaisa,
    totalDuePaisa,
    // Convenience flags
    hasLateFee: lateFeePaisa > 0,
  };
};

/**
 * Normalizes status string to lowercase
 * @param {string} status - Status string
 * @returns {string} Lowercase status string
 */
export const normalizeStatus = (status = "") => status.toLowerCase();

/**
 * Formats payment date for display
 * @param {string|Date} date - Date string or Date object
 * @returns {string} Formatted date string or "N/A"
 */
export const formatPaymentDate = (date) => {
  if (!date) return "N/A";
  try {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) return "N/A";
    return dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (error) {
    return "N/A";
  }
};

/**
 * Formats payment method for display
 * @param {string} method - Payment method string
 * @returns {string} Formatted payment method string
 */
export const formatPaymentMethod = (method) => {
  if (!method) return "N/A";
  return method === "bank_transfer"
    ? "Bank Transfer"
    : method === "cash"
      ? "Cash"
      : method.charAt(0).toUpperCase() + method.slice(1);
};

/**
 * Formats payment status for display
 * @param {string} status - Payment status string
 * @returns {string} Formatted status string
 */
export const formatPaymentStatus = (status) => {
  if (!status) return "N/A";
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};
