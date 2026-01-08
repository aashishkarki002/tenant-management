import { Rent } from "./rent.Model.js";
import handleMonthlyRents from "./rent.service.js";
import { sendEmailToTenants } from "./rent.service.js";
export async function getRents(req, res) {
  try {
    const rents = await Rent.find()
      .populate({
        path: "tenant",
        match: { isDeleted: false },
      })
      .populate("innerBlock")
      .populate("block")
      .populate("property")
      .populate("units");
    const filteredRents = rents.filter((rent) => rent.tenant !== null);
    res.status(200).json({ success: true, rents: filteredRents });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: "Rents fetching failed", error: error });
  }
}
export async function processMonthlyRents(req, res) {
  try {
    const result = await handleMonthlyRents();

    res.status(200).json({
      success: result.success,
      message: result.message,
      createdCount: result.createdCount || 0,
      updatedOverdueCount: result.updatedOverdueCount || 0,
      error: result.error || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Monthly rent processing failed",
      error: error.message,
    });
  }
}
export async function sendEmailToTenantsController(req, res) {
  try {
    const result = await sendEmailToTenants();
    res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Email sending failed",
      error: error.message,
    });
  }
}
