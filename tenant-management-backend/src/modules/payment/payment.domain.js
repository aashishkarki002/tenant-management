import mongoose from "mongoose";
import { Payment } from "./payment.model.js";
import { ExternalPayment } from "./externalPayment.model.js";

/**
 * Merge rent and CAM payment payloads into a single payment payload
 * @param {Object} rentPayload - Rent payment payload (optional)
 * @param {Object} camPayload - CAM payment payload (optional)
 * @returns {Object} Merged payment payload
 */
export function mergePaymentPayloads(rentPayload, camPayload) {
  // If both exist, merge them
  if (rentPayload && camPayload) {
    return {
      tenant: rentPayload.tenant || camPayload.tenant,
      amount: (rentPayload.amount || 0) + (camPayload.amount || 0),
      paymentDate: rentPayload.paymentDate || camPayload.paymentDate,
      nepaliDate: rentPayload.nepaliDate || camPayload.nepaliDate,
      paymentMethod: rentPayload.paymentMethod || camPayload.paymentMethod,
      paymentStatus:
        rentPayload.paymentStatus || camPayload.paymentStatus || "paid",
      note: rentPayload.note || camPayload.note,
      createdBy: rentPayload.createdBy || camPayload.createdBy,
      rent: rentPayload.rent || null,
      cam: camPayload.cam || null,
      allocations: {
        rent: rentPayload.allocations?.rent || null,
        cam: camPayload.allocations?.cam || null,
      },
      bankAccount: rentPayload.bankAccount || camPayload.bankAccount || null,
      receivedBy: rentPayload.receivedBy || camPayload.receivedBy || null,
    };
  }

  // If only rent exists
  if (rentPayload) {
    return rentPayload;
  }

  // If only CAM exists
  if (camPayload) {
    return camPayload;
  }

  throw new Error("At least one payload (rent or CAM) must be provided");
}

export function buildPaymentPayload({
  tenantId,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod,
  paymentStatus,
  note,
  adminId,
  bankAccountId,
  receivedBy,
  rent,
  cam,
  allocations,
}) {
  const payload = {
    tenant: tenantId,
    amount,
    paymentDate,
    nepaliDate,
    paymentMethod,
    paymentStatus: paymentStatus || "paid",
    note,
    createdBy: new mongoose.Types.ObjectId(adminId),
    rent: rent || null,
    cam: cam || null,
    allocations,
  };

  if (bankAccountId) payload.bankAccount = bankAccountId;
  if (receivedBy) payload.receivedBy = receivedBy;

  return payload;
}

/**
 * Build payment payload for rent allocation
 * @param {Object} params - Payment parameters
 * @returns {Object} Rent payment payload
 */
export function buildRentPaymentPayload({
  tenantId,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod,
  paymentStatus,
  note,
  adminId,
  bankAccountId,
  receivedBy,
  rentId,
  allocations,
}) {
  const payload = {
    tenant: tenantId,
    amount,
    paymentDate,
    nepaliDate,
    paymentMethod,
    paymentStatus: paymentStatus || "paid",
    note,
    createdBy: new mongoose.Types.ObjectId(adminId),
    rent: rentId || null,
    cam: null,
    allocations: {
      rent: allocations?.rent || null,
      cam: null,
    },
  };

  if (bankAccountId) payload.bankAccount = bankAccountId;
  if (receivedBy) payload.receivedBy = receivedBy;

  return payload;
}

/**
 * Build payment payload for CAM allocation
 * @param {Object} params - Payment parameters
 * @returns {Object} CAM payment payload
 */
export function buildCamPaymentPayload({
  tenantId,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod,
  paymentStatus,
  note,
  adminId,
  bankAccountId,
  receivedBy,
  camId,
  allocations,
}) {
  const payload = {
    tenant: tenantId,
    amount,
    paymentDate,
    nepaliDate,
    paymentMethod,
    paymentStatus: paymentStatus || "paid",
    note,
    createdBy: new mongoose.Types.ObjectId(adminId),
    rent: null,
    cam: camId || null,
    allocations: {
      rent: null,
      cam: allocations?.cam || null,
    },
  };

  if (bankAccountId) payload.bankAccount = bankAccountId;
  if (receivedBy) payload.receivedBy = receivedBy;

  return payload;
}

/**
 * Build payload for external (non-tenant) payment record
 * @param {Object} params
 * @param {string} params.payerName - External payer's name
 * @param {number} params.amount - Payment amount
 * @param {Date} params.paymentDate - Payment date
 * @param {Object} params.other - Optional: nepaliDate, paymentMethod, paymentStatus, bankAccountId, note, adminId
 * @returns {Object} External payment payload
 */
export function buildExternalPaymentPayload({
  payerName,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod = "bank_transfer",
  paymentStatus = "paid",
  bankAccountId,
  note,
  adminId,
}) {
  const payload = {
    payerName,
    amount,
    paymentDate,
    paymentMethod,
    paymentStatus,
    note: note || undefined,
    createdBy: adminId ? new mongoose.Types.ObjectId(adminId) : undefined,
  };
  if (nepaliDate) payload.nepaliDate = nepaliDate;
  if (bankAccountId) payload.bankAccount = bankAccountId;
  return payload;
}

export async function createPaymentRecord(paymentPayload, session) {
  const [payment] = await Payment.create([paymentPayload], { session });
  return payment;
}

export async function createExternalPaymentRecord(paymentPayload, session) {
  const [payment] = await ExternalPayment.create([paymentPayload], { session });
  return payment;
}

/**
 * Calculate total payment amount from allocations (rent + CAM)
 * @param {Object} allocations - Payment allocations object
 * @returns {number} Total amount
 */
export function calculateTotalAmountFromAllocations(allocations) {
  const rentAmount = allocations?.rent?.amount || 0;
  const camAmount = allocations?.cam?.paidAmount || 0;
  return rentAmount + camAmount;
}

/**
 * Validate CAM allocation data
 * @param {Object} camAllocation - CAM allocation object with camId and paidAmount
 * @returns {Object} Validation result with isValid and error message
 */
export function validateCamAllocation(camAllocation) {
  if (!camAllocation) {
    return { isValid: true }; // CAM is optional
  }

  if (!camAllocation.camId) {
    return {
      isValid: false,
      error: "CAM ID is required when CAM allocation is provided",
    };
  }

  if (!mongoose.Types.ObjectId.isValid(camAllocation.camId)) {
    return { isValid: false, error: "Invalid CAM ID format" };
  }

  if (!camAllocation.paidAmount || camAllocation.paidAmount <= 0) {
    return { isValid: false, error: "CAM paidAmount must be greater than 0" };
  }

  return { isValid: true };
}

/**
 * Determine payment type based on allocations
 * @param {Object} allocations - Payment allocations object
 * @returns {string} Payment type: 'rent_only', 'cam_only', 'both', or 'none'
 */
export function getPaymentType(allocations) {
  const hasRent = allocations?.rent?.rentId && allocations?.rent?.amount > 0;
  const hasCam = allocations?.cam?.camId && allocations?.cam?.paidAmount > 0;

  if (hasRent && hasCam) return "both";
  if (hasRent) return "rent_only";
  if (hasCam) return "cam_only";
  return "none";
}

/**
 * Prepare CAM data for receipt generation
 * @param {Object} cam - CAM document
 * @returns {Object} Formatted CAM data for receipt
 */
export function prepareCamDataForReceipt(cam) {
  if (!cam) return null;

  const nepaliMonths = [
    "Baisakh",
    "Jestha",
    "Ashadh",
    "Shrawan",
    "Bhadra",
    "Ashwin",
    "Kartik",
    "Mangsir",
    "Poush",
    "Magh",
    "Falgun",
    "Chaitra",
  ];

  const monthName =
    nepaliMonths[cam.nepaliMonth - 1] || `Month ${cam.nepaliMonth}`;
  const paidFor = `${monthName} ${cam.nepaliYear}`;

  return {
    paidFor,
    monthName,
    nepaliMonth: cam.nepaliMonth,
    nepaliYear: cam.nepaliYear,
    amount: cam.amount,
    paidAmount: cam.paidAmount,
    status: cam.status,
  };
}

/**
 * Validate payment allocations (both rent and CAM)
 * @param {Object} allocations - Payment allocations object
 * @returns {Object} Validation result with isValid and error message
 */
export function validatePaymentAllocations(allocations) {
  if (!allocations || (!allocations.rent && !allocations.cam)) {
    return {
      isValid: false,
      error: "At least one allocation (rent or CAM) is required",
    };
  }

  // Validate rent allocation if present
  if (allocations.rent) {
    if (!allocations.rent.rentId) {
      return {
        isValid: false,
        error: "Rent ID is required when rent allocation is provided",
      };
    }
    if (!mongoose.Types.ObjectId.isValid(allocations.rent.rentId)) {
      return { isValid: false, error: "Invalid rent ID format" };
    }
    if (!allocations.rent.amount || allocations.rent.amount <= 0) {
      return { isValid: false, error: "Rent amount must be greater than 0" };
    }
  }

  // Validate CAM allocation if present
  const camValidation = validateCamAllocation(allocations.cam);
  if (!camValidation.isValid) {
    return camValidation;
  }

  return { isValid: true };
}
