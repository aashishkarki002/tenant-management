import { receiveAdvanceRent, recognizeAdvanceRent, listAdvanceRents } from "./advanceRent.service.js";

export const listAdvances = async (req, res) => {
  try {
    const { entityId, tenantId, status, skip, limit } = req.query;
    const data = await listAdvanceRents({ entityId, tenantId, status, skip: Number(skip??0), limit: Number(limit??50) });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const receiveAdvance = async (req, res) => {
  try {
    const createdBy = req.user?._id ?? req.user?.id;
    const data = await receiveAdvanceRent({ ...req.body, createdBy });
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const recognizeAdvance = async (req, res) => {
  try {
    const createdBy = req.user?._id ?? req.user?.id;
    const { advanceRentId } = req.params;
    const data = await recognizeAdvanceRent({ advanceRentId, ...req.body, createdBy });
    res.json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};
