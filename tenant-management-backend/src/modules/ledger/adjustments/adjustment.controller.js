import { adjustmentService } from "./adjustment.service.js";

/**
 * POST /api/adjustments
 * Body: { entityId, type, amountPaisa, revenueAccountCode, entries,
 *          reason, description, originalTransactionId, tenantId, propertyId, transactionDate }
 */
export const postAdjustment = async (req, res) => {
  try {
    const {
      entityId,
      type,
      amountPaisa,
      revenueAccountCode,
      entries,
      reason,
      description,
      originalTransactionId,
      tenantId,
      propertyId,
      transactionDate,
    } = req.body;

    if (!entityId || !type || !reason || !description) {
      return res.status(400).json({
        success: false,
        message: "entityId, type, reason, and description are required",
      });
    }

    const result = await adjustmentService.postAdjustment({
      entityId,
      type,
      amountPaisa: amountPaisa ? Number(amountPaisa) : undefined,
      revenueAccountCode,
      entries,
      reason,
      description,
      originalTransactionId,
      tenantId,
      propertyId,
      transactionDate,
      createdBy: req.admin.id,
    });

    res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error("[adjustments] postAdjustment:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/adjustments?entityId=&type=&tenantId=&nepaliYear=&nepaliMonth=&page=&limit=
 */
export const listAdjustments = async (req, res) => {
  try {
    const result = await adjustmentService.list(req.query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[adjustments] listAdjustments:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
