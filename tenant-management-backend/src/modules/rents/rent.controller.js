import { Rent } from "./rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
async function createRent(req, res) {
  try {
    const { tenantId, month, year } = req.body;

    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }
    const exists = await Rent.findOne({ tenant: tenant.id, month, year });
    if (exists) {
      return res
        .status(400)
        .json({ success: false, message: "Rent already exists" });
    }
    const rent = await Rent.create({
      tenant: tenant.id,
      innerBlock: tenant.innerBlock,
      block: tenant.block,
      property: tenant.property,
      rentAmount: tenant.totalRent,

      month,
      year,
      createdBy: req.admin.id,
    });
    res
      .status(201)
      .json({ success: true, message: "Rent created successfully", rent });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Rent creation failed", error: error });
  }
}
export default createRent;
export async function getRentsFiltered(req, res) {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res
        .status(400)
        .json({ success: false, message: "Month and year are required" });
    }

    const rents = await Rent.find({
      month: Number(month),
      year: Number(year),
    })
      .populate("tenant")
      .populate("innerBlock")
      .populate("block")
      .populate("property");

    res.status(200).json({
      success: true,
      count: rents.length,
      rents,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    });
  }
}

export async function getRents(req, res) {
  try {
    const rents = await Rent.find()
      .populate("tenant")
      .populate("innerBlock")
      .populate("block")
      .populate("property");
    res.status(200).json({ success: true, rents });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Rents fetching failed", error: error });
  }
}
