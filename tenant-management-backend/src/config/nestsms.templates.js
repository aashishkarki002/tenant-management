import { sendSMSSafe } from "./nestsms.js";

const SIGN = "- Sallyan House";

/**
 * All tenant-facing SMS templates.
 *
 * Every function is fire-and-forget (sendSMSSafe) — failure logs but never
 * throws, so callers are never broken by SMS errors.
 *
 * Usage:
 *   import { smsTenant } from "../../config/nestsms.templates.js";
 *   await smsTenant.welcome(tenant.phone, { tenantName: tenant.name, unitName, propertyName });
 */
export const smsTenant = {
  /**
   * Sent when a new tenant is created.
   * Mirror of sendWelcomeEmail in nodemailer.js.
   */
  welcome: (phone, { tenantName, unitName, propertyName }) =>
    sendSMSSafe(
      phone,
      `Welcome ${tenantName}! Your tenancy at ${propertyName}${unitName ? `, Unit ${unitName}` : ""} is now active. You will receive rent notices and updates on this number. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent when rent payment is confirmed.
   * Call from payment.service.js after receipt is generated.
   */
  paymentReceived: (phone, { tenantName, amount, period, receiptNo }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, your payment of Rs.${amount} for ${period} (Receipt #${receiptNo}) has been received. Thank you. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent immediately after a payment is recorded.
   *
   * @param {string} phone
   * @param {{ tenantName: string, amountRupees: number, receiptNo: string, totalDuePaisa: number }} data
   *   totalDuePaisa — pass 0 when all dues are cleared, positive integer otherwise.
   */
  paymentConfirmed: (phone, { tenantName, amountRupees, receiptNo, totalDuePaisa }) => {
    const msg =
      totalDuePaisa > 0
        ? `Dear ${tenantName}, Rs.${amountRupees} received (Rcpt #${receiptNo}). Outstanding: Rs.${Math.round(totalDuePaisa / 100)}. ${SIGN}`
        : `Dear ${tenantName}, Rs.${amountRupees} received (Rcpt #${receiptNo}). All dues cleared. Thank you! ${SIGN}`;
    return sendSMSSafe(phone, msg, "transactional");
  },

  /**
   * Sent when rent is due (cron reminder before due date).
   */
  rentDue: (phone, { tenantName, amount, dueDate }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, your rent of Rs.${amount} is due on ${dueDate}. Please make payment on time to avoid late fees. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent when a late fee is applied by lateFee.cron.js.
   */
  lateFee: (phone, { tenantName, fee, totalDue }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, a late fee of Rs.${fee} has been added to your account. Total outstanding: Rs.${totalDue}. Please clear dues promptly. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent when maintenance request status changes.
   * Call from maintenance.service.js on status update.
   */
  maintenanceUpdate: (phone, { tenantName, title, status }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, your maintenance request "${title}" status has been updated to: ${status}. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent when a maintenance request is created/acknowledged.
   */
  maintenanceReceived: (phone, { tenantName, title }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, we have received your maintenance request for "${title}" and will attend to it shortly. ${SIGN}`,
      "transactional"
    ),

  /**
   * Sent for loan EMI due reminders from loanEmi.cron.js.
   */
  loanEmiDue: (phone, { tenantName, emiAmount, dueDate }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, your loan EMI of Rs.${emiAmount} is due on ${dueDate}. Please ensure timely payment. ${SIGN}`,
      "transactional"
    ),

  /**
   * Generic notice — use for one-off messages not covered by above templates.
   */
  notice: (phone, { tenantName, message }) =>
    sendSMSSafe(
      phone,
      `Dear ${tenantName}, ${message} ${SIGN}`,
      "transactional"
    ),
};
