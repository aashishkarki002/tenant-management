/**
 * journals/index.js  (UPDATED)
 *
 * Central export for all journal payload builders.
 * Every builder produces the canonical payload shape defined in journalPayloadUtil.js.
 * Pass the returned object directly to ledgerService.postJournalEntry().
 *
 * Usage:
 *   import { buildRentChargeJournal } from "./journals/index.js";
 *   const payload = buildRentChargeJournal(rentDoc);
 *   const { transaction } = await ledgerService.postJournalEntry(payload, session);
 */

// Rent
export { buildRentChargeJournal } from "./rentCharge.js";
export { buildPaymentReceivedJournal } from "./paymentReceived.js";
export { buildTdsWithheldJournal } from "./tdsWithheld.js";
export { buildTdsPaidToGovernmentJournal } from "./tdsPaidToGovernment.js";

// CAM
export { buildCamChargeJournal } from "./camCharge.js";
export { buildCamPaymentReceivedJournal } from "./camPaymentReceived.js";

// Electricity
export {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
  buildElectricityDemandChargeJournal,
  buildNeaBillEnergyCostJournal,
  buildNeaBillPaymentJournal,
} from "./electricity.js";

// NEA bill payment (clears NEA_PAYABLE 2050)
export { buildNeaPaymentJournal } from "./neaPayment.js";

// Late fees  (NEW)
export { buildLateFeeJournal, buildLateFeePaymentJournal } from "./lateFee.js";

// Revenue & expenses
export { buildRevenueReceivedJournal } from "./revenueReceived.js";
export { buildExpenseJournal } from "./expense.js";

// Security deposit
export { buildSecurityDepositJournal } from "./securityDeposit.js";

// Loans
export {
  buildLoanDisbursementJournal,
  buildLoanPaymentJournal,
} from "./loan.js";

// Security deposit refund
export { buildSdRefundJournal } from "./sdRefund.js";

// Cheque clearing (receipt + deposit + bounce/cancel reversal)
export { buildChequeReceiptJournal, buildChequeDepositJournal, buildChequeBounceJournal } from "./chequeClearing.js";

// Opening balances (onboarding existing properties)
export { buildOpeningBalanceJournal } from "./openingBalance.js";

// Year-end close (fiscal year closing entries)
export {
  buildYearEndRevenueCloseJournal,
  buildYearEndExpenseCloseJournal,
  buildYearEndRetainedEarningsJournal,
} from "./yearEndClose.js";

// Vacate settlement (pro-rated charges + bad debt)
export { buildProRatedRentJournal, buildProRatedCamJournal } from "./proRatedRent.js";
export { buildBadDebtWriteoffJournal } from "./badDebtWriteoff.js";

// Adjustments (debit note, credit note, manual journal)
export { buildAdjustmentJournal } from "./adjustment.js";

// Owner distribution (draw)
export { buildOwnerDistributionJournal } from "./ownerDistribution.js";

// Vendor bills (AP workflow)
export { buildVendorBillEntryJournal, buildVendorBillPaymentJournal } from "./vendorBill.js";

// Advance / prepaid rent
export { buildAdvanceRentReceiptJournal, buildAdvanceRentRecognitionJournal, buildAdvanceRentAllocationJournal } from "./advanceRent.js";
