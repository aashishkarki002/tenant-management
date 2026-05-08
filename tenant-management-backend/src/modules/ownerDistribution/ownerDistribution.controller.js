import { createOwnerDistribution, listOwnerDistributions } from "./ownerDistribution.service.js";

export const listDistributions = async (req, res) => {
  try {
    const { entityId, fiscalYear, skip, limit } = req.query;
    const data = await listOwnerDistributions({ entityId, fiscalYear, skip: Number(skip??0), limit: Number(limit??50) });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createDistribution = async (req, res) => {
  try {
    const createdBy = req.user?._id ?? req.user?.id;
    const data = await createOwnerDistribution({ ...req.body, createdBy });
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};
