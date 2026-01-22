import { Rent } from "../modules/rents/rent.Model.js";
import { generatePDFToBuffer } from "../utils/rentGenrator.js";
import { sendPaymentReceiptEmail } from "../config/nodemailer.js";
import { uploadPDFBufferToCloudinary } from "../utils/rentGenrator.js";
import { Payment } from "../modules/payment/payment.model.js";

export async function handleReceiptSideEffects({ payment, rentId }) {
  const rent = await Rent.findById(rentId)
    .populate("tenant", "name email")
    .populate("property", "name");

  if (!rent) {
    console.error("Rent not found for rentId:", rentId);
    return;
  }

  if (!payment) {
    console.error("Payment not provided");
    return;
  }

  // Format payment date
  const formattedPaymentDate = new Date(payment.paymentDate).toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  // Format paidFor from Nepali month and year
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

  // Format payment method
  const paymentMethodDisplay =
    payment.paymentMethod === "cheque"
      ? "Cheque"
      : payment.paymentMethod === "bank_transfer"
      ? "Bank Transfer"
      : payment.paymentMethod === "cash"
      ? "Cash"
      : payment.paymentMethod || "N/A";

  // Prepare PDF data in the format expected by generatePDFToBuffer
  const pdfData = {
    receiptNo: payment._id.toString(),
    amount: payment.amount,
    paymentDate: formattedPaymentDate,
    tenantName: rent.tenant?.name || payment.tenant?.name || "N/A",
    property: rent.property?.name || "N/A",
    paidFor,
    paymentMethod: paymentMethodDisplay,
    receivedBy: rent.lastPaidBy || payment.receivedBy || "",
  };

  const pdfBuffer = await generatePDFToBuffer(pdfData);

  if (rent.tenant?.email) {
    await sendPaymentReceiptEmail({
      to: rent.tenant.email,
      tenantName: rent.tenant.name,
      pdfBuffer,
      payment,
      rent,
    });
  }

  uploadPDFBufferToCloudinary(pdfBuffer, payment._id.toString())
    .then(async (res) => {
      if (!res) return;
      const receiptGeneratedAt = new Date();
      await Payment.findByIdAndUpdate(payment._id, {
        receipt: {
          url: res.url,
          publicId: res.cloudinaryId,
          generatedAt: receiptGeneratedAt,
        },
        receiptGeneratedDate: receiptGeneratedAt,
      });
    })
    .catch(console.error);
}
