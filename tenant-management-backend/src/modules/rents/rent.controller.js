import {
  getRentsService,
  getRentByIdService,
  updateRentService,
} from "./rent.service.js";
import handleMonthlyRents from "./rent.service.js";
import { sendEmailToTenants } from "./rent.service.js";

export async function getRentsController(req, res) {
  try {
    const filters = {
      tenantId: req.query.tenantId,
      propertyId: req.query.propertyId,
      status: req.query.status,
      nepaliMonth: req.query.nepaliMonth,
      nepaliYear: req.query.nepaliYear,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const result = await getRentsService(filters);
    return res.status(200).json({
      success: result.success,
      rents: result.rents || [],
      message: result.message || "Rents fetched successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    });
  }
}

export async function getRentsByTenantController(req, res) {
  try {
    const { tenantId } = req.params;
    const result = await getRentsService({ tenantId });
    return res.status(200).json({
      success: result.success,
      rents: result.rents || [],
      message: result.message || "Rents fetched successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Rents fetching failed",
      error: error.message,
    });
  }
}

export async function getRentByIdController(req, res) {
  try {
    const { rentId } = req.params;
    const result = await getRentByIdService(rentId);
    if (!result.success) {
      const status = result.statusCode === 404 ? 404 : 500;
      return res.status(status).json({
        success: false,
        message: result.message || "Rent not found",
      });
    }
    return res.status(200).json({
      success: true,
      rent: result.rent,
      message: "Rent fetched successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Rent fetching failed",
      error: error.message,
    });
  }
}

export async function updateRentController(req, res) {
  try {
    const { rentId } = req.params;
    const result = await updateRentService(rentId, req.body);
    if (!result.success) {
      const status = result.statusCode === 404 ? 404 : 400;
      return res.status(status).json({
        success: false,
        message: result.message,
      });
    }
    return res.status(200).json({
      success: true,
      rent: result.rent,
      message: result.message || "Rent updated successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Rent update failed",
      error: error.message,
    });
  }
}
export async function processMonthlyRents(req, res) {
  try {
    const result = await handleMonthlyRents(req.admin?.id);

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
