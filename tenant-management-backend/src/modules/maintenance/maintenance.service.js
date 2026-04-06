import { Maintenance } from "./Maintenance.Model.js";
import { Expense } from "../expenses/Expense.Model.js";
import ExpenseSource from "../expenses/ExpenseSource.Model.js";
import { createExpense } from "../expenses/expense.service.js";
import { ACCOUNTING_CONFIG } from "../../config/accounting.config.js";
import { rupeesToPaisa } from "../../utils/moneyUtil.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";
import { sendMaintenanceAssignmentEmail } from "../../config/nodemailer.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";
import { Block } from "../blocks/Block.Model.js";
import InnerBlock from "../blocks/innerBlocks/InnerBlock.Model.js";
import { Unit } from "../units/unit.model.js";

// ─── Notification helpers ─────────────────────────────────────────────────────

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

  createAndEmitNotification({
    type: "MAINTENANCE_ASSIGNED",
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
    adminIds: [staff._id.toString()],
  }).catch((err) =>
    console.error("[maintenance] failed to emit assignment notification:", err),
  );
}

function _notifyAllAdmins({ type, title, message, data }) {
  createAndEmitNotification({ type, title, message, data }).catch((err) =>
    console.error(`[maintenance] failed to emit ${type} notification:`, err),
  );
}

// ─── Entity resolver ──────────────────────────────────────────────────────────
/**
 * Resolve the OwnershipEntity for a maintenance task by walking the hierarchy:
 *   unit → InnerBlock → Block → OwnershipEntity
 *   block → OwnershipEntity  (fallback when no unit)
 *
 * Returns the entityId ObjectId, or null if the hierarchy is incomplete.
 * Never throws — callers handle null.
 */
async function resolveEntityFromHierarchy({
  unitId,
  blockId,
  maintenanceData,
}) {
  if (!maintenanceData.scope) {
    if (maintenanceData.unit) maintenanceData.scope = "UNIT";
    else if (maintenanceData.block) maintenanceData.scope = "BLOCK";
    else if (maintenanceData.property) maintenanceData.scope = "PROPERTY";
  }

  // ✅ These must be declared before use
  let innerBlockId = null;
  let directBlockId = blockId ?? null;

  if (unitId) {
    const unit = await Unit.findById(unitId).select("innerBlock block").lean();
    innerBlockId = unit?.innerBlock ?? null;
    console.log("innerBlockId", innerBlockId);
    directBlockId = unit?.block ?? blockId ?? null;
    console.log("directBlockId", directBlockId);
  }

  if (innerBlockId) {
    const innerBlock = await InnerBlock.findById(innerBlockId)
      .select("block")
      .lean();
    if (innerBlock?.block) {
      const block = await Block.findById(innerBlock.block)
        .select("ownershipEntityId")
        .lean();
      if (block?.ownershipEntityId) {
        return { entityId: block.ownershipEntityId, blockId: innerBlock.block };
      }
    }
  }

  if (directBlockId) {
    const block = await Block.findById(directBlockId)
      .select("ownershipEntityId")
      .lean();
    if (block?.ownershipEntityId) {
      return { entityId: block.ownershipEntityId, blockId: directBlockId };
    }
  }

  if (blockId) {
    const block = await Block.findById(blockId)
      .select("ownershipEntityId")
      .lean();
    if (block?.ownershipEntityId) {
      return { entityId: block.ownershipEntityId, blockId };
    }
  }

  return { entityId: null, blockId: null };
}
// ─── Role constants ───────────────────────────────────────────────────────────
// Centralised here so the service never imports from Express or req objects.
// Controllers resolve req.admin.role → one of these strings before calling.
const ROLE = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  STAFF: "staff",
};
const ALLOWED_TRANSITIONS = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["OPEN", "PENDING_SETTLEMENT", "CANCELLED"],
  PENDING_SETTLEMENT: ["CANCELLED"], // admin can cancel even after work is done
  COMPLETED: [], // terminal
  CANCELLED: [], // terminal
};

// ─── Service functions ────────────────────────────────────────────────────────

export async function createMaintenance(maintenanceData) {
  try {
    console.log("maintenanceData", maintenanceData);
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

    if (maintenanceData.scheduledDate) {
      const { npYear, npMonth } = getNepaliYearMonthFromDate(
        maintenanceData.scheduledDate,
      );
      maintenanceData.scheduledNepaliYear = npYear;
      maintenanceData.scheduledNepaliMonth = npMonth;
    }

    if (!maintenanceData.entityId) {
      const { entityId: resolvedEntityId, blockId: resolvedBlockId } =
        await resolveEntityFromHierarchy({
          unitId: maintenanceData.unit,
          blockId: maintenanceData.block,
          maintenanceData: maintenanceData,
        });
      console.log("resolvedEntityId", resolvedEntityId);
      console.log("resolvedBlockId", resolvedBlockId);
      if (resolvedEntityId) maintenanceData.entityId = resolvedEntityId;
      if (resolvedBlockId && !maintenanceData.block)
        maintenanceData.block = resolvedBlockId;
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

export async function getAllMaintenance(filters = {}) {
  try {
    const {
      status,
      scope,
      propertyId,
      blockId,
      assignedTo,
      sourceType,
      priority,
      nepaliYear,
      nepaliMonth,
      page = 1,
      limit = 30,
    } = filters;

    const query = {};
    if (status) query.status = status;
    if (scope) query.scope = scope;
    if (propertyId) query.property = propertyId;
    if (blockId) query.block = blockId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (sourceType) query.sourceType = sourceType;
    if (priority) query.priority = priority;
    if (nepaliYear) query.scheduledNepaliYear = Number(nepaliYear);
    if (nepaliMonth) query.scheduledNepaliMonth = Number(nepaliMonth);

    const skip = (Number(page) - 1) * Number(limit);

    const [tasks, total] = await Promise.all([
      Maintenance.find(query)
        .populate("tenant", "name")
        .populate("unit", "name")
        .populate("property", "name")
        .populate("block", "name")
        .populate("createdBy", "name")
        .populate("assignedTo", "name email phone profilePicture")
        .sort({ scheduledDate: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Maintenance.countDocuments(query),
    ]);

    return {
      success: true,
      message: "Maintenance tasks fetched successfully",
      data: tasks,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
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
      .populate("assignedTo", "name email phone profilePicture");

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
  { callerId, callerRole } = {},
) {
  const existing = await Maintenance.findById(id);
  if (!existing) {
    return {
      success: false,
      message: "Maintenance task not found",
      data: null,
    };
  }

  const currentStatus = existing.status;

  // ── Guard: valid transition ───────────────────────────────────────────────
  if (
    currentStatus !== status &&
    !ALLOWED_TRANSITIONS[currentStatus]?.includes(status)
  ) {
    return {
      success: false,
      message: `Cannot transition from ${currentStatus} to ${status}.`,
      data: null,
    };
  }

  // ── Guard: COMPLETED is only reachable via settlePayment() ───────────────
  // Double-lock: even if someone calls this function directly with COMPLETED,
  // it is rejected. The only path to COMPLETED is settlePayment().
  if (status === "COMPLETED") {
    return {
      success: false,
      message:
        "Tasks cannot be marked COMPLETED directly. Use the payment settlement flow.",
      data: null,
    };
  }

  // ── Guard: role-based permission ─────────────────────────────────────────
  if (callerRole === ROLE.SUPER_ADMIN || callerRole === ROLE.ADMIN) {
    // Admin tier: cancel only
    if (status !== "CANCELLED" && status !== currentStatus) {
      return {
        success: false,
        message: "Admins can only cancel a maintenance task.",
        data: null,
      };
    }
  } else {
    // STAFF: must be the assigned person
    const assignedId = existing.assignedTo?.toString();
    if (!assignedId || assignedId !== callerId?.toString()) {
      return {
        success: false,
        message:
          "Only the assigned staff member can update this task's status.",
        data: null,
      };
    }
    if (status === "CANCELLED") {
      return {
        success: false,
        message: "Staff cannot cancel a maintenance task. Contact an admin.",
        data: null,
      };
    }
  }

  // ── Apply update ──────────────────────────────────────────────────────────
  const updatedTask = await Maintenance.findByIdAndUpdate(
    id,
    { $set: { status } },
    { returnDocument: "after" },
  );

  // ── Notifications ─────────────────────────────────────────────────────────
  if (status === "PENDING_SETTLEMENT") {
    _notifyAllAdmins({
      type: "MAINTENANCE_PENDING_SETTLEMENT",
      title: "Maintenance Awaiting Payment Settlement",
      message: `"${updatedTask.title}" work has been completed by staff. Payment settlement required.`,
      data: {
        maintenanceId: updatedTask._id,
        title: updatedTask.title,
        priority: updatedTask.priority,
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
  };
}

// ─── settlePayment ────────────────────────────────────────────────────────────
//
// The ONLY function that writes financial data and creates an Expense record.
// Only callable by ADMIN or SUPER_ADMIN.
// Task must be in PENDING_SETTLEMENT status — staff must have completed the
// physical work before any money can be recorded.
//
// This is the accounting gate. Nothing reaches the ledger except through here.

export async function settlePayment(
  id,
  {
    paidAmountRupees,
    paymentStatus,
    paymentMethod,
    bankAccountId,
    contractor,
    nepaliDate: rawNepaliDate,
    nepaliMonth: rawNepaliMonth,
    nepaliYear: rawNepaliYear,
    allowOverpayment = false,
    adminId,
    callerRole,
  } = {},
) {
  // ── Guard: admin-only ─────────────────────────────────────────────────────
  if (callerRole !== ROLE.SUPER_ADMIN && callerRole !== ROLE.ADMIN) {
    return {
      success: false,
      message: "Only admins can record payment settlements.",
      data: null,
      expense: null,
    };
  }

  const existing = await Maintenance.findById(id);
  if (!existing) {
    return {
      success: false,
      message: "Maintenance task not found",
      data: null,
      expense: null,
    };
  }

  // ── Guard: must be in PENDING_SETTLEMENT ──────────────────────────────────
  // Prevents admins from settling a task that staff haven't finished yet,
  // and prevents double-settlement of already-completed tasks.
  if (existing.status !== "PENDING_SETTLEMENT") {
    return {
      success: false,
      message: `Cannot settle payment: task is "${existing.status}". Only tasks with status PENDING_SETTLEMENT can be settled.`,
      data: null,
      expense: null,
    };
  }

  // ── Guard: block payment on zero amount ───────────────────────────────────
  if (!paidAmountRupees || paidAmountRupees <= 0) {
    return {
      success: false,
      message: "A paid amount greater than zero is required to settle.",
      data: null,
      expense: null,
    };
  }

  const finalPaidAmountPaisa = rupeesToPaisa(paidAmountRupees);
  const estimatedPaisa = existing.amountPaisa ?? 0;

  // ── Overpayment guard ─────────────────────────────────────────────────────
  if (estimatedPaisa > 0 && finalPaidAmountPaisa > estimatedPaisa) {
    if (!allowOverpayment) {
      return {
        success: false,
        isOverpayment: true,
        message: `Paid amount (₹${paidAmountRupees}) exceeds estimated amount (₹${estimatedPaisa / 100}). Confirm to proceed.`,
        overpaymentDiffRupees: (finalPaidAmountPaisa - estimatedPaisa) / 100,
        data: null,
        expense: null,
      };
    }
    // Confirmed overpayment — override paymentStatus so accounting flags it
    paymentStatus = "overpaid";
  }

  // ── Resolve Nepali date ───────────────────────────────────────────────────
  const now = new Date();
  const { npYear: fallbackNpYear, npMonth: fallbackNpMonth } =
    getNepaliYearMonthFromDate(now);

  const resolvedNepaliMonth =
    typeof rawNepaliMonth === "number"
      ? rawNepaliMonth
      : Number.isFinite(Number(rawNepaliMonth))
        ? Number(rawNepaliMonth)
        : fallbackNpMonth;

  const resolvedNepaliYear =
    typeof rawNepaliYear === "number"
      ? rawNepaliYear
      : Number.isFinite(Number(rawNepaliYear))
        ? Number(rawNepaliYear)
        : fallbackNpYear;

  const resolvedNepaliDate = rawNepaliDate ? new Date(rawNepaliDate) : now;
  // Re-resolve entityId for legacy tasks created before entity migration.
  let resolvedEntityId = existing.entityId;
  let resolvedBlockId = existing.block ?? null; // ← grab from stored task first

  if (!resolvedEntityId) {
    const resolved = await resolveEntityFromHierarchy({
      unitId: existing.unit,
      blockId: existing.block,
      maintenanceData: existing,
    });
    resolvedEntityId = resolved.entityId;
    resolvedBlockId = resolved.blockId ?? resolvedBlockId; // prefer freshly resolved
  }

  if (!resolvedEntityId) {
    throw new Error(
      `Cannot create expense: maintenance task ${existing._id} has no ` +
        `resolvable entityId. Ensure the unit/block hierarchy is linked to an OwnershipEntity.`,
    );
  }

  // ── Persist financial fields + transition to COMPLETED ────────────────────
  const updateFields = {
    status: "COMPLETED",
    paymentStatus: paymentStatus || "paid",
    paidAmountPaisa: finalPaidAmountPaisa,
    lastPaidBy: adminId,
    completedAt: now,
    completionNepaliDate: resolvedNepaliDate,
    completionNepaliMonth: resolvedNepaliMonth,
    completionNepaliYear: resolvedNepaliYear,
    entityId: resolvedEntityId,
    ...(contractor && { contractor }),
  };

  const updatedTask = await Maintenance.findByIdAndUpdate(
    id,
    { $set: updateFields },
    { returnDocument: "after" },
  );

  // ── Create Expense record ─────────────────────────────────────────────────
  // Idempotency guard: never create a second expense for the same task.
  let expense = null;
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

    const expenseData = {
      source: maintenanceSource._id,
      amountPaisa: finalPaidAmountPaisa,
      amount: paidAmountRupees,
      englishDate: now,
      nepaliDate: rawNepaliDate ?? null,
      nepaliMonth: resolvedNepaliMonth,
      nepaliYear: resolvedNepaliYear,
      payeeType: "EXTERNAL",
      externalPayee: {
        name: updatedTask.contractor?.name || "Contractor",
        type: updatedTask.contractor?.type || "CONTRACTOR",
        ...(updatedTask.contractor?.phone && {
          contactInfo: updatedTask.contractor.phone,
        }),
      },
      referenceType: "MAINTENANCE",
      referenceId: updatedTask._id,
      status: "RECORDED",
      notes:
        updatedTask.completionNotes ||
        "Auto-created from maintenance payment settlement",
      createdBy: adminId || updatedTask.createdBy,
      expenseCode: ACCOUNTING_CONFIG.MAINTENANCE_EXPENSE_CODE,
      entityId: resolvedEntityId,
      blockId: resolvedBlockId,
      transactionScope: "building",
      ...(paymentMethod && { paymentMethod }),
      ...(bankAccountId && { bankAccountId }),
    };

    const result = await createExpense(expenseData);
    if (!result.success) {
      throw new Error(
        result.error || result.message || "Failed to create expense",
      );
    }

    expense = result.data;
  }

  _notifyAllAdmins({
    type: "MAINTENANCE_COMPLETED",
    title: "Maintenance Task Completed",
    message: `Maintenance task "${updatedTask.title}" has been settled and marked complete.`,
    data: {
      maintenanceId: updatedTask._id,
      title: updatedTask.title,
      paidAmountPaisa: updatedTask.paidAmountPaisa,
    },
  });

  return {
    success: true,
    message: "Payment settled and maintenance marked as completed",
    data: updatedTask,
    expense,
  };
}

// ─── updateMaintenanceAssignedTo ──────────────────────────────────────────────
// SUPER_ADMIN only — enforced here, not at the route level.

export async function updateMaintenanceAssignedTo(id, assignedTo, callerRole) {
  if (callerRole !== ROLE.SUPER_ADMIN) {
    return {
      success: false,
      message: "Only a Super Admin can reassign maintenance tasks.",
      data: null,
    };
  }

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
    { returnDocument: "after" },
  )
    .populate("assignedTo", "name email phone profilePicture")
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

export async function getMaintenanceByAssignedStaff(staffId) {
  try {
    const tasks = await Maintenance.find({ assignedTo: staffId })
      .populate("property", "name")
      .populate("unit", "name")
      .populate("tenant", "name")
      .populate("block", "name")
      .sort({ scheduledDate: 1 });

    return {
      success: true,
      message: "Staff maintenance tasks fetched successfully",
      data: tasks,
    };
  } catch (error) {
    throw new Error(error.message || "Failed to fetch staff maintenance tasks");
  }
}
