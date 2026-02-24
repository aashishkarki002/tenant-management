import { Transaction } from "./Transaction.Model.js";

/**
 * Maps a Transaction.type enum value to the activity type
 * used by the frontend RecentActivities component.
 */
function resolveActivityType(txType) {
  switch (txType) {
    case "RENT_PAYMENT_RECEIVED":
    case "CAM_PAYMENT_RECEIVED":
    case "ELECTRICITY_PAYMENT":
      return "payment";

    case "RENT_CHARGE":
    case "CAM_CHARGE":
    case "ELECTRICITY_CHARGE":
    case "SECURITY_DEPOSIT":
      return "rent";

    case "MAINTENANCE_EXPENSE":
      return "maintenance";

    case "REVENUE_STREAM":
    case "OTHER_INCOME":
      return "revenue";

    case "UTILITY_EXPENSE":
    case "OTHER_EXPENSE":
    case "ADJUSTMENT":
    default:
      return "default";
  }
}

/**
 * Builds a human-readable label for a transaction.
 */
function buildLabel(tx) {
  const LABELS = {
    RENT_PAYMENT_RECEIVED: "Rent payment received",
    CAM_PAYMENT_RECEIVED: "CAM payment received",
    ELECTRICITY_PAYMENT: "Electricity payment received",
    RENT_CHARGE: "Rent charged",
    CAM_CHARGE: "CAM charged",
    ELECTRICITY_CHARGE: "Electricity charged",
    SECURITY_DEPOSIT: "Security deposit recorded",
    MAINTENANCE_EXPENSE: "Maintenance expense",
    REVENUE_STREAM: "Revenue recorded",
    UTILITY_EXPENSE: "Utility expense",
    OTHER_INCOME: "Other income",
    OTHER_EXPENSE: "Other expense",
    ADJUSTMENT: "Adjustment",
  };
  return LABELS[tx.type] ?? tx.description ?? "Transaction";
}

/**
 * Formats a Date into a relative or absolute time string.
 * e.g. "2 hours ago", "3 days ago", "Jan 15"
 */
function formatRelativeTime(date) {
  const now = Date.now();
  const diffMs = now - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Fetches the most recent transactions and normalises them into the
 * shape expected by the RecentActivities frontend component.
 *
 * @param {number} limit - Maximum number of transactions to return (default 10)
 * @returns {Promise<Array>} Normalised activity objects
 */
export async function getRecentTransactions(limit = 10) {
  const transactions = await Transaction.find({ status: { $ne: "VOIDED" } })
    .sort({ transactionDate: -1 })
    .limit(limit)
    .lean();

  return transactions.map((tx, i) => ({
    id: tx._id?.toString() ?? i,
    type: resolveActivityType(tx.type),
    mainText: buildLabel(tx),
    details: [
      tx.description,
      tx.totalAmountPaisa != null
        ? `Rs. ${(tx.totalAmountPaisa / 100).toLocaleString("en-NP")}`
        : null,
      formatRelativeTime(tx.transactionDate),
    ]
      .filter(Boolean)
      .join(" · "),
    amount: tx.totalAmountPaisa != null ? tx.totalAmountPaisa / 100 : null,
    time: tx.transactionDate,
    rawType: tx.type,
    referenceType: tx.referenceType,
    referenceId: tx.referenceId,
  }));
}

/**
 * Fetches all non-voided transactions, sorted by date descending.
 * @returns {Promise<Array>} List of transaction documents
 */
export async function getAllTransactionsList() {
  return Transaction.find({ status: { $ne: "VOIDED" } })
    .sort({ transactionDate: -1 })
    .lean();
}
