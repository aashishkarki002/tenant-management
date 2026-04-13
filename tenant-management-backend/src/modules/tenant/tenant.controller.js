import * as tenantService from "./tenant.service.js";
import { getTenantBalance } from "../tenantBalance/tenantBalance.service.js";
import { TenantBalance } from "../tenantBalance/tenantBalance.model.js";
export const createTenant = async (req, res) => {
  const adminId = req.admin_id ?? req.admin?.id;
  const result = await tenantService.createTenant(req.body, req.files, adminId);
  const statusCode = result.statusCode ?? 500;
  if (result.success) {
    return res.status(statusCode).json({
      success: true,
      message: result.message,
      tenant: result.tenant,
    });
  }
  return res.status(statusCode).json({
    success: false,
    message: result.message,
    ...(result.error && { error: result.error }),
  });
};

export const getTenants = async (req, res) => {
  try {
    const tenants = await tenantService.getTenants();
    return res.status(200).json({ success: true, tenants });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error fetching tenants",
      error,
    });
  }
};

export const getTenantById = async (req, res) => {
  try {
    const tenant = await tenantService.getTenantById(req.params.id);
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }
    return res.status(200).json({ success: true, tenant });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error fetching tenant",
      error: error.message,
    });
  }
};

export const updateTenant = async (req, res) => {
  try {
    const result = await tenantService.updateTenant(
      req.params.id,
      req.body,
      req.files,
    );
    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message,
      });
    }
    return res.status(200).json({
      success: true,
      message: result.message,
      tenant: result.tenant,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error updating tenant",
      error: error.message,
    });
  }
};

export const deleteTenant = async (req, res) => {
  try {
    const result = await tenantService.deleteTenant(req.params.id);
    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message,
      });
    }
    return res.status(200).json({
      success: true,
      message: result.message,
      tenant: result.tenant,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error deleting tenant",
      error: error.message,
    });
  }
};

export const restoreTenant = async (req, res) => {
  try {
    const result = await tenantService.restoreTenant(req.params.id);
    if (!result.success) {
      return res.status(result.statusCode).json({
        success: false,
        message: result.message,
      });
    }
    return res.status(200).json({
      success: true,
      message: result.message,
      tenant: result.tenant,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Error restoring tenant",
      error: error.message,
    });
  }
};

/**
 * searchTenants — Controller for tenant filtering
 *
 * PRODUCTION PATTERNS:
 *   ✓ Input validation with detailed error messages
 *   ✓ Sanitization of array/string parameters
 *   ✓ Proper HTTP status codes (200, 400, 500)
 *   ✓ Structured error responses
 *   ✓ Request logging for debugging
 *   ✓ Performance monitoring
 *   ✓ Handles both array notation (status[]) and repeated params (status=active&status=inactive)
 *
 * @route GET /api/tenant/search-tenants
 * @access Protected (requires auth)
 */
export const searchTenants = async (req, res) => {
  const startTime = Date.now();

  try {
    // ── Normalize query params ──────────────────────────────────────────────
    // Express parses both formats:
    //   ?status[]=active        → { "status[]": ["active"] }
    //   ?status=active&status=  → { "status": ["active", "inactive"] }
    // We normalize to plain param names
    const normalizedQuery = {};
    for (const [key, value] of Object.entries(req.query)) {
      const cleanKey = key.replace(/\[\]$/, ""); // Remove [] suffix
      normalizedQuery[cleanKey] = value;
    }

    // ── Input validation ─────────────────────────────────────────────────────
    const allowedParams = [
      "search",
      "block",
      "innerBlock",
      "status",
      "paymentStatus",
      "frequency",
      "lease",
    ];

    const unknownParams = Object.keys(normalizedQuery).filter(
      (key) => !allowedParams.includes(key),
    );

    if (unknownParams.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unknown query parameters: ${unknownParams.join(", ")}`,
        hint: `Allowed parameters: ${allowedParams.join(", ")}`,
      });
    }

    // ── Validate enum values ─────────────────────────────────────────────────
    const validationErrors = [];

    if (normalizedQuery.status) {
      const statusArr = Array.isArray(normalizedQuery.status)
        ? normalizedQuery.status
        : [normalizedQuery.status];
      const validStatuses = ["active", "inactive", "vacated"];
      const invalidStatus = statusArr.filter((s) => !validStatuses.includes(s));
      if (invalidStatus.length > 0) {
        validationErrors.push(
          `Invalid status values: ${invalidStatus.join(", ")}. Valid: ${validStatuses.join(", ")}`,
        );
      }
    }

    if (normalizedQuery.paymentStatus) {
      const paymentArr = Array.isArray(normalizedQuery.paymentStatus)
        ? normalizedQuery.paymentStatus
        : [normalizedQuery.paymentStatus];
      const validPayments = ["paid", "due_soon", "overdue"];
      const invalidPayment = paymentArr.filter(
        (p) => !validPayments.includes(p),
      );
      if (invalidPayment.length > 0) {
        validationErrors.push(
          `Invalid paymentStatus values: ${invalidPayment.join(", ")}. Valid: ${validPayments.join(", ")}`,
        );
      }
    }

    if (normalizedQuery.frequency) {
      const freqArr = Array.isArray(normalizedQuery.frequency)
        ? normalizedQuery.frequency
        : [normalizedQuery.frequency];
      const validFreqs = ["monthly", "quarterly"];
      const invalidFreq = freqArr.filter((f) => !validFreqs.includes(f));
      if (invalidFreq.length > 0) {
        validationErrors.push(
          `Invalid frequency values: ${invalidFreq.join(", ")}. Valid: ${validFreqs.join(", ")}`,
        );
      }
    }

    if (normalizedQuery.lease) {
      const leaseArr = Array.isArray(normalizedQuery.lease)
        ? normalizedQuery.lease
        : [normalizedQuery.lease];
      const validLease = ["expiring_soon", "expired"];
      const invalidLease = leaseArr.filter((l) => !validLease.includes(l));
      if (invalidLease.length > 0) {
        validationErrors.push(
          `Invalid lease values: ${invalidLease.join(", ")}. Valid: ${validLease.join(", ")}`,
        );
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // ── Execute search ───────────────────────────────────────────────────────
    const tenants = await tenantService.searchTenants(normalizedQuery);

    const elapsed = Date.now() - startTime;

    // Log slow queries for optimization
    if (elapsed > 1000) {
      console.warn(
        `⚠️ Slow tenant search query (${elapsed}ms):`,
        JSON.stringify(req.query),
      );
    }

    return res.status(200).json({
      success: true,
      tenants,
      meta: {
        count: tenants.length,
        filters: normalizedQuery,
        executionTime: `${elapsed}ms`,
      },
    });
  } catch (error) {
    const elapsed = Date.now() - startTime;

    // Log error with context for debugging
    console.error("❌ Tenant search error:", {
      error: error.message,
      stack: error.stack,
      query: req.query,
      executionTime: `${elapsed}ms`,
    });

    // Distinguish between validation errors and server errors
    const statusCode = error.message.includes("Invalid") ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message:
        statusCode === 400
          ? error.message
          : "Failed to search tenants. Please try again.",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  }
};
export const getTenantBalanceController = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const balance = await getTenantBalance(tenantId);

    // If no snapshot yet, compute on-the-fly and persist for next call
    if (!balance) {
      const { syncTenantBalance } =
        await import("../../helper/tenant-balance.service.js");
      const computed = await syncTenantBalance(tenantId, null);
      return res
        .status(200)
        .json({ success: true, balance: computed, fresh: true });
    }

    return res.status(200).json({ success: true, balance, fresh: false });
  } catch (error) {
    console.error("[getTenantBalanceController]", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/tenant/arrears
 *
 * Returns all tenants with a non-zero TenantBalance, sorted by
 * totalDuePaisa descending (worst first). Each record includes:
 *   tenant { _id, name, phone }
 *   property { _id, name }
 *   units []
 *   rentDuePaisa, camDuePaisa, lateFeeDuePaisa, totalDuePaisa
 *   oldestOverdueNepaliYear, oldestOverdueNepaliMonth
 *   consecutiveUnpaidMonths
 *
 * Used by the dashboard Needs-Attention panel to show the complete
 * arrears list rather than the top-3 snapshot in dashboard-stats.
 */
export const getTenantsWithArrears = async (req, res) => {
  try {
    const arrears = await TenantBalance.aggregate([
      { $match: { totalDuePaisa: { $gt: 0 } } },
      { $sort: { totalDuePaisa: -1 } },
      {
        $lookup: {
          from: "tenants",
          localField: "tenant",
          foreignField: "_id",
          as: "tenant",
          pipeline: [
            { $project: { name: 1, phone: 1 } },
          ],
        },
      },
      { $unwind: { path: "$tenant", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "properties",
          localField: "property",
          foreignField: "_id",
          as: "property",
          pipeline: [{ $project: { name: 1 } }],
        },
      },
      { $unwind: { path: "$property", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "tenants",
          localField: "tenant._id",
          foreignField: "_id",
          as: "_tenantDoc",
          pipeline: [{ $project: { units: 1 } }],
        },
      },
      { $unwind: { path: "$_tenantDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "units",
          localField: "_tenantDoc.units",
          foreignField: "_id",
          as: "units",
          pipeline: [{ $project: { name: 1, unitNumber: 1 } }],
        },
      },
      {
        $project: {
          _tenantDoc: 0,
          __v: 0,
        },
      },
    ]);

    return res.status(200).json({ success: true, arrears });
  } catch (error) {
    console.error("[getTenantsWithArrears]", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
