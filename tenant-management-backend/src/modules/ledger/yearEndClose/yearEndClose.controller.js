import { yearEndCloseService } from "./yearEndClose.service.js";

/**
 * GET /api/year-end-close/status?entityId=&fiscalYear=
 */
export const getYearStatus = async (req, res) => {
  try {
    const { entityId, fiscalYear } = req.query;
    if (!entityId || !fiscalYear) {
      return res.status(400).json({ success: false, message: "entityId and fiscalYear are required" });
    }
    const result = await yearEndCloseService.getYearStatus(entityId, Number(fiscalYear));
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("[year-end-close] getYearStatus:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/year-end-close/history?entityId=
 */
export const getCloseHistory = async (req, res) => {
  try {
    const { entityId } = req.query;
    if (!entityId) {
      return res.status(400).json({ success: false, message: "entityId is required" });
    }
    const history = await yearEndCloseService.getCloseHistory(entityId);
    res.status(200).json({ success: true, data: history });
  } catch (err) {
    console.error("[year-end-close] getCloseHistory:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/year-end-close/close
 * Body: { entityId, fiscalYear, closeNote }
 */
export const closeYear = async (req, res) => {
  try {
    const { entityId, fiscalYear, closeNote } = req.body;
    if (!entityId || !fiscalYear) {
      return res.status(400).json({ success: false, message: "entityId and fiscalYear are required" });
    }
    const result = await yearEndCloseService.closeYear({
      entityId,
      fiscalYear: Number(fiscalYear),
      closedBy: req.admin.id,
      closeNote,
    });
    res.status(200).json({ success: true, data: result, message: `FY ${fiscalYear} closed successfully` });
  } catch (err) {
    console.error("[year-end-close] closeYear:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * POST /api/year-end-close/reopen
 * Body: { entityId, fiscalYear, reopenNote }
 */
export const reopenYear = async (req, res) => {
  try {
    const { entityId, fiscalYear, reopenNote } = req.body;
    if (!entityId || !fiscalYear || !reopenNote?.trim()) {
      return res.status(400).json({
        success: false,
        message: "entityId, fiscalYear, and reopenNote are required",
      });
    }
    const result = await yearEndCloseService.reopenYear({
      entityId,
      fiscalYear: Number(fiscalYear),
      reopenedBy: req.admin.id,
      reopenNote,
    });
    res.status(200).json({ success: true, data: result, message: `FY ${fiscalYear} reopened` });
  } catch (err) {
    console.error("[year-end-close] reopenYear:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};
