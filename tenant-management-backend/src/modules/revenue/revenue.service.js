import { Revenue } from "./Revenue.Model.js";
import { RevenueSource } from "./RevenueSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import { createPaymentRecord } from "../payment/payment.domain.js";
import { buildPaymentPayload } from "../payment/payment.domain.js";
async function createRevenue(revenueData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      source,
      amount,
      date,
      payerType,
      tenant,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
      adminId,
      nepaliDate,
      paymentMethod = "bank_transfer",
      bankAccountId,
    } = revenueData;

    // Validate revenue source
    const revenueSource = await RevenueSource.findById(source).session(session);
    if (!revenueSource) {
      throw new Error("Revenue source not found");
    }

    // Validate admin
    const existingAdmin = await Admin.findById(createdBy).session(session);
    if (!existingAdmin) {
      throw new Error("Admin not found");
    }

    // Apply payment to bank (if not cash)
    const bankAccount = await applyPaymentToBank({
      paymentMethod,
      bankAccountId,
      amount,
      session,
    });

    // Build payment payload
    const paymentPayload = buildPaymentPayload({
      tenantId: tenant,
      amount,
      paymentDate: date,
      paymentMethod,
      paymentStatus:   "paid",
      note: notes,
      nepaliDate:nepaliDate || date,
      adminId: createdBy || adminId,
      bankAccountId: bankAccount?._id || bankAccountId,
    });

    // Create payment record
    const payment = await createPaymentRecord(paymentPayload, session);

    // Create revenue record
    const [revenue] = await Revenue.create(
      [
        {
          source,
          amount,
          date,
          payerType,
          tenant,
          referenceType,
          referenceId,
          status,
          notes,
          createdBy,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return {
      success: true,
      message: "Revenue created successfully",
      data: revenue,
      payment,
      bankAccount,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Failed to create revenue:", error);
    return {
      success: false,
      message: "Failed to create revenue",
      error: error.message,
    };
  }
}
export { createRevenue };
async function getRevenue(revenueId) {
    try {
        const revenue = await Revenue.findById(revenueId).populate("source").populate("tenant").populate("createdBy");
        if (!revenue) {
            throw new Error("Revenue not found");
        }
        return revenue;
    } catch (error) {
        console.error("Failed to get revenue:", error);
        throw error;
    }
}
export { getRevenue };

async function getAllRevenue() {
    try {
        const revenue = await Revenue.find()
        return {
            success: true,
            message: "Revenue fetched successfully",
            data: revenue,
        };
    } catch (error) {
        console.error("Failed to get all revenue:", error);
        return {
            success: false,
            message: "Failed to get all revenue",
            error: error.message,
        };
    }
}
export { getAllRevenue };
export async function getRevenueSource() {
    try {
        const revenueSource = await RevenueSource.find();
        return {
            success: true,
            message: "Revenue source fetched successfully",
            data: revenueSource,
        };
    } catch (error) {
        console.error("Failed to get revenue source:", error);
        return {
            success: false,
            message: "Failed to get revenue source",
            error: error.message,
        };
    }
}
/**
 * Record revenue for a rent payment
 * @param {Object} params - Revenue recording parameters
 * @param {number} params.amount - Payment amount
 * @param {Date} params.paymentDate - Payment date
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.rentId - Rent ID
 * @param {string} params.note - Payment note
 * @param {string|ObjectId} params.adminId - Admin ID who created the payment
 * @param {Session} params.session - MongoDB session (optional)
 */
export async function recordRentRevenue({
  amount,
  paymentDate,
  tenantId,
  rentId,
  note,
  adminId,
  session = null,
}) {
  try {
    // Find the RENT revenue source
    const rentRevenueSource = await RevenueSource.findOne({ code: "RENT" }).session(
      session
    );
    if (!rentRevenueSource) {
      throw new Error("Revenue source RENT not configured");
    }

    // Create revenue record
    const revenue = await Revenue.create(
      [
        {
          source: rentRevenueSource._id,
          amount,
          date: paymentDate,
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "RENT",
          referenceId: new mongoose.Types.ObjectId(rentId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
        },
      ],
      { session }
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record rent revenue:", error);
    throw error;
  }
}

/**
 * Record revenue for a CAM payment
 * @param {Object} params - Revenue recording parameters
 * @param {number} params.amount - Payment amount
 * @param {Date} params.paymentDate - Payment date
 * @param {string} params.tenantId - Tenant ID
 * @param {string} params.camId - CAM ID
 * @param {string} params.note - Payment note
 * @param {string|ObjectId} params.adminId - Admin ID who created the payment
 * @param {Session} params.session - MongoDB session (optional)
 */
export async function recordCamRevenue({
  amount,
  paymentDate,
  tenantId,
  camId,
  note,
  adminId,
  session = null,
}) {
  try {
    // Find the CAM revenue source
    const camRevenueSource = await RevenueSource.findOne({ code: "CAM" }).session(
      session
    );
    if (!camRevenueSource) {
      throw new Error("Revenue source CAM not configured");
    }

    // Create revenue record
    const revenue = await Revenue.create(
      [
        {
          source: camRevenueSource._id,
          amount,
          date: paymentDate,
          payerType: "TENANT",
          tenant: new mongoose.Types.ObjectId(tenantId),
          referenceType: "CAM",
          referenceId: new mongoose.Types.ObjectId(camId),
          status: "RECORDED",
          notes: note,
          createdBy: new mongoose.Types.ObjectId(adminId),
        },
      ],
      { session }
    );

    return revenue[0];
  } catch (error) {
    console.error("Failed to record CAM revenue:", error);
    throw error;
  }
}