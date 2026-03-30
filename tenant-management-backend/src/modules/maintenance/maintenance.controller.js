import {
  createMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  updateMaintenanceStatus,
  settlePayment,
  updateMaintenanceAssignedTo,
  getMaintenanceByTenantId,
  getMaintenanceByAssignedStaff,
} from "./maintenance.service.js";

// ─── Role helper ──────────────────────────────────────────────────────────────
// Maps req.admin.role (DB enum) → the lowercase key the service layer uses.
// Centralised here so every controller gets the same mapping.
function resolveCallerRole(role) {
  switch (role) {
    case "SUPER_ADMIN":
      return "super_admin";
    case "ADMIN":
      return "admin";
    default:
      return "staff";
  }
}

// ─── Shared response helper ───────────────────────────────────────────────────
// Keeps controller bodies thin. Maps service result → HTTP status code.
// Rule: not found → 404, auth/business rejection → 403, success → provided code.
function sendResult(res, result, successStatus = 200) {
  if (!result.success) {
    const isNotFound = result.message?.toLowerCase().includes("not found");
    return res.status(isNotFound ? 404 : 403).json({
      success: false,
      message: result.message,
    });
  }
  return res.status(successStatus).json(result);
}

// ─── Controllers ─────────────────────────────────────────────────────────────

export async function createMaintenanceController(req, res) {
  try {
    const adminId = req.admin.id;
    const maintenanceData = { ...req.body, createdBy: adminId };
    const result = await createMaintenance(maintenanceData);
    return res.status(201).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
    });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getAllMaintenanceController(req, res) {
  try {
    // All filter keys are optional — missing ones are just ignored in the service
    const result = await getAllMaintenance(req.query);
    return res.status(200).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMaintenanceByIdController(req, res) {
  try {
    const { id } = req.params;
    const result = await getMaintenanceById(id);
    const statusCode = result.success ? 200 : 404;
    return res.status(statusCode).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PATCH /:id/status ────────────────────────────────────────────────────────
// Handles lifecycle transitions that do NOT involve money:
//   OPEN ↔ IN_PROGRESS → PENDING_SETTLEMENT
//   any  → CANCELLED
//
// Financial fields in req.body are ignored entirely — they cannot reach the
// service through this endpoint. Payment settlement has its own endpoint below.

export async function updateMaintenanceStatusController(req, res) {
  try {
    const { id } = req.params;
    const callerId = req.admin.id;
    const callerRole = resolveCallerRole(req.admin.role);
    const { status } = req.body;

    const validStatuses = [
      "OPEN",
      "IN_PROGRESS",
      "PENDING_SETTLEMENT",
      "CANCELLED",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${validStatuses.join(", ")}`,
      });
    }

    const result = await updateMaintenanceStatus(id, status, {
      callerId,
      callerRole,
    });
    return sendResult(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PATCH /:id/settle ────────────────────────────────────────────────────────
// Admin-only. Accepts all financial fields, creates the Expense record, and
// transitions the task from PENDING_SETTLEMENT → COMPLETED.
//
// This is the ONLY endpoint that writes financial data. Staff cannot reach it
// because the service enforces callerRole === admin|super_admin.

export async function settlePaymentController(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;
    const callerRole = resolveCallerRole(req.admin.role);

    const {
      paidAmount,
      paymentStatus,
      paymentMethod,
      bankAccountId,
      contractor,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      allowOverpayment = false,
    } = req.body;

    const result = await settlePayment(id, {
      paidAmountRupees: paidAmount,
      paymentStatus,
      paymentMethod: paymentMethod || null,
      bankAccountId: bankAccountId || null,
      contractor: contractor || null,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      allowOverpayment,
      adminId,
      callerRole,
    });

    // Overpayment confirmation required — 409 signals the frontend to show
    // a confirmation dialog instead of a generic error toast.
    if (!result.success && result.isOverpayment) {
      return res.status(409).json({
        success: false,
        isOverpayment: true,
        message: result.message,
        overpaymentDiffRupees: result.overpaymentDiffRupees,
      });
    }

    return sendResult(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─── PATCH /:id/assign ────────────────────────────────────────────────────────
// SUPER_ADMIN only — enforced in the service.

export async function updateMaintenanceAssignedToController(req, res) {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const callerRole = resolveCallerRole(req.admin.role);

    const result = await updateMaintenanceAssignedTo(
      id,
      assignedTo || null,
      callerRole,
    );
    return sendResult(res, result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMaintenanceByTenantIdController(req, res) {
  try {
    const tenantId = req.params.id;
    const result = await getMaintenanceByTenantId(tenantId);
    return res.status(200).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getMyMaintenanceTasksController(req, res) {
  try {
    const staffId = req.admin.id;
    const result = await getMaintenanceByAssignedStaff(staffId);
    return res.status(200).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
