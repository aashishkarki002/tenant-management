/**
 * payment.domain.js  (FIXED)
 *
 * FIX — Replaced all Math.round(amount * 100) with rupeesToPaisa(amount).
 *   Math.round() skips Banker's Rounding; rupeesToPaisa() uses it.
 *   For paisa values this rarely matters but inconsistency causes confusion
 *   when hunting rounding bugs across the codebase.
 *
 * Everything else (payload builders, merge, helpers) is unchanged.
 */

import mongoose from "mongoose";
import { Payment } from "./payment.model.js";
import { ExternalPayment } from "./externalPayment.model.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";

// ─────────────────────────────────────────────────────────────────────────────
// PAYLOAD BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

export function buildPaymentPayload({
  tenantId,
  amountPaisa,
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
  const finalAmountPaisa =
    amountPaisa !== undefined ? amountPaisa : rupeesToPaisa(amount || 0); // FIX: was Math.round(amount * 100)

  const payload = {
    tenant: tenantId,
    amountPaisa: finalAmountPaisa,
    amount: finalAmountPaisa / 100,
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

export function buildRentPaymentPayload({
  tenantId,
  amountPaisa,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod,
  paymentStatus,
  note,
  transactionRef,
  adminId,
  bankAccountId,
  receivedBy,
  rentId,
  allocations,
}) {
  const finalAmountPaisa =
    amountPaisa !== undefined ? amountPaisa : rupeesToPaisa(amount || 0); // FIX

  const payload = {
    tenant: tenantId,
    amountPaisa: finalAmountPaisa,
    amount: finalAmountPaisa / 100,
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
  if (transactionRef) payload.transactionRef = transactionRef;
  return payload;
}

export function buildCamPaymentPayload({
  tenantId,
  amountPaisa,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod,
  paymentStatus,
  note,
  transactionRef,
  adminId,
  bankAccountId,
  receivedBy,
  camId,
  allocations,
}) {
  const finalAmountPaisa =
    amountPaisa !== undefined ? amountPaisa : rupeesToPaisa(amount || 0); // FIX

  const payload = {
    tenant: tenantId,
    amountPaisa: finalAmountPaisa,
    amount: finalAmountPaisa / 100,
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
  if (transactionRef) payload.transactionRef = transactionRef;
  return payload;
}

export function buildExternalPaymentPayload({
  payerName,
  amountPaisa,
  amount,
  paymentDate,
  nepaliDate,
  paymentMethod = "bank_transfer",
  paymentStatus = "paid",
  bankAccountId,
  note,
  adminId,
}) {
  const finalAmountPaisa =
    amountPaisa !== undefined ? amountPaisa : rupeesToPaisa(amount || 0); // FIX

  const payload = {
    payerName,
    amountPaisa: finalAmountPaisa,
    amount: finalAmountPaisa / 100,
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

// ─────────────────────────────────────────────────────────────────────────────
// MERGE
// ─────────────────────────────────────────────────────────────────────────────

export function mergePaymentPayloads(rentPayload, camPayload) {
  if (rentPayload && camPayload) {
    const rentAmountPaisa =
      rentPayload.amountPaisa !== undefined
        ? rentPayload.amountPaisa
        : rupeesToPaisa(rentPayload.amount || 0);

    const camAmountPaisa =
      camPayload.amountPaisa !== undefined
        ? camPayload.amountPaisa
        : rupeesToPaisa(camPayload.amount || 0);

    const totalAmountPaisa = rentAmountPaisa + camAmountPaisa;

    return {
      tenant: rentPayload.tenant || camPayload.tenant,
      amountPaisa: totalAmountPaisa,
      amount: totalAmountPaisa / 100,
      paymentDate: rentPayload.paymentDate || camPayload.paymentDate,
      nepaliDate: rentPayload.nepaliDate || camPayload.nepaliDate,
      paymentMethod: rentPayload.paymentMethod || camPayload.paymentMethod,
      paymentStatus:
        rentPayload.paymentStatus || camPayload.paymentStatus || "paid",
      note: rentPayload.note || camPayload.note,
      transactionRef:
        rentPayload.transactionRef || camPayload.transactionRef || null,
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
  if (rentPayload) return rentPayload;
  if (camPayload) return camPayload;
  throw new Error("At least one payload (rent or CAM) must be provided");
}

// ─────────────────────────────────────────────────────────────────────────────
// DB WRITE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export async function createPaymentRecord(paymentPayload, session) {
  const [payment] = await Payment.create([paymentPayload], { session });
  return payment;
}

export async function createExternalPaymentRecord(paymentPayload, session) {
  const [payment] = await ExternalPayment.create([paymentPayload], { session });
  return payment;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

/** Compute total paisa across all allocations (rent + CAM). */
export function calculateTotalAmountFromAllocations(allocations) {
  const rentPaisa =
    allocations?.rent?.amountPaisa !== undefined
      ? allocations.rent.amountPaisa
      : rupeesToPaisa(allocations?.rent?.amount || 0);

  const camPaisa =
    allocations?.cam?.paidAmountPaisa !== undefined
      ? allocations.cam.paidAmountPaisa
      : rupeesToPaisa(allocations?.cam?.paidAmount || 0);

  return rentPaisa + camPaisa;
}

/** Structural validation of allocations (shape, IDs, amounts). */
export function validatePaymentAllocations(allocations) {
  if (!allocations || (!allocations.rent && !allocations.cam)) {
    return {
      isValid: false,
      error: "At least one allocation (rent or CAM) is required",
    };
  }
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
    const p =
      allocations.rent.amountPaisa !== undefined
        ? allocations.rent.amountPaisa
        : rupeesToPaisa(allocations.rent.amount || 0);
    if (!p || p <= 0) {
      return { isValid: false, error: "Rent amount must be greater than 0" };
    }
  }
  const camV = validateCamAllocation(allocations.cam);
  if (!camV.isValid) return camV;
  return { isValid: true };
}

export function validateCamAllocation(camAllocation) {
  if (!camAllocation) return { isValid: true };
  if (!camAllocation.camId) {
    return {
      isValid: false,
      error: "CAM ID is required when CAM allocation is provided",
    };
  }
  if (!mongoose.Types.ObjectId.isValid(camAllocation.camId)) {
    return { isValid: false, error: "Invalid CAM ID format" };
  }
  const p =
    camAllocation.paidAmountPaisa !== undefined
      ? camAllocation.paidAmountPaisa
      : rupeesToPaisa(camAllocation.paidAmount || 0);
  if (!p || p <= 0) {
    return { isValid: false, error: "CAM paidAmount must be greater than 0" };
  }
  return { isValid: true };
}

export function getPaymentType(allocations) {
  const rentPaisa =
    allocations?.rent?.amountPaisa !== undefined
      ? allocations.rent.amountPaisa
      : rupeesToPaisa(allocations?.rent?.amount || 0);
  const camPaisa =
    allocations?.cam?.paidAmountPaisa !== undefined
      ? allocations.cam.paidAmountPaisa
      : rupeesToPaisa(allocations?.cam?.paidAmount || 0);

  const hasRent = allocations?.rent?.rentId && rentPaisa > 0;
  const hasCam = allocations?.cam?.camId && camPaisa > 0;

  if (hasRent && hasCam) return "both";
  if (hasRent) return "rent_only";
  if (hasCam) return "cam_only";
  return "none";
}

export function prepareCamDataForReceipt(cam) {
  if (!cam) return null;

  const NEPALI_MONTHS = [
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
    NEPALI_MONTHS[cam.nepaliMonth - 1] || `Month ${cam.nepaliMonth}`;
  const amountPaisa = cam.amountPaisa ?? rupeesToPaisa(cam.amount || 0);
  const paidAmountPaisa =
    cam.paidAmountPaisa ?? rupeesToPaisa(cam.paidAmount || 0);

  return {
    paidFor: `${monthName} ${cam.nepaliYear}`,
    monthName,
    nepaliMonth: cam.nepaliMonth,
    nepaliYear: cam.nepaliYear,
    amountPaisa,
    amount: amountPaisa / 100,
    paidAmountPaisa,
    paidAmount: paidAmountPaisa / 100,
    status: cam.status,
  };
}
