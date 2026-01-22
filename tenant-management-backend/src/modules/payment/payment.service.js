import mongoose from "mongoose";
import { Rent } from "../rents/rent.Model.js";
import { Payment } from "./payment.model.js";
import { applyPaymentToBank } from "../banks/bank.domain.js";
import {
  generatePDFToBuffer,
  uploadPDFBufferToCloudinary,
} from "../../utils/rentGenrator.js";
import {
  sendEmail,
  sendPaymentReceiptEmail as sendPaymentReceiptEmailFromNodemailer,
} from "../../config/nodemailer.js";
import { applyPaymentToRent } from "../rents/rent.domain.js";
import buildFilter from "../../utils/buildFilter.js";
import { buildPaymentPayload, createPaymentRecord } from "./payment.domain.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { recordRentRevenue } from "../revenue/revenue.service.js";
import { emitPaymentNotification } from "../../utils/payment.Notification.js";
import { handleReceiptSideEffects } from "../../reciepts/reciept.service.js";

export async function createPayment(paymentData) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const rent = await Rent.findById(paymentData.rentId).session(session);
    if (!rent) throw new Error("Rent not found");

    const tenantId = paymentData.tenantId || rent.tenant;

    applyPaymentToRent(
      rent,
      paymentData.amount,
      paymentData.paymentDate,
      paymentData.receivedBy
    );
    await rent.save({ session });

    const bankAccount = await applyPaymentToBank({
      paymentMethod: paymentData.paymentMethod,
      bankAccountId: paymentData.bankAccountId,
      amount: paymentData.amount,
      session,
    });

    const payload = buildPaymentPayload({
      rent,
      tenantId,
      ...paymentData,
    });

    const payment = await createPaymentRecord(payload, session);

    await ledgerService.recordPayment(payment, rent, session);

    await recordRentRevenue({
      amount: payment.amount,
      paymentDate: payment.paymentDate,
      tenantId,
      rentId: rent._id,
      note: payment.note,
      adminId: payment.createdBy,
      session,
    });

    await session.commitTransaction();
    session.endSession();

    // 🔥 Side effects (non-blocking)
    emitPaymentNotification({ paymentId: payment._id }).catch(console.error);

    handleReceiptSideEffects({
      payment,
      rentId: payment.rent || rent._id,
    });

    return { success: true, payment, rent, bankAccount };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    return { success: false, error: err.message };
  }
}



  /**
   * Send payment receipt P`DF to tenant via email
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Result object with success status and message
   */
  export const sendPaymentReceiptEmail = async (paymentId) => {
    try {
      // 1️⃣ Find payment and populate required fields
      const payment = await Payment.findById(paymentId)
        .populate("tenant", "name email")
        .populate({
          path: "rent",
          populate: [
            { path: "tenant", select: "name" },
            { path: "property", select: "name" },
          ],
        });

      if (!payment) {
        throw new Error("Payment not found");
      }

      if (!payment.tenant?.email) {
        throw new Error("Tenant email not found");
      }

      const rent = payment.rent;
      if (!rent) {
        throw new Error("Rent information not found");
      }

      // 2️⃣ Prepare PDF data
      const nepaliMonths = [
        "Baisakh",
        "Jestha",
        "Ashadh",
        "Shrawan",
        "Bhadra",
        "Ashwin",
        "Kartik",
        "Mangsir",
        "Poush",
        "Magh",
        "Falgun",
        "Chaitra",
      ];
      const monthName =
        nepaliMonths[rent.nepaliMonth - 1] || `Month ${rent.nepaliMonth}`;
      const paidFor = `${monthName} ${rent.nepaliYear}`;

      const formattedPaymentDate = new Date(
        payment.paymentDate
      ).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const pdfData = {
        receiptNo: payment._id.toString(),
        amount: payment.amount,
        paymentDate: formattedPaymentDate,
        tenantName: rent.tenant?.name || payment.tenant?.name || "N/A",
        property: rent.property?.name || "N/A",
        paidFor,
        paymentMethod:
          payment.paymentMethod === "cheque" ? "Cheque" : "Bank Transfer",
        receivedBy: rent.lastPaidBy || "",
      };

      // 3️⃣ Generate PDF to buffer (faster and more reliable for email)
      const pdfBuffer = await generatePDFToBuffer(pdfData);

      // 4️⃣ Prepare email content
      const tenantName = payment.tenant?.name || "Tenant";
      const subject = "Payment Receipt - Rent Payment Confirmation";
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Payment Receipt</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f9f9f9; margin:0; padding:0;">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:20px auto; background-color:#ffffff; border:1px solid #e0e0e0; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
            <tr>
              <td style="padding:20px;">
                <h2 style="color:#333333; font-size:24px; margin-bottom:10px;">Hello ${tenantName},</h2>
                <p style="color:#555555; font-size:16px; line-height:1.5;">
                  Thank you for your payment of <strong>Rs. ${
                    payment.amount
                  }</strong> for <strong>${paidFor}</strong>.
                </p>
                <p style="color:#555555; font-size:16px; line-height:1.5;">
                  Please find your payment receipt attached to this email.
                </p>
                <p style="color:#555555; font-size:14px; line-height:1.5; margin-top:20px;">
                  <strong>Receipt Details:</strong><br>
                  Receipt No: ${payment._id.toString()}<br>
                  Payment Date: ${formattedPaymentDate}<br>
                  Amount: Rs. ${payment.amount}<br>
                  Payment Method: ${pdfData.paymentMethod}
                </p>
                <p style="color:#555555; font-size:16px; line-height:1.5; margin-top:30px;">
                  Please keep this receipt for your records.
                </p>
                <p style="color:#555555; font-size:16px; line-height:1.5; margin-top:30px;">
                  Thank you,<br>
                  <strong>Sallyan House Management</strong>
                </p>
                <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;">
                <p style="color:#999999; font-size:12px; text-align:center;">
                  This is an automated receipt. Please do not reply to this email.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      // 5️⃣ Send email with PDF attachment
      await sendEmail({
        to: payment.tenant.email,
        subject,
        html,
        attachments: [
          {
            filename: `receipt-${payment._id.toString()}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });

      return {
        success: true,
        message: "Payment receipt email sent successfully",
        emailSentTo: payment.tenant.email,
      };
    } catch (error) {
      console.error("Error sending payment receipt email:", error);
      return {
        success: false,
        message: "Failed to send payment receipt email",
        error: error.message,
      };
    }
  };
  export const getFilteredPaymentHistoryService = async (
    tenantId,
    startDate,
    endDate,
    paymentMethod
  ) => {
    try {
      const filter = buildFilter({
        tenantId,
        startDate,
        endDate,
        paymentMethod,
        dateField: "paymentDate",
      });
      const payments = await Payment.find(filter).sort({ paymentDate: -1 });
      return {
        success: true,
        data: payments,
      };
    } catch (error) {
      console.error("Error getting filtered payment history:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Log a payment activity
   * @param {string} paymentId - Payment ID
   * @param {string} activityType - Type of activity (VIEWED, DOWNLOADED, SHARED, EMAILED, LINK_COPIED)
   * @param {string} adminId - Admin ID who performed the activity (optional)
   * @param {Object} metadata - Additional metadata (optional)
   * @returns {Promise<Object>} Result object
   */
  export const logPaymentActivity = async (
    paymentId,
    activityType,
    adminId = null,
    metadata = {}
  ) => {
    try {
      const { PaymentActivity } = await import("./paymentActivity.model.js");

      // Create the new activity
      const activity = await PaymentActivity.create({
        payment: paymentId,
        activityType,
        performedBy: adminId,
        metadata,
      });

      // Get all activities for this payment, sorted by createdAt descending
      const allActivities = await PaymentActivity.find({ payment: paymentId })
        .sort({ createdAt: -1 })
        .select("_id")
        .lean();

      // If there are more than 5 activities, delete the oldest ones
      if (allActivities.length > 5) {
        const activitiesToDelete = allActivities.slice(5); // Get all activities after the 5th one
        const idsToDelete = activitiesToDelete.map((a) => a._id);
        
        await PaymentActivity.deleteMany({
          _id: { $in: idsToDelete },
        });
      }

      return {
        success: true,
        data: activity,
      };
    } catch (error) {
      console.error("Error logging payment activity:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  };

  /**
   * Get payment activities for a specific payment (returns only top 5)
   * @param {string} paymentId - Payment ID
   * @returns {Promise<Object>} Result object with activities
   */
  export const getPaymentActivities = async (paymentId) => {
    try {
      const { PaymentActivity } = await import("./paymentActivity.model.js");

      // Get only the top 5 most recent activities
      const activities = await PaymentActivity.find({ payment: paymentId })
        .populate("performedBy", "name email")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

      return {
        success: true,
        data: activities,
      };
    } catch (error) {
      console.error("Error getting payment activities:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  };
