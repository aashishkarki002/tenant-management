import { upsertBudgetLine, deleteBudgetLine, getBudgetLines, getBudgetVsActual } from "./budget.service.js";

export const listBudget = async (req, res) => {
  try {
    const { entityId, fiscalYear } = req.query;
    if (!fiscalYear) return res.status(400).json({ success: false, message: "fiscalYear is required" });
    const lines = await getBudgetLines({ entityId, fiscalYear });
    res.json({ success: true, data: lines });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const upsertBudget = async (req, res) => {
  try {
    const { entityId, fiscalYear, accountCode, budgetedAmountPaisa, notes } = req.body;
    const createdBy = req.user?._id ?? req.user?.id;
    const line = await upsertBudgetLine({ entityId, fiscalYear, accountCode, budgetedAmountPaisa, notes, createdBy });
    res.json({ success: true, data: line });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const removeBudget = async (req, res) => {
  try {
    const { entityId, fiscalYear, accountCode } = req.body;
    await deleteBudgetLine({ entityId, fiscalYear, accountCode });
    res.json({ success: true });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const budgetVsActual = async (req, res) => {
  try {
    const { entityId, fiscalYear } = req.query;
    if (!fiscalYear) return res.status(400).json({ success: false, message: "fiscalYear is required" });
    const data = await getBudgetVsActual({ entityId, fiscalYear });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};
