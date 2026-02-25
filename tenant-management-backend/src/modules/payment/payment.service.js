import mongoose from "mongoose";
import { Rent } from "../rents/rent.Model.js";
import { Payment } from "./payment.model.js";
import { Cam } from "../cam/cam.model.js";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import { generatePDFToBuffer } from "../../utils/rentGenrator.js";
import { sendEmail } from "../../config/nodemailer.js";
import { applyPaymentToCam } from "../cam/cam.domain.js";
import buildFilter from "../../utils/buildFilter.js";
import {
  buildRentPaymentPayload,
  buildCamPaymentPayload,
  mergePaymentPayloads,
  createPaymentRecord,
  calculateTotalAmountFromAllocations,
  validatePaymentAllocations,
} from "./payment.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildPaymentReceivedJournal,
  buildCamPaymentReceivedJournal,
} from "../ledger/journal-builders/index.js";
import {
  recordRentRevenue,
  recordCamRevenue,
} from "../revenue/revenue.service.js";
import { emitPaymentNotification } from "../../utils/payment.Notification.js";
import { handleReceiptSideEffects } from "../../reciepts/reciept.service.js";
import {
  rupeesToPaisa,
  formatMoney,
  formatMoneySafe,
} from "../../utils/moneyUtil.js";
import {
  getAllocationStrategy,
  calculateUnitPaymentSummary,
} from "./helpers/payment.allocation.helper.js";
import {
  validatePaymentNotExceeding,
  validateCamPaymentNotExceeding,
  validatePaisaIntegrity,
} from "./helpers/payment-validation.helper.js";
import {
  applyPaymentToRent as applyPaymentToRentHelper,
  updateRentStatus,
  calculateRentRemaining,
  getUnitPaymentDetails,
} from "./helpers/rent-payment.helper.js";

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PAYMENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Record a rent/CAM payment atomically.
 *
 * @param {Object} paymentData
 * @param {string} paymentData.bankAccountCode  chart-of-accounts code for the
 *                                              bank account (e.g. "1010-NABIL").
 *                                              Required for bank_transfer / cheque.
 *                                              Used by journal builders to route
 *                                              to the correct ledger account.
 */
export async function createPayment(paymentData) {
  console.log(
    "createPayment RAW INPUT:",
    JSON.stringify(
      {
        paymentMethod: paymentData.paymentMethod,
        bankAccountId: paymentData.bankAccountId,
        bankAccountCode: paymentData.bankAccountCode,
        allocations: paymentData.allocations,
      },
      null,
      2,
    ),
  );
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      allocations,
      allocationStrategy = "proportional",
      bankAccountCode, // FIX: now accepted and threaded through to journal builders
      ...rest
    } = paymentData;

    // ── Step 1: Convert amounts to paisa (never trust client-sent amountPaisa as-is) ──
    // Ensure we always derive paisa from rupees when amount is provided, so a mistaken
    // bankAccountCode in amountPaisa never flows through.
    if (allocations?.rent) {
      const rentAmountRupees =
        typeof allocations.rent.amount === "number" &&
        Number.isFinite(allocations.rent.amount)
          ? allocations.rent.amount
          : null;
      if (rentAmountRupees != null && rentAmountRupees > 0) {
        allocations.rent.amountPaisa = rupeesToPaisa(rentAmountRupees);
      }
      const rentPaisa = allocations.rent.amountPaisa;
      if (
        typeof rentPaisa !== "number" ||
        !Number.isInteger(rentPaisa) ||
        rentPaisa < 0
      ) {
        throw new Error(
          "Rent amount must be a positive number (rupees in amount, or integer paisa in amountPaisa). Do not pass bank account code as amount.",
        );
      }
    }
    if (allocations?.cam?.paidAmount != null) {
      const camAmount =
        typeof allocations.cam.paidAmount === "number" &&
        Number.isFinite(allocations.cam.paidAmount)
          ? allocations.cam.paidAmount
          : 0;
      allocations.cam.paidAmountPaisa =
        camAmount > 0 ? rupeesToPaisa(camAmount) : 0;
    }
    if (allocations?.rent?.unitAllocations) {
      allocations.rent.unitAllocations = allocations.rent.unitAllocations.map(
        (ua) => ({
          unitId: ua.unitId,
          amountPaisa:
            typeof ua.amountPaisa === "number" &&
            Number.isInteger(ua.amountPaisa)
              ? ua.amountPaisa
              : rupeesToPaisa(ua.amount || 0),
        }),
      );
    }

    // ── Step 2: Validate allocation structure ─────────────────────────────────
    const validation = validatePaymentAllocations(allocations);
    console.log("validation", validation);
    if (!validation.isValid) throw new Error(validation.error);

    let cam = null;
    let rent = null;
    let unitAllocationsResult = null;

    // ── Step 3: Handle rent payment ───────────────────────────────────────────
    if (allocations?.rent?.rentId) {
      rent = await Rent.findById(allocations.rent.rentId)
        .populate("tenant")
        .populate("property")
        .populate("units")
        .populate({ path: "unitBreakdown.unit", select: "name" })
        .session(session);

      if (!rent) throw new Error("Rent not found");

      const rentAmountPaisa =
        allocations.rent.amountPaisa ??
        rupeesToPaisa(allocations.rent.amount || 0);
      console.log("rentAmountPaisa", rentAmountPaisa);

      validatePaisaIntegrity({ rentAmountPaisa }, ["rentAmountPaisa"]);

      if (rent.useUnitBreakdown && rent.unitBreakdown?.length > 0) {
        let unitAllocations = allocations.rent.unitAllocations;

        if (!unitAllocations || unitAllocations.length === 0) {
          const strategyFn = getAllocationStrategy(allocationStrategy);
          unitAllocations = strategyFn(rent.unitBreakdown, rentAmountPaisa);
        }
        console.log("unitAllocations", unitAllocations);
        validatePaymentNotExceeding(rent, rentAmountPaisa, unitAllocations);
        console.log("validatePaymentNotExceeding", validatePaymentNotExceeding);

        unitAllocationsResult = applyPaymentToRentHelper(
          rent,
          rentAmountPaisa,
          unitAllocations,
          paymentData.paymentDate,
          paymentData.receivedBy,
          allocationStrategy,
        );

        rent.markModified("unitBreakdown");
        allocations.rent.unitAllocations =
          unitAllocationsResult || unitAllocations;
      } else {
        const remainingPaisa = calculateRentRemaining(rent);

        if (rentAmountPaisa > remainingPaisa) {
          throw new Error(
            `Payment ${formatMoneySafe(rentAmountPaisa)} exceeds remaining balance ${formatMoneySafe(remainingPaisa)}`,
          );
        }
        rent.paidAmountPaisa = (rent.paidAmountPaisa || 0) + rentAmountPaisa;
        rent.lastPaidDate = paymentData.paymentDate;
        rent.lastPaidBy = paymentData.receivedBy;
      }

      updateRentStatus(rent);
      await rent.save({ session });
    }

    // ── Step 4: Handle CAM payment ────────────────────────────────────────────
    if (allocations?.cam?.camId) {
      cam = await Cam.findById(allocations.cam.camId)
        .populate("tenant")
        .populate("property")
        .session(session);

      if (!cam) throw new Error("CAM not found");

      const camAmountPaisa =
        allocations.cam.paidAmountPaisa ??
        rupeesToPaisa(allocations.cam.paidAmount || 0);

      validatePaisaIntegrity({ camAmountPaisa }, ["camAmountPaisa"]);
      validateCamPaymentNotExceeding(cam, camAmountPaisa);
      applyPaymentToCam(
        cam,
        camAmountPaisa,
        paymentData.paymentDate,
        paymentData.receivedBy,
      );
      await cam.save({ session });
    }

    // ── Step 5: Update bank account balance ───────────────────────────────────
    const totalAmountPaisa = calculateTotalAmountFromAllocations(allocations);
    console.log("totalAmountPaisa", totalAmountPaisa);
    await applyPaymentToBank({
      paymentMethod: paymentData.paymentMethod,
      bankAccountId: paymentData.bankAccountId,
      amountPaisa: totalAmountPaisa,
      session,
    });

    // ── Step 6: Create payment record ─────────────────────────────────────────
    // AFTER — only pass amountPaisa (already validated integer from Step 1), never amount
    const rentPayload = rent
      ? buildRentPaymentPayload({
          tenantId: paymentData.tenantId,
          amountPaisa: allocations.rent.amountPaisa, // guaranteed integer from Step 1
          // amount intentionally omitted — prevents fallback path in builder
          paymentDate: paymentData.paymentDate,
          nepaliDate: paymentData.nepaliDate,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentData.paymentStatus,
          receivedBy: paymentData.receivedBy,
          note: paymentData.note,
          transactionRef: paymentData.transactionRef,
          adminId: paymentData.adminId,
          bankAccountId: paymentData.bankAccountId,
          rentId: rent._id,
          allocations: { rent: allocations.rent },
        })
      : null;

    const camPayload = cam
      ? buildCamPaymentPayload({
          tenantId: paymentData.tenantId,
          amountPaisa: allocations.cam.paidAmountPaisa, // guaranteed integer from Step 1
          // amount intentionally omitted — prevents fallback path in builder
          paymentDate: paymentData.paymentDate,
          nepaliDate: paymentData.nepaliDate,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentData.paymentStatus,
          receivedBy: paymentData.receivedBy,
          note: paymentData.note,
          transactionRef: paymentData.transactionRef,
          adminId: paymentData.adminId,
          bankAccountId: paymentData.bankAccountId,
          camId: cam._id,
          allocations: { cam: allocations.cam },
        })
      : null;

    const payload = mergePaymentPayloads(rentPayload, camPayload);
    const payment = await createPaymentRecord(payload, session);

    // ── Step 7: Ledger entries ────────────────────────────────────────────────
    // FIX: 3rd argument is bankAccountCode (string), not rentAmountPaisa (number).
    // The amount is derived from payment.amountPaisa inside the builder.
    if (rent) {
      const rentJournalPayload = buildPaymentReceivedJournal(
        payment,
        rent,
        bankAccountCode, // FIX: was "allocations.rent.amountPaisa"
      );
      await ledgerService.postJournalEntry(rentJournalPayload, session);
    }

    if (cam) {
      const camJournalPayload = buildCamPaymentReceivedJournal(
        payment,
        cam,
        bankAccountCode, // FIX: was "allocations.cam.paidAmountPaisa"
      );
      await ledgerService.postJournalEntry(camJournalPayload, session);
    }

    // ── Step 8: Revenue recording ─────────────────────────────────────────────
    if (rent) {
      await recordRentRevenue({
        amountPaisa: allocations.rent.amountPaisa,
        paymentDate: payment.paymentDate,
        tenantId: paymentData.tenantId,
        rentId: rent._id,
        note: payment.note,
        adminId: payment.createdBy,
        session,
      });
    }
    if (cam) {
      await recordCamRevenue({
        amountPaisa: allocations.cam.paidAmountPaisa,
        paymentDate: payment.paymentDate,
        tenantId: paymentData.tenantId,
        camId: cam._id,
        note: payment.note,
        adminId: payment.createdBy,
        session,
      });
    }

    // ── Step 9: Commit ────────────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    // ── Step 10: Async side effects (non-blocking, after commit) ─────────────
    emitPaymentNotification(
      {
        paymentId: payment._id,
        tenantId: payment.tenant,
        amountPaisa: payment.amountPaisa,
        paymentDate: payment.paymentDate,
        paymentMethod: payment.paymentMethod,
        paymentStatus: payment.paymentStatus,
        note: payment.note,
        receivedBy: payment.receivedBy,
        bankAccountId: payment.bankAccount,
      },
      paymentData.adminId,
    ).catch(console.error);

    handleReceiptSideEffects({
      payment,
      rentId: rent?._id?.toString() || payment.rent?.toString() || null,
      camId: cam?._id?.toString() || payment.cam?.toString() || null,
    }).catch(console.error);

    // ── Return ────────────────────────────────────────────────────────────────
    return {
      success: true,
      payment: {
        id: payment._id,
        amountPaisa: payment.amountPaisa,
        amount: payment.amountPaisa / 100,
        status: payment.paymentStatus,
      },
      rent: rent
        ? {
            id: rent._id,
            status: rent.status,
            paidAmountPaisa: rent.paidAmountPaisa,
            remainingPaisa: calculateRentRemaining(rent),
            useUnitBreakdown: rent.useUnitBreakdown,
            unitDetails: rent.useUnitBreakdown
              ? getUnitPaymentDetails(rent)
              : null,
          }
        : null,
      cam: cam ? { id: cam._id, status: cam.status } : null,
      message: "Payment recorded successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return {
      success: false,
      error: error.message,
      message: "Payment recording failed",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT EMAIL
// ─────────────────────────────────────────────────────────────────────────────

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

export const sendPaymentReceiptEmail = async (paymentId) => {
  try {
    const payment = await Payment.findById(paymentId)
      .populate("tenant")
      .populate("rent")
      .populate("cam")
      .populate("bankAccount");

    if (!payment) throw new Error("Payment not found");
    if (!payment.tenant?.email) throw new Error("Tenant email not found");

    let rent = null;
    if (payment.rent) {
      rent = await Rent.findById(payment.rent)
        .populate("tenant")
        .populate("property")
        .populate("units")
        .populate({ path: "unitBreakdown.unit", select: "name" });
    }
    const cam = payment.cam ? await Cam.findById(payment.cam) : null;

    let paidFor = "";
    if (rent) {
      const monthName =
        NEPALI_MONTHS[rent.nepaliMonth - 1] || `Month ${rent.nepaliMonth}`;
      paidFor = `${monthName} ${rent.nepaliYear}`;
    }
    if (cam) {
      const camMonth =
        NEPALI_MONTHS[cam.nepaliMonth - 1] || `Month ${cam.nepaliMonth}`;
      paidFor = paidFor
        ? `${paidFor} & ${camMonth} ${cam.nepaliYear} (CAM)`
        : `${camMonth} ${cam.nepaliYear} (CAM)`;
    }

    const formattedDate = new Date(payment.paymentDate).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      },
    );

    const rentAmountPaisa =
      payment.allocations?.rent?.amountPaisa ??
      rupeesToPaisa(payment.allocations?.rent?.amount || 0);
    const camAmountPaisa =
      payment.allocations?.cam?.paidAmountPaisa ??
      rupeesToPaisa(payment.allocations?.cam?.paidAmount || 0);

    const pdfData = {
      receiptNo: payment._id.toString(),
      amount: payment.amountPaisa / 100,
      paymentDate: formattedDate,
      tenantName: rent?.tenant?.name || payment.tenant?.name || "N/A",
      property: rent?.property?.name || "N/A",
      paidFor,
      paymentMethod:
        { cheque: "Cheque", cash: "Cash" }[payment.paymentMethod] ??
        "Bank Transfer",
      receivedBy: rent?.lastPaidBy || "",
      rentAmount: rentAmountPaisa / 100,
      camAmount: camAmountPaisa / 100,
      unitBreakdown: null,
    };

    if (
      rent?.useUnitBreakdown &&
      payment.allocations?.rent?.unitAllocations?.length > 0
    ) {
      pdfData.unitBreakdown = payment.allocations.rent.unitAllocations.map(
        (ua) => {
          const uaId =
            (ua.unitId?._id ?? ua.unitId)?.toString?.() ?? String(ua.unitId);
          const unit = rent.unitBreakdown.find((ub) => {
            const ubId = ub.unit?._id
              ? ub.unit._id.toString()
              : ub.unit?.toString?.();
            return ubId === uaId;
          });
          return {
            unitName: unit?.unit?.name || "Unknown Unit",
            amountPaisa: ua.amountPaisa,
            amount: ua.amountPaisa / 100,
          };
        },
      );
    }

    const pdfBuffer = await generatePDFToBuffer(pdfData);

    const unitBreakdownHtml =
      pdfData.unitBreakdown?.length > 0
        ? `<p style="color:#555555;font-size:14px;line-height:1.5;margin-top:10px;">
           <strong>Unit Breakdown:</strong><br>
           ${pdfData.unitBreakdown.map((ub) => `${ub.unitName}: ${formatMoneySafe(ub.amountPaisa)}`).join("<br>")}
         </p>`
        : "";

    const tenantName = payment.tenant?.name || "Tenant";
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Payment Receipt</title></head>
<body style="font-family:Arial,sans-serif;background-color:#f9f9f9;margin:0;padding:0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:20px auto;background-color:#ffffff;border:1px solid #e0e0e0;border-radius:8px;">
<tr><td style="padding:20px;">
  <h2 style="color:#333333;">Hello ${tenantName},</h2>
  <p style="color:#555555;font-size:16px;line-height:1.5;">
    Thank you for your payment of <strong>${formatMoneySafe(payment.amountPaisa)}</strong> for <strong>${paidFor}</strong>.
  </p>
  <p style="color:#555555;font-size:14px;line-height:1.5;margin-top:20px;">
    <strong>Receipt Details:</strong><br>
    Receipt No: ${payment._id.toString()}<br>
    ${rentAmountPaisa > 0 ? `Rent: ${formatMoneySafe(rentAmountPaisa)}<br>` : ""}
    ${camAmountPaisa > 0 ? `CAM: ${formatMoneySafe(camAmountPaisa)}<br>` : ""}
    Total: ${formatMoneySafe(payment.amountPaisa)}<br>
    Date: ${formattedDate}<br>
    Method: ${pdfData.paymentMethod}
  </p>
  ${unitBreakdownHtml}
  <p style="color:#555555;font-size:16px;margin-top:30px;">
    Thank you,<br><strong>Management Team</strong>
  </p>
  <hr style="border:none;border-top:1px solid #e0e0e0;margin:20px 0;">
  <p style="color:#999999;font-size:12px;text-align:center;">Automated receipt. Please do not reply.</p>
</td></tr>
</table></body></html>`;

    await sendEmail({
      to: payment.tenant.email,
      subject: "Payment Receipt - Rent and CAM Payment Confirmation",
      html,
      attachments: [
        {
          filename: `receipt-${payment._id}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return {
      success: true,
      message: "Payment receipt email sent successfully",
      emailSentTo: payment.tenant.email,
    };
  } catch (error) {
    return {
      success: false,
      message: "Failed to send payment receipt email",
      error: error.message,
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY / ACTIVITY (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export const getFilteredPaymentHistoryService = async (
  tenantId,
  startDate,
  endDate,
  paymentMethod,
) => {
  try {
    const filter = buildFilter({
      tenantId,
      startDate,
      endDate,
      paymentMethod,
      dateField: "paymentDate",
    });
    const payments = await Payment.find(filter).sort({ paymentDate: -1 });
    return { success: true, data: payments };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const logPaymentActivity = async (
  paymentId,
  activityType,
  adminId = null,
  metadata = {},
) => {
  try {
    const { PaymentActivity } = await import("./paymentActivity.model.js");
    const activity = await PaymentActivity.create({
      payment: paymentId,
      activityType,
      performedBy: adminId,
      metadata,
    });
    const allActivities = await PaymentActivity.find({ payment: paymentId })
      .sort({ createdAt: -1 })
      .select("_id")
      .lean();
    if (allActivities.length > 5) {
      await PaymentActivity.deleteMany({
        _id: { $in: allActivities.slice(5).map((a) => a._id) },
      });
    }
    return { success: true, data: activity };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export const getPaymentActivities = async (paymentId) => {
  try {
    const { PaymentActivity } = await import("./paymentActivity.model.js");
    const activities = await PaymentActivity.find({ payment: paymentId })
      .populate("performedBy", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    return { success: true, data: activities };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
