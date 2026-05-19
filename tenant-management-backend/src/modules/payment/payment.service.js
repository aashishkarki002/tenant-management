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
  buildLateFeePaymentPayload,
  mergePaymentPayloads,
  createPaymentRecord,
  calculateTotalAmountFromAllocations,
  validatePaymentAllocations,
} from "./payment.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import {
  buildPaymentReceivedJournal,
  buildCamPaymentReceivedJournal,
  buildLateFeePaymentJournal,
} from "../ledger/journal-builders/index.js";
import {
  recordRentRevenue,
  recordCamRevenue,
  recordLateFeeRevenue,
} from "../revenue/revenue.service.js";
import { emitPaymentNotification } from "../../utils/payment.Notification.js";
import { smsTenant } from "../../config/nestsms.templates.js";
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
import { resolveEntityFromBlock } from "../../helper/resolveEntity.js";
import { handleTdsDocumentUpload } from "../rents/rent.tds.service.js";
import { syncTenantBalance } from "../tenantBalance/tenantBalance.service.js";
import { electricityService } from "../electricity/electricity.service.js";
import { createChequeDraft } from "../chequeDrafts/chequeDraft.service.js";
import { ACCOUNT_CODES } from "../ledger/config/accounts.js";
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      allocations,
      allocationStrategy = "proportional",
      bankAccountCode,
      ...rest
    } = paymentData;

    // ── Step 1: Convert amounts to paisa ──────────────────────────────────────
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
    // FIX: normalise late fee paisa in Step 1 alongside rent/CAM
    if (allocations?.lateFee) {
      if (
        allocations.lateFee.amount != null &&
        allocations.lateFee.amountPaisa == null
      ) {
        allocations.lateFee.amountPaisa = rupeesToPaisa(
          allocations.lateFee.amount || 0,
        );
      }
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

        validatePaymentNotExceeding(rent, rentAmountPaisa, unitAllocations);

        unitAllocationsResult = applyPaymentToRentHelper(
          rent,
          rentAmountPaisa,
          paymentData.paymentDate,
          paymentData.receivedBy,
          allocationStrategy,
        );
        unitAllocations.forEach(({ unitId, amountPaisa: unitAmt }) => {
          const ub = rent.unitBreakdown.find((u) =>
            u.unit._id
              ? u.unit._id.toString() === unitId.toString()
              : u.unit.toString() === unitId.toString(),
          );
          if (ub) {
            ub.paidAmountPaisa = (ub.paidAmountPaisa || 0) + unitAmt;
            ub.status =
              ub.paidAmountPaisa >=
                ub.grossRentAmountPaisa - (ub.tdsAmountPaisa || 0)
                ? "paid"
                : "partially_paid";
          }
        });

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
      if (allocations?.lateFee?.rentId) {
        const lateFeePaisa =
          allocations.lateFee.amountPaisa != null
            ? allocations.lateFee.amountPaisa
            : rupeesToPaisa(allocations.lateFee.amount || 0);
        if (!rent.lateFeeApplied || !rent.lateFeePaisa) {
          throw new Error(
            "Cannot pay late fee: no late fee has been charged on this rent",
          );
        }

        if (lateFeePaisa > 0) {
          const remainingLateFee =
            (rent.lateFeePaisa || 0) - (rent.latePaidAmountPaisa || 0);

          if (lateFeePaisa > remainingLateFee) {
            throw new Error(
              `Late fee payment ${formatMoneySafe(lateFeePaisa)} exceeds remaining late fee ${formatMoneySafe(remainingLateFee)}`,
            );
          }

          rent.applyLateFeePayment(
            lateFeePaisa,
            paymentData.paymentDate,
            paymentData.receivedBy,
          );

          allocations.lateFee.amountPaisa = lateFeePaisa;
        }
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

    // ── Step 4.5: Handle electricity payments ────────────────────────────────
    // Electricity records are updated within this transaction; bank balance is
    // handled once by applyPaymentToBank below (skipBankUpdate = true here).
    const electricityResults = [];
    if (Array.isArray(allocations?.electricity) && allocations.electricity.length > 0) {
      for (const elecAlloc of allocations.electricity) {
        const amountPaisa =
          elecAlloc.amountPaisa !== undefined
            ? elecAlloc.amountPaisa
            : rupeesToPaisa(elecAlloc.amount || 0);
        elecAlloc.amountPaisa = amountPaisa;
        if (amountPaisa <= 0) continue;

        const result = await electricityService.recordElectricityPayment(
          {
            electricityId: elecAlloc.electricityId,
            amountPaisa,
            paymentDate: paymentData.paymentDate,
            nepaliDate: paymentData.nepaliDate,
            paymentMethod: paymentData.paymentMethod,
            bankAccountId: paymentData.bankAccountId,
            bankAccountCode: paymentData.bankAccountCode,
            createdBy: paymentData.adminId ?? paymentData.receivedBy,
          },
          session,
          { skipBankUpdate: true },
        );
        electricityResults.push(result);
      }
    }

    const blockIdForEntity =
      rent?.block ?? cam?.block ?? electricityResults[0]?.electricity?.unit?.block ?? null;
    const entityId =
      paymentData.entityId ??
      (blockIdForEntity
        ? await resolveEntityFromBlock(blockIdForEntity, session)
        : null);

    // ── Step 5: Update bank account balance ───────────────────────────────────
    // FIX: calculateTotalAmountFromAllocations already sums rent + CAM + lateFee.
    // The old code added lateFeePaisaForBank on top — causing a double-count.
    const totalAmountPaisa = calculateTotalAmountFromAllocations(allocations);
    console.log("totalAmountPaisa", totalAmountPaisa);
    await applyPaymentToBank({
      paymentMethod: paymentData.paymentMethod,
      bankAccountId: paymentData.bankAccountId,
      amountPaisa: totalAmountPaisa,
      session,
    });

    // ── Step 6: Create payment record ─────────────────────────────────────────
    const rentPayload = rent
      ? buildRentPaymentPayload({
        tenantId: paymentData.tenantId,
        amountPaisa: allocations.rent.amountPaisa,
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
        amountPaisa: allocations.cam.paidAmountPaisa,
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

    const lateFeePayload =
      allocations?.lateFee?.amountPaisa > 0
        ? buildLateFeePaymentPayload({
          tenantId: paymentData.tenantId,
          amountPaisa: allocations.lateFee.amountPaisa,
          paymentDate: paymentData.paymentDate,
          nepaliDate: paymentData.nepaliDate,
          paymentMethod: paymentData.paymentMethod,
          paymentStatus: paymentData.paymentStatus,
          note: paymentData.note,
          transactionRef: paymentData.transactionRef,
          adminId: paymentData.adminId,
          bankAccountId: paymentData.bankAccountId,
          receivedBy: paymentData.receivedBy,
          rentId: rent?._id || null,
          allocations: { lateFee: allocations.lateFee },
        })
        : null;

    // Build merged Payment record — handle electricity-only case where no
    // rent/CAM/lateFee payloads exist (cheque paid entirely for electricity)
    let payload;
    if (rentPayload || camPayload || lateFeePayload) {
      payload = mergePaymentPayloads(rentPayload, camPayload, lateFeePayload);
    } else {
      payload = {
        tenant: paymentData.tenantId,
        amountPaisa: 0,
        amount: 0,
        paymentDate: paymentData.paymentDate,
        nepaliDate: paymentData.nepaliDate,
        paymentMethod: paymentData.paymentMethod,
        paymentStatus: paymentData.paymentStatus || "paid",
        note: paymentData.note || null,
        transactionRef: paymentData.transactionRef || null,
        createdBy: paymentData.adminId
          ? new mongoose.Types.ObjectId(paymentData.adminId)
          : undefined,
        rent: null,
        cam: null,
        allocations: { rent: null, cam: null, lateFee: null },
        bankAccount: paymentData.bankAccountId || null,
      };
    }

    // Add electricity total to the unified Payment record amount
    const electricityAmountPaisa = electricityResults.reduce(
      (sum, r) => sum + (r.electricity?.paidAmountPaisa ?? 0),
      0,
    );
    // electricityAmountPaisa above sums NEW amounts paid in this tx;
    // use allocation paisa directly for accuracy
    const electricityAllocPaisa = (allocations?.electricity || []).reduce(
      (sum, e) => sum + (e.amountPaisa || 0),
      0,
    );
    if (electricityAllocPaisa > 0) {
      payload.amountPaisa = (payload.amountPaisa || 0) + electricityAllocPaisa;
      payload.amount = payload.amountPaisa / 100;
    }

    const payment = await createPaymentRecord(payload, session);

    // ── Step 7: Ledger entries ────────────────────────────────────────────────
    if (rent) {
      const rentJournalPayload = buildPaymentReceivedJournal(rent, {
        amountPaisa: allocations.rent.amountPaisa,
        paymentMethod: paymentData.paymentMethod,
        bankAccountCode,
        paymentDate: paymentData.paymentDate,
        payment,
      });
      await ledgerService.postJournalEntry(
        rentJournalPayload,
        session,
        entityId,
      );
    }

    if (cam) {
      const camJournalPayload = buildCamPaymentReceivedJournal(
        { ...payment.toObject(), amountPaisa: allocations.cam.paidAmountPaisa },
        cam,
        bankAccountCode,
      );
      await ledgerService.postJournalEntry(
        camJournalPayload,
        session,
        entityId,
      );
    }

    // FIX: post ledger entry for late fee when present, same pattern as rent/CAM
    if (lateFeePayload && allocations?.lateFee?.amountPaisa > 0) {
      // payment.amountPaisa is the merged total — pass a synthetic object
      // so the builder sees only the late fee slice, not the full payment amount.
      // rent is used for context (nepaliMonth, nepaliYear, tenant, property)
      // since late fee is always tied to a rent document.
      const lateFeeJournalPayload = buildLateFeePaymentJournal(
        { ...payment.toObject(), amountPaisa: allocations.lateFee.amountPaisa },
        rent,
        bankAccountCode,
      );
      await ledgerService.postJournalEntry(
        lateFeeJournalPayload,
        session,
        entityId,
      );
    }

    // ── Step 8: Revenue recording ─────────────────────────────────────────────
    if (rent) {
      await recordRentRevenue({
        amountPaisa: allocations.rent.amountPaisa,
        paymentDate: payment.paymentDate,
        rentPeriodMonth: rent.nepaliMonth,
        rentPeriodYear: rent.nepaliYear,
        tenantId: paymentData.tenantId,
        rentId: rent._id,
        note: payment.note,
        adminId: payment.createdBy,
        entityId,
        blockId: rent.block,
        paymentMethod: paymentData.paymentMethod,
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
        entityId,
        blockId: cam.block,
        paymentMethod: paymentData.paymentMethod,
        session,
      });
    }
    // FIX: record late fee revenue when present, same pattern as rent/CAM
    if (allocations?.lateFee?.amountPaisa > 0 && rent) {
      await recordLateFeeRevenue({
        amountPaisa: allocations.lateFee.amountPaisa,
        paymentDate: payment.paymentDate,
        tenantId: paymentData.tenantId,
        rentId: rent._id, // late fee is always tied to a rent document
        note: payment.note,
        adminId: payment.createdBy,
        entityId,
        blockId: rent.block,
        paymentMethod: paymentData.paymentMethod,
        session,
      });
    }
    // ── Step 8.5: Create ChequeDraft for received cheque payments ─────────────
    // The receipt-side journals (DR 1150 / CR AR for rent+CAM+electricity) were
    // already posted in Steps 7–8 and within electricityService.recordElectricityPayment.
    // We create ONE PENDING ChequeDraft for the full cheque face-value so the
    // accountant can later mark it DEPOSITED (DR Bank / CR 1150) or BOUNCED.
    //
    // payment.amountPaisa is the authoritative total — it includes rent, CAM,
    // late fee, AND electricity allocations (added at Step 6).
    if (paymentData.paymentMethod === "cheque" && !paymentData.chequeNumber?.trim()) {
      console.warn(`[createPayment] chequeNumber missing for cheque payment ${payment._id} — draft NOT created`);
    } else if (paymentData.paymentMethod === "cheque" && !entityId) {
      console.warn(`[createPayment] entityId null for cheque payment ${payment._id} — draft NOT created`);
    }

    if (
      paymentData.paymentMethod === "cheque" &&
      paymentData.chequeNumber?.trim() &&
      entityId &&
      payment.amountPaisa > 0
    ) {
      const chequePeriodMonth =
        rent?.nepaliMonth ?? cam?.nepaliMonth ??
        electricityResults[0]?.electricity?.nepaliMonth ?? null;
      const chequePeriodYear =
        rent?.nepaliYear ?? cam?.nepaliYear ??
        electricityResults[0]?.electricity?.nepaliYear ?? null;

      await createChequeDraft(
        {
          chequeNumber: paymentData.chequeNumber.trim(),
          chequeDate: paymentData.paymentDate ? new Date(paymentData.paymentDate) : new Date(),
          direction: "RECEIVED",
          amountPaisa: payment.amountPaisa,  // full face-value including electricity
          bankAccountCode: paymentData.bankAccountCode,
          referenceAccountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE, // "1200" — for bounce reversal
          referenceType: null,
          referenceId: null,
          entityId,
          partyName: paymentData.partyName ?? null,
          nepaliDate: paymentData.nepaliDate ?? null,
          nepaliMonth: chequePeriodMonth,
          nepaliYear: chequePeriodYear,
          createdBy: paymentData.adminId ?? paymentData.receivedBy,
          skipReceiptJournal: true, // receipt journals already posted in Steps 7–8
        },
        session,
      );
    }

    const tenantIdForSync =
      paymentData.tenantId ??
      rent?.tenant?._id?.toString() ??
      cam?.tenant?._id?.toString() ??
      null;

    let balanceAfterPayment = null;
    if (tenantIdForSync) {
      balanceAfterPayment = await syncTenantBalance(tenantIdForSync, session);
    }

    // ── Step 9: Commit ────────────────────────────────────────────────────────
    await session.commitTransaction();
    session.endSession();

    // ── Step 10: Async side effects ───────────────────────────────────────────
    const tenantPhone =
      rent?.tenant?.phone ?? cam?.tenant?.phone ?? null;
    const tenantName =
      rent?.tenant?.name ?? cam?.tenant?.name ?? null;
    // if (tenantPhone && tenantName && balanceAfterPayment) {
    //   smsTenant.paymentConfirmed(tenantPhone, {
    //     tenantName,
    //     amountRupees: Math.round(totalAmountPaisa / 100),
    //     receiptNo: payment.documentNumber ?? payment._id.toString().slice(-8).toUpperCase(),
    //     totalDuePaisa: balanceAfterPayment.totalDuePaisa,
    //   });
    // }

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

    // ── Step 10.5: Handle TDS document upload if provided ─────────────────────
    if (paymentData.tdsDocument && rent?.tdsPaidToGovernment) {
      handleTdsDocumentUpload({
        tdsDocument: paymentData.tdsDocument,
        rentId: rent._id,
        tenantId: rent.tenant,
      }).catch((error) => {
        console.error(
          "[createPayment] TDS document upload failed:",
          error.message,
        );
      });
    }

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
      .populate("bankAccount")
      .populate("receivedBy", "name");

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
    const lateFeeAmountPaisa =
      payment.allocations?.lateFee?.amountPaisa ??
      rupeesToPaisa(payment.allocations?.lateFee?.amount || 0);
    const electricityAmountPaisa = (payment.allocations?.electricity ?? [])
      .reduce((sum, e) => sum + (e.amountPaisa ?? rupeesToPaisa(e.amount || 0)), 0);

    const receiptNo = payment.documentNumber || payment._id.toString();

    const pdfData = {
      receiptNo,
      amount: payment.amountPaisa / 100,
      paymentDate: formattedDate,
      nepaliDate: payment.nepaliDate || "",
      tenantName: rent?.tenant?.name || payment.tenant?.name || "N/A",
      property: rent?.property?.name || "N/A",
      paidFor,
      paymentMethod:
        { cheque: "Cheque", cash: "Cash" }[payment.paymentMethod] ??
        "Bank Transfer",
      receivedBy: payment.receivedBy?.name || "",
      rentAmount: rentAmountPaisa / 100,
      camAmount: camAmountPaisa / 100,
      lateFeeAmount: lateFeeAmountPaisa / 100,
      electricityAmount: electricityAmountPaisa / 100,
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
    Receipt No: ${receiptNo}<br>
    ${rentAmountPaisa > 0 ? `Rent: ${formatMoneySafe(rentAmountPaisa)}<br>` : ""}
    ${camAmountPaisa > 0 ? `CAM: ${formatMoneySafe(camAmountPaisa)}<br>` : ""}
    ${electricityAmountPaisa > 0 ? `Electricity: ${formatMoneySafe(electricityAmountPaisa)}<br>` : ""}
    ${lateFeeAmountPaisa > 0 ? `Late Fee: ${formatMoneySafe(lateFeeAmountPaisa)}<br>` : ""}
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
      subject: `Payment Receipt — ${paidFor}`,
      html,
      attachments: [
        {
          filename: `receipt-${receiptNo}.pdf`,
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

/**
 * Apply one payment across multiple rent months (oldest first).
 * Waterfall order per month: rent → late fee → CAM → electricity.
 */
export async function createBulkArrearsPayment(params) {
  const {
    adminId,
    tenantId,
    rentIds,
    totalAmount,
    paymentDate,
    nepaliDate,
    paymentMethod,
    bankAccountId,
    bankAccountCode,
    transactionRef,
    note,
    allocationStrategy = "proportional",
    chequeNumber = null,
    partyName = null,
  } = params;

  const rents = await Rent.find({ _id: { $in: rentIds } })
    .populate("tenant")
    .populate("property")
    .populate("units")
    .populate({ path: "unitBreakdown.unit", select: "name" })
    .lean();

  const orderedRents = rentIds
    .map((id) => rents.find((r) => r._id.toString() === id.toString()))
    .filter(Boolean);

  if (orderedRents.length === 0) {
    return { success: false, error: "No valid rent records found for provided IDs" };
  }

  // Batch-fetch CAM and electricity for all selected months
  const periodFilter = {
    tenant: tenantId,
    status: { $in: ["pending", "partially_paid"] },
    $or: orderedRents.map((r) => ({ nepaliYear: r.nepaliYear, nepaliMonth: r.nepaliMonth })),
  };

  const { Electricity } = await import("../electricity/Electricity.Model.js");
  const [camRecords, elecRecords] = await Promise.all([
    Cam.find(periodFilter).select("_id tenant nepaliYear nepaliMonth amountPaisa paidAmountPaisa").lean(),
    Electricity.find({ ...periodFilter, billTo: "tenant" }).select("_id tenant nepaliYear nepaliMonth totalAmountPaisa paidAmountPaisa").lean(),
  ]);

  const camMap = new Map();
  for (const c of camRecords) {
    camMap.set(`${c.nepaliYear}_${c.nepaliMonth}`, c);
  }
  const elecMap = new Map();
  for (const e of elecRecords) {
    const key = `${e.nepaliYear}_${e.nepaliMonth}`;
    if (!elecMap.has(key)) elecMap.set(key, []);
    elecMap.get(key).push(e);
  }

  let budgetPaisa = rupeesToPaisa(totalAmount);
  const plan = [];

  for (const rent of orderedRents) {
    if (budgetPaisa <= 0) break;

    const key = `${rent.nepaliYear}_${rent.nepaliMonth}`;

    const grossPaisa = rent.grossRentAmountPaisa ?? 0;
    const tdsPaisa = rent.tdsAmountPaisa ?? 0;
    const paidPaisa = rent.paidAmountPaisa ?? 0;
    const remainingRentPaisa = Math.max(0, grossPaisa - tdsPaisa - paidPaisa);

    const hasLateFee = rent.lateFeeApplied && (rent.lateFeePaisa ?? 0) > 0 && rent.lateFeeStatus !== "paid";
    const remainingLateFeePaisa = hasLateFee ? (rent.lateFeePaisa ?? 0) - (rent.latePaidAmountPaisa ?? 0) : 0;

    const cam = camMap.get(key) ?? null;
    const remainingCamPaisa = cam ? Math.max(0, (cam.amountPaisa ?? 0) - (cam.paidAmountPaisa ?? 0)) : 0;

    const elecList = elecMap.get(key) ?? [];

    const hasAnything = remainingRentPaisa > 0 || remainingLateFeePaisa > 0 || remainingCamPaisa > 0 ||
      elecList.some((e) => (e.totalAmountPaisa ?? 0) > (e.paidAmountPaisa ?? 0));
    if (!hasAnything) continue;

    // Waterfall: rent → late fee → cam → electricity (oldest month first)
    const allocatedRentPaisa = Math.min(remainingRentPaisa, budgetPaisa);
    budgetPaisa -= allocatedRentPaisa;

    let allocatedLateFeePaisa = 0;
    if (hasLateFee && budgetPaisa >= remainingLateFeePaisa && allocatedRentPaisa >= remainingRentPaisa) {
      allocatedLateFeePaisa = remainingLateFeePaisa;
      budgetPaisa -= allocatedLateFeePaisa;
    }

    let allocatedCamPaisa = 0;
    if (cam && budgetPaisa > 0 && remainingCamPaisa > 0) {
      allocatedCamPaisa = Math.min(remainingCamPaisa, budgetPaisa);
      budgetPaisa -= allocatedCamPaisa;
    }

    const allocatedElectricity = [];
    for (const e of elecList) {
      if (budgetPaisa <= 0) break;
      const elecRemaining = Math.max(0, (e.totalAmountPaisa ?? 0) - (e.paidAmountPaisa ?? 0));
      if (elecRemaining <= 0) continue;
      const alloc = Math.min(elecRemaining, budgetPaisa);
      budgetPaisa -= alloc;
      allocatedElectricity.push({ electricityId: e._id.toString(), amountPaisa: alloc });
    }

    const totalSlicePaisa = allocatedRentPaisa + allocatedLateFeePaisa + allocatedCamPaisa +
      allocatedElectricity.reduce((s, a) => s + a.amountPaisa, 0);

    if (totalSlicePaisa > 0) {
      plan.push({ rent, cam, allocatedRentPaisa, allocatedLateFeePaisa, allocatedCamPaisa, allocatedElectricity, totalSlicePaisa });
    }
  }

  if (plan.length === 0) {
    return { success: false, error: "All selected rents are already fully paid" };
  }

  const results = { succeeded: [], failed: [], totalPaidPaisa: 0 };

  for (const { rent, cam, allocatedRentPaisa, allocatedLateFeePaisa, allocatedCamPaisa, allocatedElectricity, totalSlicePaisa } of plan) {
    const allocations = {
      rent: {
        rentId: rent._id.toString(),
        amount: allocatedRentPaisa / 100,
        amountPaisa: allocatedRentPaisa,
      },
    };

    if (allocatedLateFeePaisa > 0) {
      allocations.lateFee = {
        rentId: rent._id.toString(),
        amount: allocatedLateFeePaisa / 100,
        amountPaisa: allocatedLateFeePaisa,
      };
    }

    if (allocatedCamPaisa > 0 && cam?._id) {
      allocations.cam = {
        camId: cam._id.toString(),
        paidAmount: allocatedCamPaisa / 100,
        paidAmountPaisa: allocatedCamPaisa,
      };
    }

    if (allocatedElectricity.length > 0) {
      allocations.electricity = allocatedElectricity.map((a) => ({
        electricityId: a.electricityId,
        amountPaisa: a.amountPaisa,
        amount: a.amountPaisa / 100,
      }));
    }

    const paymentData = {
      adminId,
      tenantId,
      amount: totalSlicePaisa / 100,
      paymentDate,
      nepaliDate,
      paymentMethod,
      paymentStatus: "paid",
      bankAccountId: bankAccountId || null,
      bankAccountCode: bankAccountCode || null,
      transactionRef: transactionRef || null,
      note: note || null,
      allocations,
      allocationStrategy,
      receivedBy: adminId,
      chequeNumber: chequeNumber || null,
      partyName: partyName || null,
    };

    const result = await createPayment(paymentData);

    if (result.success) {
      results.succeeded.push({
        rentId: rent._id.toString(),
        nepaliMonth: rent.nepaliMonth,
        nepaliYear: rent.nepaliYear,
        paidPaisa: totalSlicePaisa,
        paymentId: result.payment?.id,
        rentStatus: result.rent?.status,
      });
      results.totalPaidPaisa += totalSlicePaisa;
    } else {
      results.failed.push({
        rentId: rent._id.toString(),
        nepaliMonth: rent.nepaliMonth,
        nepaliYear: rent.nepaliYear,
        error: result.error || "Unknown error",
      });
    }
  }

  const allFailed = results.succeeded.length === 0;
  const partialFailure =
    results.failed.length > 0 && results.succeeded.length > 0;

  return {
    success: !allFailed,
    partial: partialFailure,
    totalPaidPaisa: results.totalPaidPaisa,
    totalPaid: results.totalPaidPaisa / 100,
    succeeded: results.succeeded,
    failed: results.failed,
    message: allFailed
      ? "All payments failed. No charges were recorded."
      : partialFailure
        ? `${results.succeeded.length} of ${plan.length} months paid. ${results.failed.length} failed.`
        : `${results.succeeded.length} month(s) cleared successfully.`,
  };
}
