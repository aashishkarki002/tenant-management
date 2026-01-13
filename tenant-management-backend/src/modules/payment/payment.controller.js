import { createPayment } from "./payment.service.js";
import { Rent } from "../rents/rent.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import { Unit } from "../tenant/units/unit.model.js";
import { Payment } from "./payment.model.js";
import { getFilteredPaymentHistoryService } from "./payment.service.js";
export async function payRent(req, res) {
  try {
    const {
      rentId,
      tenantId,
      amount,
      paymentDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
      bankAccountId,
    } = req.body;
    const paymentData = {
      adminId: req.admin.id,
      rentId,
      tenantId,
      amount,
      paymentDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
      bankAccountId,
    };
    const result = await createPayment(paymentData);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

export async function getRentSummary(req, res) {
  try {
    const summary = await Rent.aggregate([
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$paidAmount" },
          totalDue: { $sum: "$rentAmount" },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$rentAmount", 0],
            },
          },
        },
      },
    ]);

    const data = summary[0] || {
      totalCollected: 0,
      totalDue: 0,
      totalPending: 0,
    };

    res.json({ success: true, data });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * Get comprehensive dashboard statistics
 * GET /api/payment/dashboard-stats
 */
export async function getDashboardStats(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // 1. Get tenants statistics
    const totalTenants = await Tenant.countDocuments({ isDeleted: false });
    const activeTenants = await Tenant.countDocuments({
      isDeleted: false,
      status: "active",
    });
    const tenantsThisMonth = await Tenant.countDocuments({
      isDeleted: false,
      $or: [
        { createdAt: { $gte: startOfMonth, $lte: endOfMonth } },
        { dateOfAgreementSigned: { $gte: startOfMonth, $lte: endOfMonth } },
      ],
    });

    // 2. Get units statistics
    const totalUnits = await Unit.countDocuments();
    const occupiedUnitsCount = activeTenants; // Active tenants = occupied units

    // 3. Calculate occupancy rate
    const occupancyRate =
      totalUnits > 0 ? Math.round((occupiedUnitsCount / totalUnits) * 100) : 0;

    // 4. Get rent summary
    const rentSummaryResult = await Rent.aggregate([
      {
        $group: {
          _id: null,
          totalCollected: { $sum: "$paidAmount" },
          totalDue: { $sum: "$rentAmount" },
          totalPending: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, "$rentAmount", 0],
            },
          },
        },
      },
    ]);

    const rentSummary = rentSummaryResult[0] || {
      totalCollected: 0,
      totalDue: 0,
      totalPending: 0,
    };

    // 5. Calculate total rent due (remaining amounts)
    const rents = await Rent.find({})
      .populate({
        path: "tenant",
        match: { isDeleted: false },
        select: "name",
      })
      .populate("property", "name");

    const totalRentDue = rents.reduce((sum, rent) => {
      if (!rent.tenant) return sum;
      const remaining = (rent.rentAmount || 0) - (rent.paidAmount || 0);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0);

    // 6. Get overdue rents
    const overdueRents = rents
      .filter((rent) => {
        if (!rent.tenant || !rent.englishDueDate) return false;
        const dueDate = new Date(rent.englishDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const remaining = (rent.rentAmount || 0) - (rent.paidAmount || 0);
        return dueDate < today && remaining > 0 && rent.status !== "paid";
      })
      .slice(0, 3)
      .map((rent) => ({
        _id: rent._id,
        tenant: rent.tenant,
        property: rent.property,
        rentAmount: rent.rentAmount,
        paidAmount: rent.paidAmount,
        englishDueDate: rent.englishDueDate,
        status: rent.status,
        remaining: rent.rentAmount - rent.paidAmount,
      }));

    // 7. Get upcoming rents (within 7 days)
    const upcomingRents = rents
      .filter((rent) => {
        if (!rent.tenant || !rent.englishDueDate) return false;
        const dueDate = new Date(rent.englishDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil(
          (dueDate - today) / (1000 * 60 * 60 * 24)
        );
        const remaining = (rent.rentAmount || 0) - (rent.paidAmount || 0);
        return (
          daysUntilDue >= 0 &&
          daysUntilDue <= 7 &&
          remaining > 0 &&
          rent.status !== "paid"
        );
      })
      .slice(0, 3)
      .map((rent) => {
        const dueDate = new Date(rent.englishDueDate);
        dueDate.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil(
          (dueDate - today) / (1000 * 60 * 60 * 24)
        );
        return {
          _id: rent._id,
          tenant: rent.tenant,
          property: rent.property,
          rentAmount: rent.rentAmount,
          paidAmount: rent.paidAmount,
          englishDueDate: rent.englishDueDate,
          status: rent.status,
          remaining: rent.rentAmount - rent.paidAmount,
          daysUntilDue,
        };
      });

    // 8. Get contracts ending soon (within 30 days)
    const contractsEndingSoon = await Tenant.find({
      isDeleted: false,
      leaseEndDate: { $exists: true, $ne: null },
      status: "active",
    })
      .select("name leaseEndDate")
      .lean()
      .then((tenants) => {
        return tenants
          .filter((tenant) => {
            const endDate = new Date(tenant.leaseEndDate);
            const daysUntilEnd = Math.ceil(
              (endDate - today) / (1000 * 60 * 60 * 24)
            );
            return daysUntilEnd >= 0 && daysUntilEnd <= 30;
          })
          .map((tenant) => {
            const endDate = new Date(tenant.leaseEndDate);
            const daysUntilEnd = Math.ceil(
              (endDate - today) / (1000 * 60 * 60 * 24)
            );
            return {
              _id: tenant._id,
              name: tenant.name,
              leaseEndDate: tenant.leaseEndDate,
              daysUntilEnd,
            };
          })
          .sort((a, b) => a.daysUntilEnd - b.daysUntilEnd)
          .slice(0, 3);
      });

    const data = {
      // Tenant statistics
      totalTenants,
      activeTenants,
      tenantsThisMonth,
      occupiedUnits: occupiedUnitsCount,

      // Unit statistics
      totalUnits,
      occupancyRate,

      // Rent statistics
      rentSummary: {
        totalCollected: rentSummary.totalCollected || 0,
        totalDue: rentSummary.totalDue || 0,
        totalPending: rentSummary.totalPending || 0,
      },
      totalRentDue,

      // Lists
      overdueRents,
      upcomingRents,
      contractsEndingSoon,
    };

    res.json({ success: true, data });
  } catch (err) {
    console.error("Error fetching dashboard stats:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Send payment receipt email to tenant
 * POST /api/payments/send-receipt/:paymentId
 */
export async function sendReceiptEmail(req, res) {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Payment ID is required",
      });
    }

    const result = await sendPaymentReceiptEmail(paymentId);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: { emailSentTo: result.emailSentTo },
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        error: result.error,
      });
    }
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
}
export async function getAllPaymentHistory(req, res) {
  try {
    const payments = await Payment.find()
      .populate({
        path: "tenant",
        select: "name",
      })
      .populate({
        path: "rent",
        populate: [
          { path: "tenant", select: "name" },
          { path: "property", select: "name" },
        ],
      })
      .populate({
        path: "bankAccount",
        select: "accountNumber accountName bankName",
      });
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error("Error getting all payment history:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
export async function getPaymentHistoryByTenant(req, res) {
  try {
    const { tenantId } = req.params;
    const payments = await Payment.find({ tenant: tenantId })
      .populate({
        path: "tenant",
        select: "name",
      })
      .populate({
        path: "rent",
        populate: [
          { path: "tenant", select: "name" },
          { path: "property", select: "name" },
        ],
      })
      .populate({
        path: "bankAccount",
        select: "accountNumber accountName bankName",
      });

    res.json({ success: true, data: payments });
  } catch (err) {
    console.error("Error getting payment history by tenant:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
export async function getFilteredPaymentHistory(req, res) {
  try {
    const { tenantId, startDate, endDate, paymentMethod } = req.query;

    const result = await getFilteredPaymentHistoryService(
      tenantId,
      startDate,
      endDate,
      paymentMethod
    );

    if (result.success) {
      res.json({ success: true, data: result.data });
    } else {
      res.status(400).json({ success: false, message: result.error });
    }
  } catch (err) {
    console.error("Error getting filtered payment history:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
export async function getPaymentById(req, res) {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId)
      .populate("tenant", "name")
      .populate({
        path: "rent",
        populate: [
          { path: "tenant", select: "name" },
          { path: "property", select: "name" },
        ],
      })
      .populate({
        path: "bankAccount",
        select: "accountNumber accountName bankName",
      });
    res.json({ success: true, data: payment });
  } catch (err) {
    console.error("Error getting payment by id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
export async function getPaymentByRentId(req, res) {
  try {
    const { rentId } = req.params;
    const payments = await Payment.find({ rent: rentId })
      .populate("tenant", "name")
      .populate({
        path: "rent",
        populate: [
          { path: "tenant", select: "name" },
          { path: "property", select: "name" },
        ],
      })
      .populate({
        path: "bankAccount",
        select: "accountNumber accountName bankName",
      });
    res.json({ success: true, data: payments });
  } catch (err) {
    console.error("Error getting payment by rent id:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
