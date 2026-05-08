import { createVendorBill, payVendorBill, listVendorBills } from "./vendorBills.service.js";

export const listBills = async (req, res) => {
  try {
    const { entityId, status, fiscalYear, skip, limit } = req.query;
    const data = await listVendorBills({ entityId, status, fiscalYear, skip: Number(skip??0), limit: Number(limit??50) });
    res.json({ success: true, data });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
};

export const createBill = async (req, res) => {
  try {
    const createdBy = req.user?._id ?? req.user?.id;
    const data = await createVendorBill({ ...req.body, createdBy });
    res.status(201).json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};

export const payBill = async (req, res) => {
  try {
    const paidBy = req.user?._id ?? req.user?.id;
    const { billId } = req.params;
    const data = await payVendorBill({ billId, ...req.body, paidBy });
    res.json({ success: true, data });
  } catch (e) { res.status(400).json({ success: false, message: e.message }); }
};
