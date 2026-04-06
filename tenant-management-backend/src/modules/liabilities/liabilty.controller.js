import { createLiability } from "./liabilty.service.js";
import { getAllLiabilities } from "./liabilty.service.js";

export async function createLiabilityController(req, res) {
  try {
    const adminId = req.admin.id;
    const liabilityData = {
      ...req.body,
      createdBy: adminId,
    };
    const result = await createLiability(liabilityData);
    res.status(201).json({
      success: result.success,
      message: result.message,
      liability: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getAllLiabilitiesController(req, res) {
  try {
    const { referenceType, status, payeeType, nepaliYear, nepaliMonth, npYear, npMonth } = req.query;
    const data = await getAllLiabilities({
      referenceType: referenceType || null,
      status: status || null,
      payeeType: payeeType || null,
      nepaliYear: nepaliYear ? Number(nepaliYear) : null,
      nepaliMonth: nepaliMonth ? Number(nepaliMonth) : null,
      // Accept legacy query params during transition
      npYear: npYear ? Number(npYear) : null,
      npMonth: npMonth ? Number(npMonth) : null,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("[liabilities] getAll error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch liabilities" });
  }
}
