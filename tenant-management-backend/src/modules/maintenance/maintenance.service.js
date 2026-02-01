import { Maintenance } from "./Maintenance.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { createExpense } from "../expenses/expense.service.js";
import { ACCOUNTING_CONFIG } from "../../config/accounting.config.js";

export async function createMaintenance(maintenanceData) {
  try {
    const maintenance = await Maintenance.create(maintenanceData);
    return {
      success: true,
      message: "Maintenance task created successfully",
      data: maintenance,
    };
  } catch (error) {
    // Surface Mongoose validation errors clearly
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      throw new Error(validationErrors);
    }

    throw new Error(error.message || "Failed to create maintenance task");
  }
}

export async function getAllMaintenance() {
  try {
    const maintenanceTasks = await Maintenance.find()
      .populate("tenant")
      .populate("unit")
      .populate("property")
      .populate("block")
      .populate("createdBy");

    return {
      success: true,
      message: "Maintenance tasks fetched successfully",
      data: maintenanceTasks,
    };
  } catch (error) {
    throw new Error(error.message || "Failed to get maintenance tasks");
  }
}

export async function getMaintenanceById(id) {
  try {
    const maintenance = await Maintenance.findById(id)
      .populate("tenant")
      .populate("unit")
      .populate("property")
      .populate("block")
      .populate("createdBy");

    if (!maintenance) {
      return {
        success: false,
        message: "Maintenance task not found",
        data: null,
      };
    }

    return {
      success: true,
      message: "Maintenance task fetched successfully",
      data: maintenance,
    };
  } catch (error) {
    throw new Error(error.message || "Failed to get maintenance task");
  }
}

export async function updateMaintenanceStatus(
  id,
  status,
  paymentStatus,
  paidAmount = null,
  lastPaidBy = null,
  options = {},
) {
  // 1. Verify maintenance exists
  const existing = await Maintenance.findById(id);
  if (!existing) {
    return {
      success: false,
      message: "Maintenance task not found",
      data: null,
      expense: null,
    };
  }

  // 2. Update maintenance task
  const updateFields = { status, paymentStatus };
  if (paidAmount !== null) updateFields.paidAmount = paidAmount;
  if (lastPaidBy) updateFields.lastPaidBy = lastPaidBy;

  const updatedTask = await Maintenance.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true },
  );

  // 3. Handle expense creation if completed and paid
  let expense = null;
  const isCompleted = updatedTask?.status === "COMPLETED";
  const isPaid = updatedTask?.paymentStatus === "paid";

  if (isCompleted && isPaid) {
    const finalPaidAmount = updatedTask.paidAmount ?? 0;

    if (finalPaidAmount > 0) {
      // Check for existing expense to avoid duplicates
      const existingExpense = await Expense.findOne({
        referenceType: "MAINTENANCE",
        referenceId: updatedTask._id,
      });

      if (existingExpense) {
        expense = existingExpense;
      } else {
        // Get maintenance expense source
        const maintenanceSource = await ExpenseSource.findOne({
          code: ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_SOURCE_CODE,
        });

        if (!maintenanceSource) {
          throw new Error(
            "Maintenance ExpenseSource with code MAINTENANCE not found",
          );
        }

        // Prepare expense data
        const { adminId, nepaliDate, nepaliMonth, nepaliYear } = options;
        const now = new Date();
        const payeeType = updatedTask.tenant ? "TENANT" : "EXTERNAL";

        const expenseData = {
          source: maintenanceSource._id,
          amount: finalPaidAmount,
          EnglishDate: now,
          nepaliDate: nepaliDate ? new Date(nepaliDate) : now,
          nepaliMonth:
            typeof nepaliMonth === "number" ? nepaliMonth : now.getMonth() + 1,
          nepaliYear:
            typeof nepaliYear === "number" ? nepaliYear : now.getFullYear(),
          payeeType,
          ...(payeeType === "TENANT" ? { tenant: updatedTask.tenant } : {}),
          referenceType: "MAINTENANCE",
          referenceId: updatedTask._id,
          status: "RECORDED",
          notes:
            updatedTask.completionNotes ||
            "Auto-created from maintenance completion",
          createdBy: adminId || updatedTask.createdBy,
          expenseCode: ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE,
        };

        // Create expense
        const result = await createExpense(expenseData);

        if (!result.success) {
          throw new Error(
            result.error || result.message || "Failed to create expense",
          );
        }

        expense = result.data;
      }
    }
  }

  return {
    success: true,
    message: "Maintenance status updated successfully",
    data: updatedTask,
    expense,
  };
}

export async function updateMaintenanceAssignedTo(id, assignedTo) {
  const existing = await Maintenance.findById(id);
  if (!existing) {
    return {
      success: false,
      message: "Maintenance task not found",
      data: null,
    };
  }
  const updated = await Maintenance.findByIdAndUpdate(
    id,
    { $set: { assignedTo: assignedTo || null } },
    { new: true },
  )
    .populate("assignedTo", "name email phone")
    .populate("tenant")
    .populate("unit")
    .populate("property")
    .populate("block")
    .populate("createdBy");
  return {
    success: true,
    message: "Assignment updated successfully",
    data: updated,
  };
}
