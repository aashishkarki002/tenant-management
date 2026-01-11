import mongoose from "mongoose";
import { Rent } from "../rents/rent.Model.js";
import { Payment } from "./payment.model.js";
import BankAccount from "../banks/BankAccountModel.js";
import {
  generateAndUploadRentPDF,
  generatePDFToBuffer,
} from "../../utils/rentGenrator.js";
import { sendEmail } from "../../config/nodemailer.js";

export const createPayment = async (paymentData) => {
  const session = await mongoose.startSession();
  session.startTransaction();
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
    } = paymentData;

    // 1️⃣ Fetch rent
    const rent = await Rent.findById(rentId).session(session);
    if (!rent) throw new Error("Rent not found");

    // Get tenantId from rent if not provided
    const finalTenantId =
      tenantId || (rent.tenant ? rent.tenant.toString() : null);
    if (!finalTenantId) throw new Error("Tenant ID is required");

    // 2️⃣ Update rent
    rent.paidAmount += amount;
    rent.lastPaidDate = paymentDate;
    // Only set lastPaidBy if receivedBy is a valid ObjectId, otherwise set to null
    if (
      receivedBy &&
      mongoose.Types.ObjectId.isValid(receivedBy) &&
      receivedBy.trim() !== ""
    ) {
      rent.lastPaidBy = new mongoose.Types.ObjectId(receivedBy);
    } else {
      rent.lastPaidBy = null;
    }

    rent.status =
      rent.paidAmount >= rent.rentAmount
        ? "paid"
        : rent.paidAmount > 0
        ? "partially_paid"
        : "pending";

    await rent.save({ session });

    // 3️⃣ Update bank account (only for bank_transfer or cheque)
    let bankAccount = null;
    let bankAccountObjectId = null;
    if (paymentMethod === "bank_transfer" || paymentMethod === "cheque") {
      // Convert bankAccountId string to MongoDB ObjectId
      if (!bankAccountId) {
        throw new Error(
          "Bank account ID is required for bank transfer or cheque payments"
        );
      }
      if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
        throw new Error("Invalid bank account ID format");
      }
      bankAccountObjectId = new mongoose.Types.ObjectId(bankAccountId);
      bankAccount = await BankAccount.findById(bankAccountObjectId).session(
        session
      );
      if (!bankAccount) throw new Error("Bank account not found");

      bankAccount.balance += amount;
      await bankAccount.save({ session });
    }

    // 4️⃣ Create payment
    const paymentData = {
      rent: rentId,
      tenant: finalTenantId,
      amount,
      paymentDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
    };
    // Only include bankAccount if it exists (for bank_transfer or cheque)
    if (bankAccountObjectId) {
      paymentData.bankAccount = bankAccountObjectId;
    }
    const [payment] = await Payment.create([paymentData], { session });

    // 5️⃣ Commit DB transaction **before generating PDF**
    await session.commitTransaction();
    session.endSession();

    // 6️⃣ Populate rent for PDF
    const populatedRent = await Rent.findById(rentId)
      .populate("tenant", "name")
      .populate("property", "name");

    if (!populatedRent) throw new Error("Rent not found after transaction");

    // 7️⃣ Prepare PDF data
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
      nepaliMonths[populatedRent.nepaliMonth - 1] ||
      `Month ${populatedRent.nepaliMonth}`;
    const paidFor = `${monthName} ${populatedRent.nepaliYear}`;

    const formattedPaymentDate = new Date(paymentDate).toLocaleDateString(
      "en-US",
      {
        year: "numeric",
        month: "long",
        day: "numeric",
      }
    );

    const pdfData = {
      receiptNo: payment._id.toString(),
      amount,
      paymentDate: formattedPaymentDate,
      tenantName: populatedRent.tenant?.name || "N/A",
      property: populatedRent.property?.name || "N/A",
      paidFor,
      paymentMethod: paymentMethod === "cheque" ? "Cheque" : "Bank Transfer",
      receivedBy: receivedBy || "",
    };

    // 8️⃣ Generate PDF with timeout to prevent hanging
    // Try Cloudinary upload first, fallback to buffer if timeout
    const PDF_TIMEOUT = 30000; // 30 seconds timeout
    let uploadedPDF = null;
    let pdfGeneratedToBuffer = false;

    try {
      const pdfPromise = generateAndUploadRentPDF(pdfData);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("PDF generation timeout")),
          PDF_TIMEOUT
        )
      );

      uploadedPDF = await Promise.race([pdfPromise, timeoutPromise]);
    } catch (pdfError) {
      // PDF generation/upload to Cloudinary failed or timed out
      // Fallback to generating PDF to buffer (faster and more reliable)
      console.error(
        `PDF Cloudinary upload failed/timed out for payment ${payment._id}:`,
        pdfError.message
      );
      console.log(
        `Falling back to buffer generation for payment ${payment._id}...`
      );

      try {
        // Generate PDF to buffer as fallback (this is fast and shouldn't timeout)
        await generatePDFToBuffer(pdfData);
        pdfGeneratedToBuffer = true;
        console.log(
          `PDF successfully generated to buffer for payment ${payment._id}`
        );
      } catch (bufferError) {
        console.error(
          `PDF buffer generation also failed for payment ${payment._id}:`,
          bufferError.message
        );
        // Even buffer generation failed - log but don't block response
      }
    }

    // 9️⃣ Return response (with PDF URL if Cloudinary upload succeeded, or buffer status)
    return {
      success: true,
      message: "Payment created successfully",
      payment,
      rent,
      bankAccount,
      uploadedPDF: uploadedPDF || null,
      url: uploadedPDF?.url || null,
      pdfGeneratedToBuffer: pdfGeneratedToBuffer || false,
      note: pdfGeneratedToBuffer
        ? "PDF generated to buffer (Cloudinary upload timed out)"
        : uploadedPDF
        ? "PDF uploaded to Cloudinary successfully"
        : "PDF generation failed",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return {
      success: false,
      message: "Failed to create payment",
      error: error.message,
    };
  }
};

/**
 * Send payment receipt PDF to tenant via email
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
