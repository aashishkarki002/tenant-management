import * as transactionService from "./transaction.service.js";

/**
 * GET /api/transactions/get-all
 * Returns all non-voided transactions.
 */
export async function getAll(req, res) {
  try {
    const transactions = await transactionService.getAllTransactionsList();
    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error("getAll transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transactions",
    });
  }
}

/**
 * GET /api/transactions/recent
 * Returns recent transactions formatted for RecentActivities (query: limit, max 50).
 */
export async function getRecent(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const activities = await transactionService.getRecentTransactions(limit);
    res.json({ success: true, data: activities });
  } catch (error) {
    console.error("getRecent transactions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent transactions",
    });
  }
}
