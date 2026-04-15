import {
  preflightCheck,
  takeSnapshot,
  executeSwitch,
  rollbackMigration,
  getMigrationStatus,
  getAuditLog,
} from "./migration.service.js";

export const preflight = async (req, res) => {
  try {
    const { blockId } = req.params;
    const result = await preflightCheck(blockId);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const startMigration = async (req, res) => {
  try {
    const { blockId, targetEntityId, acknowledgedWarnings } = req.body;

    if (!blockId || !targetEntityId) {
      return res.status(400).json({
        success: false,
        message: "blockId and targetEntityId are required",
      });
    }

    // Re-run preflight inside start to guard against race conditions
    const check = await preflightCheck(blockId);
    if (!check.canMigrate) {
      return res.status(409).json({
        success: false,
        message: "Preflight check failed",
        issues: check.issues,
        warnings: check.warnings,
      });
    }

    if (check.warnings.length > 0 && !acknowledgedWarnings) {
      return res.status(409).json({
        success: false,
        message: "Warnings must be acknowledged before proceeding",
        issues: check.issues,
        warnings: check.warnings,
      });
    }

    // Fetch the block's current entity for the snapshot
    const { Block } = await import("../blocks/Block.Model.js");
    const block = await Block.findById(blockId).select("ownershipEntityId").lean();
    const fromEntityId = block?.ownershipEntityId;

    const snapshot = await takeSnapshot(blockId, fromEntityId, targetEntityId, req.admin.id);
    await executeSwitch(blockId, targetEntityId, snapshot._id, req.admin.id);

    const status = await getMigrationStatus(blockId);
    res.status(200).json({
      success: true,
      message: "Migration completed successfully",
      data: status,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const rollback = async (req, res) => {
  try {
    const { snapshotId } = req.params;
    await rollbackMigration(snapshotId, req.admin.id);
    res.status(200).json({
      success: true,
      message: "Migration rolled back successfully",
    });
  } catch (err) {
    const status = err.message.includes("expired") ? 410 : 500;
    res.status(status).json({ success: false, message: err.message });
  }
};

export const status = async (req, res) => {
  try {
    const { blockId } = req.params;
    const data = await getMigrationStatus(blockId);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const auditLog = async (req, res) => {
  try {
    const data = await getAuditLog();
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
