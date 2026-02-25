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

// CAM
export { buildCamChargeJournal } from "./camCharge.js";
export { buildCamPaymentReceivedJournal } from "./camPaymentReceived.js";

// Electricity
export {
  buildElectricityChargeJournal,
  buildElectricityPaymentJournal,
} from "./electricity.js";

// Late fees  (NEW)
export { buildLateFeeJournal, buildLateFeePaymentJournal } from "./lateFee.js";

// Revenue & expenses
export { buildRevenueReceivedJournal } from "./revenueReceived.js";
export { buildExpenseJournal } from "./expense.js";

// Security deposit
export { buildSecurityDepositJournal } from "./securityDeposit.js";
