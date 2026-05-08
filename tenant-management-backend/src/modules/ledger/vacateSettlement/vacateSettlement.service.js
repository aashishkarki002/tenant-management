/**
 * vacateSettlement.service.js
 *
 * Orchestrates the full tenant vacate workflow:
 *
 *  1. Compute — calculate pro-rated charges and SD settlement preview
 *  2. Execute — post all journals, lock ledger, update tenant status
 *  3. Cancel  — abort a DRAFT settlement
 *
 * Journal sequence on execute:
 *  a. Pro-rated rent charge (if partial month and rent > 0)
 *  b. Pro-rated CAM charge  (if partial month and CAM > 0)
 *  c. SD settlement via existing sdRefund builder (AR clearance + cash refund)
 *  d. Bad debt write-off    (if AR remains after SD and landlord elects write-off)
 *  e. Ledger lock           (sets VacateSettlement.ledgerLockedAt)
 *  f. Tenant.vacateStatus = "vacated"
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { VacateSettlement } from "./VacateSettlement.Model.js";
import { Tenant } from "../../tenant/Tenant.Model.js";
import { LedgerEntry } from "../Ledger.Model.js";
import { Account } from "../accounts/Account.Model.js";
import { ledgerService } from "../ledger.service.js";
import { auditService } from "../../audit/audit.service.js";
import { ACCOUNT_CODES } from "../config/accounts.js";
import {
  buildProRatedRentJournal,
  buildProRatedCamJournal,
  calculateProRatedPaisa,
} from "../journal-builders/proRatedRent.js";
import { buildBadDebtWriteoffJournal } from "../journal-builders/badDebtWriteoff.js";
import { buildSdRefundJournal } from "../journal-builders/sdRefund.js";
import { formatNepaliISO } from "../../../utils/nepaliDateHelper.js";

/**
 * Get the current AR balance for a tenant by summing LedgerEntry debits/credits
 * on the ACCOUNTS_RECEIVABLE (1200) account.
 *
 * @param {string|ObjectId} tenantId
 * @param {string|ObjectId} entityId
 * @returns {Promise<number>}  Net AR paisa (positive = tenant owes)
 */
async function getTenantArBalance(tenantId, entityId) {
  const arAccount = await Account.findOne({
    code: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
    entityId,
  }).lean();

  if (!arAccount) return 0;

  const result = await LedgerEntry.aggregate([
    {
      $match: {
        tenant: new mongoose.Types.ObjectId(tenantId),
        account: arAccount._id,
        entityId: new mongoose.Types.ObjectId(entityId),
      },
    },
    {
      $group: {
        _id: null,
        totalDebit:  { $sum: "$debitAmountPaisa" },
        totalCredit: { $sum: "$creditAmountPaisa" },
      },
    },
  ]);

  if (!result.length) return 0;
  return (result[0].totalDebit ?? 0) - (result[0].totalCredit ?? 0);
}

class VacateSettlementService {
  /**
   * Compute a settlement preview without posting any journals.
   * Returns a DRAFT VacateSettlement document.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.tenantId
   * @param {string|ObjectId} params.entityId
   * @param {Date}            params.vacateDate   Actual vacate date
   * @param {boolean}         [params.writeOffBadDebt=false]
   * @param {number}          [params.maintenanceDeductionPaisa=0]
   * @param {string}          [params.paymentMethod="cash"]  For SD cash refund
   * @param {string}          [params.bankAccountCode]
   * @param {string}          [params.notes]
   * @param {string|ObjectId} params.createdBy
   *
   * @returns {Promise<VacateSettlement>}
   */
  async compute({
    tenantId,
    entityId,
    vacateDate,
    writeOffBadDebt = false,
    maintenanceDeductionPaisa = 0,
    paymentMethod = "cash",
    bankAccountCode,
    notes,
    createdBy,
  }) {
    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);
    if (tenant.vacateStatus === "vacated") {
      throw new Error("This tenant has already been vacated.");
    }

    const txDate = vacateDate instanceof Date ? vacateDate : new Date(vacateDate);
    const nd     = new NepaliDate(txDate);
    const nepaliYear  = nd.getYear();
    const nepaliMonth = nd.getMonth() + 1; // 1-based
    const vacateDay   = nd.getDate();      // day of month (1-based)
    const totalDaysInMonth = NepaliDate.getDaysOfMonth(nepaliYear, nepaliMonth - 1);

    // Pro-rate: tenant occupied days 1 through vacateDay
    const daysOccupied = vacateDay;

    const monthlyRentPaisa = tenant.grossAmountPaisa ?? 0;
    const monthlyCamPaisa  = tenant.camChargesPaisa  ?? 0;

    const proRatedRentPaisa = monthlyRentPaisa > 0
      ? calculateProRatedPaisa(monthlyRentPaisa, daysOccupied, totalDaysInMonth)
      : 0;
    const proRatedCamPaisa  = monthlyCamPaisa > 0
      ? calculateProRatedPaisa(monthlyCamPaisa, daysOccupied, totalDaysInMonth)
      : 0;

    // Current AR (includes all open charges not yet paid)
    const existingAr = await getTenantArBalance(tenantId, entityId);
    const totalArAtVacate = existingAr + proRatedRentPaisa + proRatedCamPaisa;

    // SD held
    const sdBalancePaisa = tenant.securityDepositPaisa ?? 0;
    const maintenanceDed = Math.min(maintenanceDeductionPaisa, sdBalancePaisa);
    const sdAvailableForAr = sdBalancePaisa - maintenanceDed;
    const sdAppliedToAr    = Math.min(sdAvailableForAr, totalArAtVacate);
    const sdCashRefund     = sdAvailableForAr - sdAppliedToAr;
    const remainingAr      = totalArAtVacate - sdAppliedToAr;
    const badDebtWriteOff  = writeOffBadDebt && remainingAr > 0 ? remainingAr : 0;

    const vacateDateNepali = formatNepaliISO(nd);
    const propertyId = tenant.property ?? null;

    // Upsert DRAFT settlement
    const settlement = await VacateSettlement.findOneAndUpdate(
      { tenant: tenantId },
      {
        entityId,
        property: propertyId,
        vacateDate: txDate,
        vacateDateNepali,
        nepaliMonth,
        nepaliYear,
        status: "DRAFT",
        finalRentDuePaisa:    existingAr,
        finalCamDuePaisa:     0,
        finalElecDuePaisa:    0,
        totalArAtVacatePaisa: totalArAtVacate,
        proRatedRentPaisa,
        proRatedCamPaisa,
        proRatedDays:         daysOccupied,
        totalDaysInMonth,
        sdBalancePaisa,
        sdAppliedToArPaisa:   sdAppliedToAr,
        sdMaintenanceDeduction: maintenanceDed,
        sdCashRefundPaisa:    sdCashRefund,
        badDebtWrittenOffPaisa: badDebtWriteOff,
        notes,
      },
      { upsert: true, new: true },
    );

    return settlement;
  }

  /**
   * Execute the settlement: post all journals, lock ledger, mark tenant vacated.
   *
   * @param {Object} params
   * @param {string|ObjectId} params.tenantId
   * @param {string|ObjectId} params.entityId
   * @param {string|ObjectId} params.settledBy   Admin._id
   * @param {string}          [params.paymentMethod="cash"]
   * @param {string}          [params.bankAccountCode]
   * @param {boolean}         [params.writeOffBadDebt=false]
   * @param {string}          [params.notes]
   *
   * @returns {Promise<VacateSettlement>}
   */
  async execute({
    tenantId,
    entityId,
    settledBy,
    paymentMethod = "cash",
    bankAccountCode,
    writeOffBadDebt = false,
    notes,
  }) {
    const settlement = await VacateSettlement.findOne({ tenant: tenantId });
    if (!settlement) {
      throw new Error("No settlement draft found. Call compute() first.");
    }
    if (settlement.status === "COMPLETED") {
      throw new Error("This settlement is already completed.");
    }

    const tenant = await Tenant.findById(tenantId).lean();
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const sid      = settlement._id;
    const tenantName = tenant.name ?? "Tenant";
    const propertyId = settlement.property;

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        let proRatedRentTxId = null;
        let proRatedCamTxId  = null;
        let sdSettlementTxId = null;
        let badDebtTxId      = null;

        // ── a. Pro-rated rent ─────────────────────────────────────────────
        if (settlement.proRatedRentPaisa > 0) {
          const payload = buildProRatedRentJournal({
            vacateSettlementId: sid,
            tenantId,
            tenantName,
            propertyId,
            proRatedRentPaisa: settlement.proRatedRentPaisa,
            nepaliMonth: settlement.nepaliMonth,
            nepaliYear:  settlement.nepaliYear,
            daysOccupied: settlement.proRatedDays,
            totalDaysInMonth: settlement.totalDaysInMonth,
            vacateDate: settlement.vacateDate,
            createdBy: settledBy,
            entityId,
          });
          const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
          proRatedRentTxId = transaction._id;
        }

        // ── b. Pro-rated CAM ──────────────────────────────────────────────
        if (settlement.proRatedCamPaisa > 0) {
          const payload = buildProRatedCamJournal({
            vacateSettlementId: sid,
            tenantId,
            tenantName,
            propertyId,
            proRatedCamPaisa: settlement.proRatedCamPaisa,
            nepaliMonth: settlement.nepaliMonth,
            nepaliYear:  settlement.nepaliYear,
            daysOccupied: settlement.proRatedDays,
            totalDaysInMonth: settlement.totalDaysInMonth,
            vacateDate: settlement.vacateDate,
            createdBy: settledBy,
            entityId,
          });
          const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
          proRatedCamTxId = transaction._id;
        }

        // ── c. SD settlement ──────────────────────────────────────────────
        const lineItems = [];

        if (settlement.sdAppliedToArPaisa > 0) {
          lineItems.push({
            type: "RENT_ADJUSTMENT",
            amountPaisa: settlement.sdAppliedToArPaisa,
            note: "Applied SD to clear tenant AR on vacate",
          });
        }
        if (settlement.sdMaintenanceDeduction > 0) {
          lineItems.push({
            type: "MAINTENANCE_ADJUSTMENT",
            amountPaisa: settlement.sdMaintenanceDeduction,
            note: "Maintenance deduction from SD on vacate",
          });
        }
        if (settlement.sdCashRefundPaisa > 0) {
          lineItems.push({
            type: "CASH_REFUND",
            amountPaisa: settlement.sdCashRefundPaisa,
            paymentMethod,
            bankAccountCode,
          });
        }

        if (lineItems.length > 0) {
          // Build a mock SD doc for the builder
          const sdDoc = {
            _id: sid, // use settlement as reference
            amountPaisa: settlement.sdBalancePaisa,
            tenant: { _id: tenantId, name: tenantName },
            property: propertyId,
          };
          const sdPayload = buildSdRefundJournal(
            sdDoc,
            {
              refundId: sid,
              refundDate: settlement.vacateDate,
              createdBy: settledBy,
              lineItems,
            },
            entityId,
          );
          // Override referenceType to VacateSettlement
          sdPayload.referenceType = "VacateSettlement";
          sdPayload.transactionType = "SD_REFUND_COMPOUND";

          const { transaction } = await ledgerService.postJournalEntry(sdPayload, session, entityId);
          sdSettlementTxId = transaction._id;
        }

        // ── d. Bad debt write-off ─────────────────────────────────────────
        const badDebt = writeOffBadDebt ? settlement.badDebtWrittenOffPaisa : 0;
        if (badDebt > 0) {
          const payload = buildBadDebtWriteoffJournal({
            vacateSettlementId: sid,
            tenantId,
            tenantName,
            propertyId,
            writeOffAmountPaisa: badDebt,
            nepaliMonth: settlement.nepaliMonth,
            nepaliYear:  settlement.nepaliYear,
            writeOffDate: settlement.vacateDate,
            reason: "Uncollectable AR on vacate",
            createdBy: settledBy,
            entityId,
          });
          const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
          badDebtTxId = transaction._id;
        }

        // ── e. Lock and mark completed ────────────────────────────────────
        const now = new Date();
        await VacateSettlement.findByIdAndUpdate(
          sid,
          {
            status: "COMPLETED",
            proRatedRentTxId,
            proRatedCamTxId,
            sdSettlementTxId,
            badDebtTxId,
            ledgerLockedAt: now,
            ledgerLockedBy: settledBy,
            settledBy,
            settledAt: now,
            notes: notes ?? settlement.notes,
          },
          { session },
        );

        // ── f. Update tenant status ───────────────────────────────────────
        await Tenant.findByIdAndUpdate(
          tenantId,
          {
            vacateStatus: "vacated",
            vacatedAt: settlement.vacateDate,
            vacatedAtNepali: settlement.vacateDateNepali,
          },
          { session },
        );
      });
    } catch (err) {
      throw err;
    } finally {
      await session.endSession();
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    await auditService.log("TENANT_VACATED", settledBy, {
      entityId,
      resourceType: "VacateSettlement",
      resourceId: sid,
      amountPaisa: settlement.totalArAtVacatePaisa,
      reason: notes ?? settlement.notes,
    });
    await auditService.log("LEDGER_LOCKED", settledBy, {
      entityId,
      resourceType: "Tenant",
      resourceId: tenantId,
      reason: `Tenant vacated — ledger locked on ${settlement.vacateDateNepali}`,
    });

    return VacateSettlement.findById(sid)
      .populate("settledBy", "name email")
      .lean();
  }

  /**
   * Check if a tenant's ledger is locked (vacated).
   * Used by ledger.service.js postJournalEntry guard.
   *
   * @param {string|ObjectId} tenantId
   * @returns {Promise<boolean>}
   */
  async isTenantLedgerLocked(tenantId) {
    if (!tenantId) return false;
    const settlement = await VacateSettlement.findOne({
      tenant: tenantId,
      status: "COMPLETED",
    }).select("ledgerLockedAt").lean();
    return !!settlement?.ledgerLockedAt;
  }

  /**
   * Get settlement for a specific tenant.
   *
   * @param {string|ObjectId} tenantId
   * @returns {Promise<VacateSettlement|null>}
   */
  async getByTenant(tenantId) {
    return VacateSettlement.findOne({ tenant: tenantId })
      .populate("settledBy", "name email")
      .lean();
  }

  /**
   * List all settlements for an entity.
   *
   * @param {string|ObjectId} entityId
   * @param {string}          [status]  Filter by status
   * @returns {Promise<VacateSettlement[]>}
   */
  async listByEntity(entityId, status) {
    const q = { entityId };
    if (status) q.status = status;
    return VacateSettlement.find(q)
      .sort({ createdAt: -1 })
      .populate("tenant", "name email")
      .populate("settledBy", "name email")
      .lean();
  }
}

export const vacateSettlementService = new VacateSettlementService();
