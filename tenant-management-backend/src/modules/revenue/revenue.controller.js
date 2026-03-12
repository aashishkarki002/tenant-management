import {
  createRevenue,
  getRevenue,
  getAllRevenue,
  getRevenueSource,
} from "./revenue.service.js";

export async function createRevenueController(req, res) {
  try {
    const adminId = req.admin.id;
    const revenueData = {
      ...req.body,
      createdBy: adminId,
    };
    const result = await createRevenue(revenueData);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }

    return res.status(201).json({
      success: true,
      message: result.message,
      revenue: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRevenueController(req, res) {
  try {
    const revenueId = req.params.id;
    const revenue = await getRevenue(revenueId);
    return res.status(200).json({
      success: true,
      message: "Revenue fetched successfully",
      revenue,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getAllRevenueController(req, res) {
  try {
    const {
      entityId,
      payerType,
      referenceType,
      nepaliYear,
      nepaliMonth,
      transactionScope,
      propertyId,
    } = req.query;

    const result = await getAllRevenue({
      entityId,
      payerType,
      referenceType,
      nepaliYear: nepaliYear ? parseInt(nepaliYear) : undefined,
      nepaliMonth: nepaliMonth ? parseInt(nepaliMonth) : undefined,
      transactionScope,
      propertyId,
    });

    return res.status(200).json({
      success: result.success,
      message: result.message,
      revenue: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getRevenueSourceController(req, res) {
  try {
    const result = await getRevenueSource();
    return res.status(200).json({
      success: result.success,
      message: result.message,
      revenueSource: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
