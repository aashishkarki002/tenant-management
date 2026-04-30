/**
 * vendor.service.js
 *
 * Business logic for the vendors module. Handles all DB operations and, for
 * payments, posts double-entry journal entries via the ledger service.
 *
 * Journal rules:
 *   outflow (service vendor — we pay them):
 *     DR  expenseAccountCode (from VendorContract)   amountPaisa
 *     CR  Cash/Bank                                  amountPaisa
 *
 *   inflow (stall vendor — they pay us):
 *     DR  Cash/Bank                                  amountPaisa
 *     CR  revenueAccountCode (from VendorContract)   amountPaisa
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import Vendor from "./vendor.model.js";
import VendorContract from "./vendorContract.model.js";
import AssignedPersonnel from "./assignedPersonnel.model.js";
import VendorPayment from "./vendorPayment.model.js";
import BankAccount from "../banks/BankAccountModel.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildVendorPaymentJournal } from "../ledger/journal-builders/vendorPayment.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the chart-of-accounts code for the cash/bank side of a payment.
 * Returns the bankAccount's accountCode if provided, otherwise null (cash).
 */
async function resolveBankAccountCode(bankAccountId, session) {
  if (!bankAccountId) return null;
  const doc = await BankAccount.findById(bankAccountId)
    .select("accountCode isDeleted")
    .session(session)
    .lean();
  if (!doc) throw new Error(`Bank account not found: ${bankAccountId}`);
  if (doc.isDeleted) throw new Error(`Bank account ${bankAccountId} has been deleted`);
  return doc.accountCode;
}

/**
 * Derive nepaliMonth and nepaliYear from a JS Date.
 */
function toNepaliMonthYear(date) {
  const nd = new NepaliDate(date instanceof Date ? date : new Date(date));
  const { npYear, npMonth } = getNepaliYearMonthFromDate(nd.getDateObject());
  return { nepaliMonth: npMonth, nepaliYear: npYear };
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createVendorService(data) {
  const { name, serviceType, phone, contactPerson, email, address, panNumber, vatRegistered, bankDetails, notes } = data;
  if (!name || !serviceType || !phone) {
    throw Object.assign(new Error("name, serviceType, and phone are required"), { statusCode: 400 });
  }
  return Vendor.create({ name, serviceType, phone, contactPerson, email, address, panNumber, vatRegistered, bankDetails, notes });
}

export async function getAllVendorsService({ serviceType, isActive } = {}) {
  const filter = {};
  if (serviceType) filter.serviceType = serviceType;
  if (isActive !== undefined) filter.isActive = isActive === "true" || isActive === true;
  return Vendor.find(filter).sort({ createdAt: -1 });
}

export async function getVendorByIdService(id) {
  const vendor = await Vendor.findById(id);
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });
  const contracts = await VendorContract.find({ vendor: vendor._id, isActive: true }).populate("property", "name address");
  return { vendor, contracts };
}

export async function updateVendorService(id, data) {
  const vendor = await Vendor.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true });
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });
  return vendor;
}

export async function deleteVendorService(id) {
  const vendor = await Vendor.findByIdAndDelete(id);
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });
  return vendor;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createContractService(data) {
  const {
    vendorId, propertyId, contractType = "service", serviceType, description,
    billingCycle, contractAmountPaisa, startDate, endDate, autoRenew,
    expenseAccountCode, revenueAccountCode, stallDescription, eventName, leaseDays, notes,
  } = data;

  if (!vendorId || !propertyId || !contractAmountPaisa || !startDate) {
    throw Object.assign(
      new Error("vendorId, propertyId, contractAmountPaisa, startDate are required"),
      { statusCode: 400 },
    );
  }
  if (contractType === "service" && !expenseAccountCode) {
    throw Object.assign(new Error("expenseAccountCode is required for service contracts"), { statusCode: 400 });
  }
  if (contractType === "stall_lease" && !revenueAccountCode) {
    throw Object.assign(new Error("revenueAccountCode is required for stall_lease contracts"), { statusCode: 400 });
  }

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });

  return VendorContract.create({
    vendor: vendorId,
    property: propertyId,
    contractType,
    serviceType: serviceType || vendor.serviceType,
    description,
    billingCycle,
    contractAmountPaisa,
    startDate,
    endDate,
    autoRenew,
    expenseAccountCode: contractType === "service" ? expenseAccountCode : null,
    revenueAccountCode: contractType === "stall_lease" ? revenueAccountCode : null,
    stallDescription: contractType === "stall_lease" ? stallDescription : null,
    eventName: contractType === "stall_lease" ? eventName : null,
    leaseDays: contractType === "stall_lease" ? leaseDays : null,
    notes,
  });
}

export async function getContractsByVendorService(vendorId) {
  return VendorContract.find({ vendor: vendorId })
    .populate("property", "name address")
    .sort({ createdAt: -1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSIGNED PERSONNEL
// ─────────────────────────────────────────────────────────────────────────────

export async function assignPersonnelService(data) {
  const { vendorId, contractId, name, phone, idType, idNumber, shift, assignedFrom, notes } = data;
  if (!vendorId || !contractId || !name || !assignedFrom) {
    throw Object.assign(
      new Error("vendorId, contractId, name, and assignedFrom are required"),
      { statusCode: 400 },
    );
  }
  return AssignedPersonnel.create({ vendor: vendorId, contract: contractId, name, phone, idType, idNumber, shift, assignedFrom, notes });
}

export async function getPersonnelByContractService(contractId) {
  return AssignedPersonnel.find({ contract: contractId, isActive: true }).sort({ assignedFrom: -1 });
}

export async function updatePersonnelService(id, data) {
  const personnel = await AssignedPersonnel.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true });
  if (!personnel) throw Object.assign(new Error("Personnel not found"), { statusCode: 404 });
  return personnel;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE TYPE LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

export async function getVendorsByServiceTypeService(serviceType) {
  return Vendor.find({ serviceType, isActive: true }).sort({ name: 1 }).lean();
}

// ─────────────────────────────────────────────────────────────────────────────
// VENDOR PAYMENTS — with ledger integration
// ─────────────────────────────────────────────────────────────────────────────

export async function recordVendorPaymentService(vendorId, data, adminId) {
  const {
    contractId, amountPaisa, paymentDate, nepaliDate, paymentMethod,
    bankAccountId, referenceNumber, tdsDeductedPaisa, notes,
    paymentDirection = "outflow", entityId: entityIdFromBody,
  } = data;

  if (!amountPaisa || !paymentDate || !paymentMethod) {
    throw Object.assign(
      new Error("amountPaisa, paymentDate, and paymentMethod are required"),
      { statusCode: 400 },
    );
  }
  if ((paymentMethod === "bank_transfer" || paymentMethod === "cheque") && !bankAccountId) {
    throw Object.assign(
      new Error("bankAccountId is required for bank_transfer or cheque payments"),
      { statusCode: 400 },
    );
  }

  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });

  if (!entityIdFromBody) {
    throw Object.assign(
      new Error("entityId is required in the request body for journal entry posting"),
      { statusCode: 400 },
    );
  }
  const resolvedEntityId = entityIdFromBody;

  // Resolve account codes from contract
  let contract = null;
  let expenseAccountCode = null;
  let revenueAccountCode = null;

  if (contractId) {
    contract = await VendorContract.findById(contractId);
    if (contract) {
      expenseAccountCode = contract.expenseAccountCode;
      revenueAccountCode = contract.revenueAccountCode;
    }
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentDateObj = new Date(paymentDate);
    const { nepaliMonth, nepaliYear } = toNepaliMonthYear(paymentDateObj);

    // 1. Persist VendorPayment
    const [payment] = await VendorPayment.create(
      [
        {
          vendor: vendorId,
          contract: contractId || null,
          amountPaisa,
          paymentDirection: paymentDirection === "inflow" ? "inflow" : "outflow",
          paymentDate: paymentDateObj,
          nepaliDate: nepaliDate || null,
          paymentMethod,
          bankAccount: bankAccountId || null,
          referenceNumber: referenceNumber || null,
          tdsDeductedPaisa: tdsDeductedPaisa || 0,
          notes: notes || null,
          recordedBy: adminId,
        },
      ],
      { session },
    );

    // 2. Resolve bank account code for journal
    const bankAccountCode = await resolveBankAccountCode(bankAccountId, session);

    // 3. Build journal payload
    const journalPayment = {
      ...payment.toObject(),
      nepaliMonth,
      nepaliYear,
      nepaliDate: nepaliDate || null,
      paymentDate: paymentDateObj,
    };

    const journalPayload = buildVendorPaymentJournal(
      journalPayment,
      bankAccountCode,
      expenseAccountCode,
      revenueAccountCode,
      vendor.name,
    );

    // 4. Post to ledger
    await ledgerService.postJournalEntry(journalPayload, session, resolvedEntityId);

    await session.commitTransaction();

    await payment.populate([
      { path: "contract", select: "description billingCycle contractAmountPaisa" },
      { path: "bankAccount", select: "bankName accountNumber" },
      { path: "recordedBy", select: "name email" },
    ]);

    return payment;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function getVendorPaymentsService(vendorId, { from, to, contractId } = {}) {
  const filter = { vendor: vendorId };
  if (contractId) filter.contract = contractId;
  if (from || to) {
    filter.paymentDate = {};
    if (from) filter.paymentDate.$gte = new Date(from);
    if (to) filter.paymentDate.$lte = new Date(to);
  }
  return VendorPayment.find(filter)
    .populate("contract", "description billingCycle")
    .populate("bankAccount", "bankName accountNumber")
    .populate("recordedBy", "name email")
    .sort({ paymentDate: -1 });
}

export async function getVendorBalanceService(vendorId) {
  const vendor = await Vendor.findById(vendorId);
  if (!vendor) throw Object.assign(new Error("Vendor not found"), { statusCode: 404 });

  const [contractAgg, paymentAgg] = await Promise.all([
    VendorContract.aggregate([
      { $match: { vendor: vendor._id, isActive: true } },
      { $group: { _id: "$contractType", total: { $sum: "$contractAmountPaisa" } } },
    ]),
    VendorPayment.aggregate([
      { $match: { vendor: vendor._id } },
      {
        $group: {
          _id: "$paymentDirection",
          total: { $sum: "$amountPaisa" },
          totalTds: { $sum: "$tdsDeductedPaisa" },
        },
      },
    ]),
  ]);

  const serviceContractPaisa = contractAgg.find((r) => r._id === "service")?.total ?? 0;
  const stallLeaseContractPaisa = contractAgg.find((r) => r._id === "stall_lease")?.total ?? 0;
  const totalOutflowPaisa = paymentAgg.find((r) => r._id === "outflow")?.total ?? 0;
  const totalInflowPaisa = paymentAgg.find((r) => r._id === "inflow")?.total ?? 0;
  const totalTdsDeductedPaisa = paymentAgg.find((r) => r._id === "outflow")?.totalTds ?? 0;

  return {
    serviceContractPaisa,
    totalOutflowPaisa,
    expenseOutstandingPaisa: serviceContractPaisa - totalOutflowPaisa,
    totalTdsDeductedPaisa,
    stallLeaseContractPaisa,
    totalInflowPaisa,
    revenueOutstandingPaisa: stallLeaseContractPaisa - totalInflowPaisa,
  };
}
