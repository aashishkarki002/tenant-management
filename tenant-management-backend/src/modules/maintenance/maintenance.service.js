import { Maintenance } from "./Maintenance.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { createExpense } from "../expenses/expense.service.js";
import { ACCOUNTING_CONFIG } from "../../config/accounting.config.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";
import { sendMaintenanceAssignmentEmail } from "../../config/nodemailer.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";
// ─── Helper ──────────────────────────────────────────────────────────────────
function _notifyAssignedStaff(maintenance) {
  const staff = maintenance.assignedTo;
  if (!staff?.email) return;

  sendMaintenanceAssignmentEmail({
    to: staff.email,
    staffName: staff.name,
    title: maintenance.title,
    description: maintenance.description,
    type: maintenance.type,
    priority: maintenance.priority,
    scheduledDate: maintenance.scheduledDate,
    propertyName: maintenance.property?.name,
    unitName: maintenance.unit?.name,
    maintenanceId: maintenance._id.toString(),
  });
  // Intentionally NOT awaited — email is a fire-and-forget side-effect

  createAndEmitNotification({
    type: "MAINTENANCE_ASSIGNED", // add this to the notification model enum
    title: "Maintenance Task Assigned",
    message: `You have been assigned to "${maintenance.title}" scheduled on ${new Date(maintenance.scheduledDate).toLocaleDateString()}${maintenance.property?.name ? ` at ${maintenance.property.name}` : ""}.`,
    data: {
      maintenanceId: maintenance._id,
      title: maintenance.title,
      priority: maintenance.priority,
      scheduledDate: maintenance.scheduledDate,
      propertyName: maintenance.property?.name,
      unitName: maintenance.unit?.name,
    },
    adminIds: [staff._id.toString()], // ← staff only, not all admins
  }).catch((err) =>
    console.error("[maintenance] failed to emit assignment notification:", err),
  );
}
function _notifyAllAdmins({ type, title, message, data }) {
  // Omitting adminIds → createAndEmitNotification targets ALL active admins
  createAndEmitNotification({ type, title, message, data }).catch((err) =>
    console.error(`[maintenance] failed to emit ${type} notification:`, err),
  );
}

// ─── Service functions ────────────────────────────────────────────────────────

export async function createMaintenance(maintenanceData) {
  try {
    // Normalise rupee → paisa if caller passed the human-readable field
    if (
      maintenanceData.amountPaisa === undefined &&
      maintenanceData.amount !== undefined
    ) {
      maintenanceData.amountPaisa = rupeesToPaisa(maintenanceData.amount);
    }
    if (
      maintenanceData.paidAmountPaisa === undefined &&
      maintenanceData.paidAmount !== undefined
    ) {
      maintenanceData.paidAmountPaisa = rupeesToPaisa(
        maintenanceData.paidAmount,
      );
    }

    // Denormalize Nepali scheduled date fields at write time so they are
    // queryable via the compound index without a runtime conversion.
    if (maintenanceData.scheduledDate) {
      const { npYear, npMonth } = getNepaliYearMonthFromDate(
        maintenanceData.scheduledDate,
      );
      maintenanceData.scheduledNepaliYear = npYear;
      maintenanceData.scheduledNepaliMonth = npMonth; // 1-based
    }

    const maintenance = await Maintenance.create(maintenanceData);

    if (maintenanceData.assignedTo) {
      const populated = await Maintenance.findById(maintenance._id)
        .populate("assignedTo", "name email")
        .populate("property", "name")
        .populate("unit", "name");

      _notifyAssignedStaff(populated);
    }
    _notifyAllAdmins({
      type: "MAINTENANCE_CREATED",
      title: "New Maintenance Task",
      message: `A new maintenance task "${maintenance.title}" (${maintenance.priority} priority) has been created, scheduled for ${new Date(maintenance.scheduledDate).toLocaleDateString()}.`,
      data: {
        maintenanceId: maintenance._id,
        title: maintenance.title,
        priority: maintenance.priority,
      },
    });

    return {
      success: true,
      message: "Maintenance task created successfully",
      data: maintenance,
    };
  } catch (error) {
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
      .populate("createdBy")
      .populate("assignedTo", "name email phone");

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
      .populate("createdBy")
      .populate("assignedTo", "name email phone");

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

/**
 * Update maintenance status + payment info.
 *
 * ─── Nepali date handling ─────────────────────────────────────────────────────
 * The frontend sends { nepaliDate, nepaliMonth, nepaliYear } from the
 * DualCalendarTailwind picker. If any of these are missing the service
 * derives them from the current server time using getNepaliYearMonthFromDate()
 * (Nepali calendar), NOT from JS Date.getMonth() which returns an English
 * month index.
 *
 * ─── Overpayment handling ────────────────────────────────────────────────────
 * findByIdAndUpdate bypasses Mongoose pre-save hooks, so the model-level
 * guard never fires on status updates. Business rules are enforced here.
 *
 * If allowOverpayment:true is passed the check is skipped and paymentStatus
 * is automatically set to "overpaid" so accounting can flag it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function updateMaintenanceStatus(
  id,
  status,
  paymentStatus,
  paidAmountRupees = null, // rupees value from the controller (req.body.paidAmount)
  lastPaidBy = null,
  options = {},
) {
  const existing = await Maintenance.findById(id);
  if (!existing) {
    return {
      success: false,
      message: "Maintenance task not found",
      data: null,
      expense: null,
    };
  }

  // ── Guard: invalid status transitions ────────────────────────────────────
  // Industry standard: use a state machine / adjacency list rather than
  // allowing free transitions, to prevent re-opening completed tasks and
  // accidental double-expense creation.
  const ALLOWED_TRANSITIONS = {
    OPEN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["OPEN", "COMPLETED", "CANCELLED"],
    COMPLETED: [], // terminal — no transitions allowed
    CANCELLED: [], // terminal — no transitions allowed
  };

  const currentStatus = existing.status;
  if (
    currentStatus !== status && // allow no-op patches
    !ALLOWED_TRANSITIONS[currentStatus]?.includes(status)
  ) {
    return {
      success: false,
      message: `Cannot transition from ${currentStatus} to ${status}.`,
      data: null,
      expense: null,
    };
  }

  // ── Guard: block payment on CANCELLED tasks ──────────────────────────────
  if (
    status === "CANCELLED" &&
    paidAmountRupees !== null &&
    paidAmountRupees > 0
  ) {
    return {
      success: false,
      message: "Cannot record a payment on a cancelled task.",
      data: null,
      expense: null,
    };
  }

  // ── Resolve the paid amount in paisa ──────────────────────────────────────
  const finalPaidAmountPaisa =
    paidAmountRupees !== null ? rupeesToPaisa(paidAmountRupees) : null;

  // ── Overpayment guard ─────────────────────────────────────────────────────
  // Only validate when a paid amount is being set and the task has an estimate.
  // Zero-estimate tasks (amountPaisa === 0) skip this because the admin may
  // not have set a budget yet.
  const estimatedPaisa = existing.amountPaisa ?? 0;

  if (
    finalPaidAmountPaisa !== null &&
    estimatedPaisa > 0 &&
    finalPaidAmountPaisa > estimatedPaisa
  ) {
    if (!options.allowOverpayment) {
      // Return a structured error so the controller sends 409 with
      // isOverpayment:true — the frontend uses this flag to show a
      // confirmation dialog instead of a generic error toast.
      return {
        success: false,
        isOverpayment: true,
        message: `Paid amount (₹${paidAmountRupees}) exceeds estimated amount (₹${estimatedPaisa / 100}). Confirm to proceed.`,
        overpaymentDiffRupees: (finalPaidAmountPaisa - estimatedPaisa) / 100,
        data: null,
        expense: null,
      };
    }

    // Overpayment explicitly confirmed — mark it so accounting is aware
    paymentStatus = "overpaid";
  }

  // ── Resolve Nepali date for the expense record ────────────────────────────
  // Priority: frontend-supplied values → server-derived Nepali date.
  //
  // BUG FIX: The old code fell back to now.getMonth() + 1 and now.getFullYear()
  // which are English calendar values. getNepaliYearMonthFromDate converts the
  // current JS Date into the correct Nepali year and 1-based month.
  const now = new Date();
  const { npYear: fallbackNpYear, npMonth: fallbackNpMonth } =
    getNepaliYearMonthFromDate(now);

  const {
    adminId,
    nepaliDate: rawNepaliDate,
    nepaliMonth: rawNepaliMonth,
    nepaliYear: rawNepaliYear,
    allowOverpayment,
    paymentMethod: paymentMethodOption,
    bankAccountId: bankAccountIdOption,
  } = options;

  // Coerce string values coming from req.body to numbers (express body-parser
  // keeps numeric strings as strings unless you use express-validator transforms)
  const resolvedNepaliMonth =
    typeof rawNepaliMonth === "number"
      ? rawNepaliMonth
      : Number.isFinite(Number(rawNepaliMonth))
        ? Number(rawNepaliMonth)
        : fallbackNpMonth; // ← Nepali month, not English

  const resolvedNepaliYear =
    typeof rawNepaliYear === "number"
      ? rawNepaliYear
      : Number.isFinite(Number(rawNepaliYear))
        ? Number(rawNepaliYear)
        : fallbackNpYear; // ← Nepali year, not English

  const resolvedNepaliDate = rawNepaliDate ? new Date(rawNepaliDate) : now;

  // ── Build update fields ───────────────────────────────────────────────────
  const updateFields = { status, paymentStatus };

  if (finalPaidAmountPaisa !== null) {
    updateFields.paidAmountPaisa = finalPaidAmountPaisa;
  }
  if (lastPaidBy) updateFields.lastPaidBy = lastPaidBy;

  // Denormalize completion Nepali date when the task is being completed
  if (status === "COMPLETED") {
    updateFields.completedAt = now;
    updateFields.completionNepaliDate = resolvedNepaliDate;
    updateFields.completionNepaliMonth = resolvedNepaliMonth;
    updateFields.completionNepaliYear = resolvedNepaliYear;
  }

  const updatedTask = await Maintenance.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { new: true },
  );

  // ── Auto-create expense on COMPLETED + paid/overpaid ─────────────────────
  let expense = null;
  const isCompleted = updatedTask?.status === "COMPLETED";
  const isSettled = ["paid", "overpaid"].includes(updatedTask?.paymentStatus);

  if (isCompleted && isSettled) {
    const resolvedPaidPaisa = updatedTask.paidAmountPaisa ?? 0;

    if (resolvedPaidPaisa > 0) {
      // Idempotency guard: never create a second expense for the same task
      const existingExpense = await Expense.findOne({
        referenceType: "MAINTENANCE",
        referenceId: updatedTask._id,
      });

      if (existingExpense) {
        expense = existingExpense;
      } else {
        const maintenanceSource = await ExpenseSource.findOne({
          code: ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_SOURCE_CODE,
        });

        if (!maintenanceSource) {
          throw new Error(
            "Maintenance ExpenseSource with code MAINTENANCE not found",
          );
        }

        const payeeType = updatedTask.tenant ? "TENANT" : "EXTERNAL";

        const expenseData = {
          source: maintenanceSource._id,
          amountPaisa: resolvedPaidPaisa,
          amount: resolvedPaidPaisa / 100,
          EnglishDate: now,
          // Use the resolved Nepali values — these are now guaranteed to be
          // Nepali calendar values, not English month/year.
          nepaliDate: resolvedNepaliDate,
          nepaliMonth: resolvedNepaliMonth,
          nepaliYear: resolvedNepaliYear,
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
          ...(paymentMethodOption && { paymentMethod: paymentMethodOption }),
          ...(bankAccountIdOption && { bankAccountId: bankAccountIdOption }),
        };

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
  if (status === "COMPLETED") {
    _notifyAllAdmins({
      type: "MAINTENANCE_COMPLETED",
      title: "Maintenance Task Completed",
      message: `Maintenance task "${updatedTask.title}" has been marked as completed.`,
      data: {
        maintenanceId: updatedTask._id,
        title: updatedTask.title,
        paidAmountPaisa: updatedTask.paidAmountPaisa,
      },
    });
  }

  if (status === "CANCELLED") {
    _notifyAllAdmins({
      type: "MAINTENANCE_CANCELLED",
      title: "Maintenance Task Cancelled",
      message: `Maintenance task "${updatedTask.title}" has been cancelled.`,
      data: { maintenanceId: updatedTask._id, title: updatedTask.title },
    });
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
    .populate("unit", "name")
    .populate("property", "name")
    .populate("block")
    .populate("createdBy");

  if (assignedTo) {
    _notifyAssignedStaff(updated);
    _notifyAllAdmins({
      type: "MAINTENANCE_ASSIGNED",
      title: "Maintenance Task Reassigned",
      message: `"${updated.title}" has been assigned to ${updated.assignedTo?.name || "a staff member"}.`,
      data: {
        maintenanceId: updated._id,
        title: updated.title,
        assignedTo: updated.assignedTo?.name,
      },
    });
  }

  return {
    success: true,
    message: "Assignment updated successfully",
    data: updated,
  };
}

export async function getMaintenanceByTenantId(tenantId) {
  const maintenance = await Maintenance.find({ tenant: tenantId })
    .populate("tenant")
    .populate("unit")
    .populate("property")
    .populate("block")
    .populate("createdBy");
  return {
    success: true,
    message: "Maintenance tasks fetched successfully",
    data: maintenance,
  };
}
