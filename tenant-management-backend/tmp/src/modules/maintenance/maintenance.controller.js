import {
  createMaintenance,
  getAllMaintenance,
  getMaintenanceById,
  updateMaintenanceStatus,
  updateMaintenanceAssignedTo,
  getMaintenanceByTenantId,
  getMaintenanceByAssignedStaff,
} from "./maintenance.service.js";

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
    const result = await getAllMaintenance();
    return res.status(200).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
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

export async function updateMaintenanceStatusController(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.admin.id;

    const {
      paymentStatus,
      paidAmount,
      lastPaidBy,
      status,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      // Frontend sends this flag after the user confirms the overpayment dialog
      allowOverpayment = false,
      paymentMethod,
      bankAccountId,
      // Contractor is assigned when transitioning to IN_PROGRESS
      contractor,
    } = req.body;

    const validStatuses = ["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${validStatuses.join(", ")}`,
      });
    }

    const result = await updateMaintenanceStatus(
      id,
      status,
      paymentStatus,
      paidAmount ?? null,
      lastPaidBy ?? null,
      {
        adminId,
        nepaliDate,
        nepaliMonth,
        nepaliYear,
        allowOverpayment,
        paymentMethod: paymentMethod || null,
        bankAccountId: bankAccountId || null,
        contractor: contractor || null,
      },
    );

    // ── Overpayment confirmation required ─────────────────────────────────
    // The service returns success:false + isOverpayment:true when the paid
    // amount exceeds the estimate and the client hasn't confirmed yet.
    // 409 Conflict is the semantic fit: the request is valid but conflicts
    // with the current resource state (budget constraint).
    if (!result.success && result.isOverpayment) {
      return res.status(409).json({
        success: false,
        isOverpayment: true,
        message: result.message,
        overpaymentDiffRupees: result.overpaymentDiffRupees,
      });
    }

    const statusCode = result.success ? 200 : 404;
    return res.status(statusCode).json({
      success: result.success,
      message: result.message,
      maintenance: result.data,
      expense: result.expense || null,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function updateMaintenanceAssignedToController(req, res) {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;
    const result = await updateMaintenanceAssignedTo(id, assignedTo || null);
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
// ─── ADD THIS CONTROLLER to maintenance.controller.js ────────────────────────
//
// GET /api/maintenance/my-tasks
// Auth: protect middleware — staffId is always taken from the verified JWT,

export async function getMyMaintenanceTasksController(req, res) {
  try {
    const staffId = req.admin.id; // set by the protect middleware — trusted
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
