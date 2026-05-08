import { vacateSettlementService } from "./vacateSettlement.service.js";

/**
 * POST /api/vacate/compute
 * Compute settlement preview without posting journals.
 * Body: { tenantId, entityId, vacateDate, writeOffBadDebt, maintenanceDeductionPaisa,
 *          paymentMethod, bankAccountCode, notes }
 */
export const computeSettlement = async (req, res) => {
  try {
    const {
      tenantId,
      entityId,
      vacateDate,
      writeOffBadDebt = false,
      maintenanceDeductionPaisa = 0,
      paymentMethod = "cash",
      bankAccountCode,
      notes,
    } = req.body;

    if (!tenantId || !entityId || !vacateDate) {
      return res.status(400).json({
        success: false,
        message: "tenantId, entityId, and vacateDate are required",
      });
    }

    const result = await vacateSettlementService.compute({
      tenantId,
      entityId,
      vacateDate: new Date(vacateDate),
      writeOffBadDebt,
      maintenanceDeductionPaisa: Number(maintenanceDeductionPaisa),
      paymentMethod,
      bankAccountCode,
      notes,
      createdBy: req.admin.id,
    });

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[vacate] computeSettlement:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/vacate/execute
 * Execute the settlement: post all journals, lock ledger.
 * Body: { tenantId, entityId, paymentMethod, bankAccountCode, writeOffBadDebt, notes }
 */
export const executeSettlement = async (req, res) => {
  try {
    const {
      tenantId,
      entityId,
      paymentMethod = "cash",
      bankAccountCode,
      writeOffBadDebt = false,
      notes,
    } = req.body;

    if (!tenantId || !entityId) {
      return res.status(400).json({
        success: false,
        message: "tenantId and entityId are required",
      });
    }

    const result = await vacateSettlementService.execute({
      tenantId,
      entityId,
      settledBy: req.admin.id,
      paymentMethod,
      bankAccountCode,
      writeOffBadDebt,
      notes,
    });

    res.status(200).json({
      success: true,
      data: result,
      message: "Tenant vacate settlement completed. Ledger locked.",
    });
  } catch (err) {
    console.error("[vacate] executeSettlement:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/vacate/tenant/:tenantId
 */
export const getByTenant = async (req, res) => {
  try {
    const result = await vacateSettlementService.getByTenant(req.params.tenantId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[vacate] getByTenant:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/vacate?entityId=&status=
 */
export const listSettlements = async (req, res) => {
  try {
    const { entityId, status } = req.query;
    if (!entityId) {
      return res.status(400).json({ success: false, message: "entityId is required" });
    }
    const results = await vacateSettlementService.listByEntity(entityId, status);
    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error("[vacate] listSettlements:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
