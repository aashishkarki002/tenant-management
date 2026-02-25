/**
 * payment.controller.js  (FIXED)
 *
 * FIX — payRentAndCam: added bankAccountCode to the destructured body fields
 *   and threaded it into paymentData so createPayment() passes it to the
 *   journal builders (buildPaymentReceivedJournal / buildCamPaymentReceivedJournal).
 *
 *   bankAccountCode is the chart-of-accounts code of the BankAccount document
 *   (e.g. "1010-NABIL"). It is REQUIRED for bank_transfer and cheque payments.
 *   For cash payments it is ignored.
 *
 * All other controllers are unchanged.
 */

import {
  createPayment,
  sendPaymentReceiptEmail,
  logPaymentActivity,
  getPaymentActivities,
} from "./payment.service.js";
import { Rent } from "../rents/rent.Model.js";
import { Payment } from "./payment.model.js";
import { getFilteredPaymentHistoryService } from "./payment.service.js";
import parsePaginationParams from "../../helper/paginator.js";
import { getDashboardStatsData } from "../dashboards/dashboard.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// PAY RENT + CAM
// ─────────────────────────────────────────────────────────────────────────────

export async function payRentAndCam(req, res) {
  try {
    const {
      rentId,
      camId,
      tenantId,
      amount,
      paymentDate,
      nepaliDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
      bankAccountId: bodyBankAccountId,
      bankAccount: bodyBankAccount,
      bankAccountCode, // FIX: added — required for bank_transfer / cheque
      transactionRef,
      allocations,
      allocationStrategy,
    } = req.body;
    console.log("bankAccountCode", bankAccountCode);

    // Support both bankAccountId and bankAccount field names
    const bankAccountId = bodyBankAccountId || bodyBankAccount;

    // Build allocations — backward-compat with old flat format
    let paymentAllocations = allocations;
    if (!paymentAllocations) {
      paymentAllocations = {};
      if (rentId && amount) paymentAllocations.rent = { rentId, amount };
      if (camId && amount)
        paymentAllocations.cam = { camId, paidAmount: amount };
    }
    console.log("paymentAllocations", paymentAllocations);
    const paymentData = {
      adminId: req.admin.id,
      tenantId,
      amount,
      paymentDate,
      nepaliDate,
      paymentMethod,
      paymentStatus: paymentStatus || "paid",
      note: note || "",
      receivedBy,
      bankAccountId,
      bankAccountCode, // FIX: now passed through to createPayment() → journal builders
      transactionRef: transactionRef || undefined,
      allocations: paymentAllocations,
      allocationStrategy,
    };

    const result = await createPayment(paymentData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.error || "Failed to record payment",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Payment recorded successfully",
      data: result,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to record payment",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARIES & DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────

export async function getRentSummary(req, res) {
  try {
    const summary = await Rent.aggregate([
      {
        $group: {
          _id: null,
          totalCollectedPaisa: { $sum: "$paidAmountPaisa" },
          totalDuePaisa: { $sum: "$rentAmountPaisa" },
          totalPendingPaisa: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$rentAmountPaisa", 0],
            },
          },
        },
      },
    ]);

    const s = summary[0] || {
      totalCollectedPaisa: 0,
      totalDuePaisa: 0,
      totalPendingPaisa: 0,
    };

    return res.json({
      success: true,
      message: "Rent summary fetched successfully",
      data: {
        totalCollectedPaisa: s.totalCollectedPaisa,
        totalDuePaisa: s.totalDuePaisa,
        totalPendingPaisa: s.totalPendingPaisa,
        totalCollected: s.totalCollectedPaisa / 100,
        totalDue: s.totalDuePaisa / 100,
        totalPending: s.totalPendingPaisa / 100,
      },
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to fetch rent summary",
    });
  }
}

export async function getDashboardStats(req, res) {
  try {
    const result = await getDashboardStatsData();
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch dashboard stats",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT EMAIL
// ─────────────────────────────────────────────────────────────────────────────

export async function sendReceiptEmail(req, res) {
  try {
    const { paymentId } = req.params;
    if (!paymentId)
      return res
        .status(400)
        .json({ success: false, message: "Payment ID is required" });

    const result = await sendPaymentReceiptEmail(paymentId);
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: { emailSentTo: result.emailSentTo },
      });
    }
    return res
      .status(400)
      .json({ success: false, message: result.message, error: result.error });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to send payment receipt email",
      error: err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const PAYMENT_POPULATE = [
  { path: "tenant", select: "name" },
  {
    path: "rent",
    populate: [
      { path: "tenant", select: "name" },
      { path: "property", select: "name" },
    ],
  },
  { path: "bankAccount", select: "accountNumber accountName bankName" },
];

export async function getAllPaymentHistory(req, res) {
  try {
    const { page, limit, skip } = parsePaginationParams(req);
    const [payments, total] = await Promise.all([
      Payment.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(PAYMENT_POPULATE),
      Payment.countDocuments(),
    ]);
    return res.json({
      success: true,
      message: "Payment history fetched successfully",
      data: payments,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get payment history",
    });
  }
}

export async function getPaymentHistoryByTenant(req, res) {
  try {
    const { tenantId } = req.params;
    if (!tenantId)
      return res
        .status(400)
        .json({ success: false, message: "Tenant ID is required" });

    const { page, limit, skip } = parsePaginationParams(req);
    const [payments, total] = await Promise.all([
      Payment.find({ tenant: tenantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(PAYMENT_POPULATE),
      Payment.countDocuments({ tenant: tenantId }),
    ]);
    return res.json({
      success: true,
      message: "Tenant payment history fetched successfully",
      data: payments,
      pagination: {
        page,
        limit,
        totalRecords: total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get tenant payment history",
    });
  }
}

export async function getFilteredPaymentHistory(req, res) {
  try {
    const { tenantId, startDate, endDate, paymentMethod } = req.query;
    const result = await getFilteredPaymentHistoryService(
      tenantId,
      startDate,
      endDate,
      paymentMethod,
    );
    if (result.success) {
      return res.json({
        success: true,
        message: "Filtered payment history fetched successfully",
        data: result.data,
      });
    }
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to fetch filtered payment history",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get filtered payment history",
    });
  }
}

export async function getPaymentById(req, res) {
  try {
    const { paymentId } = req.params;
    if (!paymentId)
      return res
        .status(400)
        .json({ success: false, message: "Payment ID is required" });
    const payment = await Payment.findById(paymentId)
      .populate("tenant", "name")
      .populate("createdBy", "name")
      .populate(PAYMENT_POPULATE);
    return res.json({
      success: true,
      message: "Payment fetched successfully",
      data: payment,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get payment by id",
    });
  }
}

export async function getPaymentByRentId(req, res) {
  try {
    const { rentId } = req.params;
    if (!rentId)
      return res
        .status(400)
        .json({ success: false, message: "Rent ID is required" });
    const payments = await Payment.find({ rent: rentId }).populate(
      PAYMENT_POPULATE,
    );
    return res.json({
      success: true,
      message: "Payments for rent fetched successfully",
      data: payments,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get payments by rent id",
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────

export async function logActivity(req, res) {
  try {
    const { paymentId } = req.params;
    const { activityType, metadata } = req.body;
    const adminId = req.admin?.id || null;

    if (!paymentId || !activityType) {
      return res.status(400).json({
        success: false,
        message: "Payment ID and activity type are required",
      });
    }
    const payment = await Payment.findById(paymentId);
    if (!payment)
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });

    const result = await logPaymentActivity(
      paymentId,
      activityType,
      adminId,
      metadata || {},
    );
    if (result.success)
      return res.json({
        success: true,
        message: "Activity logged successfully",
        data: result.data,
      });
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to log activity",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to log payment activity",
    });
  }
}

export async function getActivities(req, res) {
  try {
    const { paymentId } = req.params;
    if (!paymentId)
      return res
        .status(400)
        .json({ success: false, message: "Payment ID is required" });

    const result = await getPaymentActivities(paymentId);
    if (result.success)
      return res.json({
        success: true,
        message: "Payment activities fetched successfully",
        data: result.data,
      });
    return res.status(400).json({
      success: false,
      message: result.error || "Failed to fetch payment activities",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to get payment activities",
    });
  }
}
