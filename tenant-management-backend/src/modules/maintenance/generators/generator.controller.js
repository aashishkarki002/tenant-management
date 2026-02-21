import {
  createGenerator,
  getAllGenerators,
  getGeneratorById,
  recordDailyCheck,
  recordFuelRefill,
  recordServiceLog,
  updateGeneratorStatus,
} from "./generator.service.js";

export async function createGeneratorController(req, res) {
  try {
    const result = await createGenerator(req.body, req.admin.id);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function getAllGeneratorsController(req, res) {
  try {
    const result = await getAllGenerators();
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function getGeneratorByIdController(req, res) {
  try {
    const result = await getGeneratorById(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

export async function recordDailyCheckController(req, res) {
  try {
    const result = await recordDailyCheck(
      req.params.id,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function recordFuelRefillController(req, res) {
  try {
    const result = await recordFuelRefill(
      req.params.id,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function recordServiceLogController(req, res) {
  try {
    const result = await recordServiceLog(
      req.params.id,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

export async function updateGeneratorStatusController(req, res) {
  try {
    const validStatuses = [
      "RUNNING",
      "IDLE",
      "MAINTENANCE",
      "FAULT",
      "DECOMMISSIONED",
    ];
    const { status } = req.body;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(", ")}`,
      });
    }
    const result = await updateGeneratorStatus(req.params.id, status);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
