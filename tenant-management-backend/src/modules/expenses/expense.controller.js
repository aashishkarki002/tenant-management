import {
  createExpense,
  getAllExpenses,
  getExpenseSources,
  getStaffExpenses,
  getSalaryReport,
  getExpensesByEntity,
} from "./expense.service.js";

export async function createExpenseController(req, res) {
  try {
    const { nepaliDate, nepaliDateStr, ...rest } = req.body;

    const result = await createExpense({
      ...rest,
      // Accept either key from clients (AddExpenseDialog sends nepaliDate like revenue)
      nepaliDateStr: nepaliDate ?? nepaliDateStr,
      createdBy: req.admin.id,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      expense: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAllExpensesController(req, res) {
  try {
    const {
      entityId,
      payeeType,
      referenceType,
      nepaliYear,
      nepaliMonth,
      propertyId,
      transactionScope,
    } = req.query;

    const result = await getAllExpenses({
      entityId,
      payeeType,
      referenceType,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      nepaliMonth: nepaliMonth ? parseInt(nepaliMonth) : undefined,
      propertyId,
      transactionScope,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      expenses: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExpenseSourcesController(req, res) {
  try {
    const result = await getExpenseSources();
    return res.status(200).json({
      success: result.success,
      message: result.message,
      expenseSources: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getStaffExpensesController(req, res) {
  try {
    const { staffId } = req.params;
    const { nepaliYear, nepaliMonth } = req.query;

    if (!staffId) {
      return res
        .status(400)
        .json({ success: false, message: "staffId is required" });
    }

    const result = await getStaffExpenses(staffId, {
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      nepaliMonth: nepaliMonth ? parseInt(nepaliMonth) : undefined,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      expenses: result.data,
      totalAmountPaisa: result.totalAmountPaisa,
      totalAmountRupees: result.totalAmountRupees,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getSalaryReportController(req, res) {
  try {
    const { nepaliYear, nepaliMonth } = req.query;

    if (!nepaliYear || !nepaliMonth) {
      return res.status(400).json({
        success: false,
        message: "nepaliYear and nepaliMonth are required",
      });
    }

    const result = await getSalaryReport(
      parseInt(nepaliYear),
      parseInt(nepaliMonth),
    );

    return res.status(200).json({
      success: result.success,
      message: result.message,
      data: result.data,
      grandTotalPaisa: result.grandTotalPaisa,
      grandTotalRupees: result.grandTotalRupees,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getExpensesByEntityController(req, res) {
  try {
    const { nepaliYear, nepaliMonth } = req.query;

    const result = await getExpensesByEntity({
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      nepaliMonth: nepaliMonth ? parseInt(nepaliMonth) : undefined,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
