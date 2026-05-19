import { AdvanceRent } from "../advanceRent/AdvanceRent.Model.js";
import { AuditLog } from "../audit/AuditLog.Model.js";
import { Cam } from "../cam/cam.model.js";
import { ChequeDraft } from "../chequeDrafts/ChequeDraft.Model.js";
import { ChecklistResult } from "../dailyChecks/checkListResult.model.js";
import { DailyChecklist } from "../dailyChecks/dailyChecksList.model.js";
import { Electricity } from "../electricity/Electricity.Model.js";
import { NeaBill } from "../electricity/NeaBill.Model.js";
import EventModel from "../events/event.model.js";
import EventExpenseModel from "../events/eventExpense.model.js";
import EventRevenueModel from "../events/eventRevenue.model.js";
import { Expense } from "../expenses/Expense.Model.js";
import { ClosedPeriod } from "../ledger/ClosedPeriod.Model.js";
import { LedgerEntry } from "../ledger/Ledger.Model.js";
import { Adjustment } from "../ledger/adjustments/Adjustment.Model.js";
import { Transaction } from "../ledger/transactions/Transaction.Model.js";
import { VacateSettlement } from "../ledger/vacateSettlement/VacateSettlement.Model.js";
import { VoucherCounter } from "../ledger/vouchers/VoucherCounter.Model.js";
import { FiscalYearClose } from "../ledger/yearEndClose/FiscalYearClose.Model.js";
import { Liability } from "../liabilities/Liabilities.Model.js";
import { Loan } from "../loans/Loan.model.js";
import { LoanPayment } from "../loans/LoanPayment.model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { MigrationSnapshot } from "../migration/MigrationSnapshot.Model.js";
import Notification from "../notifications/notification.model.js";
import { OwnerDistribution } from "../ownerDistribution/OwnerDistribution.Model.js";
import { ExternalPayment } from "../payment/externalPayment.model.js";
import { Payment } from "../payment/payment.model.js";
import { PaymentActivity } from "../payment/paymentActivity.model.js";
import { RentDeferralSchedule } from "../rentDeferral/RentDeferralSchedule.Model.js";
import { Rent } from "../rents/rent.Model.js";
import { Revenue } from "../revenue/Revenue.Model.js";
import { Sd } from "../securityDeposits/sd.model.js";
import { SdRefund } from "../securityDeposits/sdRefund.model.js";
import { TenantBalance } from "../tenantBalance/tenantBalance.model.js";
import { TdsQuarterlyPayment } from "../tds/TdsQuarterlyPayment.Model.js";
import { VendorBill } from "../vendorBills/VendorBill.Model.js";
import VendorPayment from "../vendors/vendorPayment.model.js";
import { CronLog } from "../../cron/model/CronLog.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { DocumentCounter } from "../documentCounter/DocumentCounter.Model.js";
import Unit from "../units/Unit.Model.js";

const TRANSACTIONAL_MODELS = [
  { name: "Tenant",               model: Tenant },
  { name: "Rent",                 model: Rent },
  { name: "Payment",              model: Payment },
  { name: "PaymentActivity",      model: PaymentActivity },
  { name: "ExternalPayment",      model: ExternalPayment },
  { name: "AdvanceRent",          model: AdvanceRent },
  { name: "Cam",                  model: Cam },
  { name: "TenantBalance",        model: TenantBalance },
  { name: "LedgerEntry",          model: LedgerEntry },
  { name: "Transaction",          model: Transaction },
  { name: "Adjustment",           model: Adjustment },
  { name: "VacateSettlement",     model: VacateSettlement },
  { name: "ClosedPeriod",         model: ClosedPeriod },
  { name: "FiscalYearClose",      model: FiscalYearClose },
  { name: "RentDeferralSchedule", model: RentDeferralSchedule },
  { name: "Electricity",          model: Electricity },
  { name: "NeaBill",              model: NeaBill },
  { name: "Sd",                   model: Sd },
  { name: "SdRefund",             model: SdRefund },
  { name: "ChequeDraft",          model: ChequeDraft },
  { name: "Expense",              model: Expense },
  { name: "Revenue",              model: Revenue },
  { name: "VendorBill",           model: VendorBill },
  { name: "VendorPayment",        model: VendorPayment },
  { name: "OwnerDistribution",    model: OwnerDistribution },
  { name: "Loan",                 model: Loan },
  { name: "LoanPayment",          model: LoanPayment },
  { name: "Liability",            model: Liability },
  { name: "TdsQuarterlyPayment",  model: TdsQuarterlyPayment },
  { name: "Maintenance",          model: Maintenance },
  { name: "ChecklistResult",      model: ChecklistResult },
  { name: "DailyChecklist",       model: DailyChecklist },
  { name: "Event",                model: EventModel },
  { name: "EventExpense",         model: EventExpenseModel },
  { name: "EventRevenue",         model: EventRevenueModel },
  { name: "MigrationSnapshot",    model: MigrationSnapshot },
  { name: "Notification",         model: Notification },
  { name: "AuditLog",             model: AuditLog },
  { name: "CronLog",              model: CronLog },
];

export async function resetTestData() {
  const result = {};

  for (const { name, model } of TRANSACTIONAL_MODELS) {
    try {
      const r = await model.deleteMany({});
      result[name] = r.deletedCount;
    } catch (err) {
      console.warn(`[devTools] Failed to delete ${name}: ${err.message}`);
      result[name] = `ERROR: ${err.message}`;
    }
  }

  // Clear unit lease state — keep unit records, just vacate all
  const unitReset = await Unit.updateMany(
    {},
    { $unset: { currentLease: 1 }, $set: { isOccupied: false, occupancyHistory: [] } },
  );
  result["Unit.reset"] = unitReset.modifiedCount;

  // Reset voucher sequence counters
  const vc = await VoucherCounter.updateMany({}, { $set: { lastSequence: 0 } });
  result["VoucherCounter.reset"] = vc.modifiedCount;

  // Reset document number counters
  const dc = await DocumentCounter.updateMany({}, { $set: { currentValue: 0 } });
  result["DocumentCounter.reset"] = dc.modifiedCount;

  console.info("[devTools] Test data reset complete");
  return result;
}
