import { Rent } from "../modules/rents/rent.Model.js";
import { Cam } from "../modules/cam/cam.model.js";
import { generatePDFToBuffer } from "../utils/rentGenrator.js";
import { sendPaymentReceiptEmail } from "../config/nodemailer.js";
import { uploadPDFBufferToCloudinary } from "../utils/rentGenrator.js";
import { Payment } from "../modules/payment/payment.model.js";

export async function handleReceiptSideEffects({ payment, rentId, camId }) {
  if (!payment) {
    console.error("Payment not provided");
    return;
  }

  // Ensure we have a fresh payment object with allocations
  // If payment is a Mongoose document, convert to plain object or fetch fresh
  let paymentData = payment;
  if (
    !payment.allocations ||
    (!payment.allocations.rent && !payment.allocations.cam)
  ) {
    // Fetch fresh payment from database to ensure allocations are included
    paymentData = await Payment.findById(payment._id || payment).lean();
    if (!paymentData) {
      console.error("Payment not found in database");
      return;
    }
  } else if (payment.toObject) {
    // Convert Mongoose document to plain object if needed
    paymentData = payment.toObject();
  }

  const rent = rentId
    ? await Rent.findById(rentId)
        .populate("tenant", "name email")
        .populate("property", "name")
    : null;

  const cam = camId
    ? await Cam.findById(camId)
        .populate("tenant", "name email")
        .populate("property", "name")
    : null;

  // If neither rent nor cam exists, we still need to get tenant from payment
  let tenant = rent?.tenant || cam?.tenant;
  if (!tenant && paymentData.tenant) {
    // Populate tenant from payment if not available from rent/cam
    const { Tenant } = await import("../modules/tenant/Tenant.Model.js");
    tenant = await Tenant.findById(paymentData.tenant).select("name email");
  }

  if (!tenant) {
    console.error("Tenant not found for receipt generation");
    return;
  }

  const property = rent?.property || cam?.property;

  // Format payment date
  const formattedPaymentDate = new Date(
    paymentData.paymentDate,
  ).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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

  // Get paidFor from rent or cam
  let paidFor = "Payment";
  if (rent) {
    const monthName =
      nepaliMonths[rent.nepaliMonth - 1] || `Month ${rent.nepaliMonth}`;
    paidFor = `${monthName} ${rent.nepaliYear}`;
  } else if (cam) {
    const monthName =
      nepaliMonths[cam.nepaliMonth - 1] || `Month ${cam.nepaliMonth}`;
    paidFor = `${monthName} ${cam.nepaliYear}`;
  }

  // Get rent and CAM amounts from allocations
  // Handle both 'paidAmount' (new) and 'amount' (backward compatibility) for CAM
  const rentAmount = paymentData.allocations?.rent?.amount || 0;
  const camAmount =
    paymentData.allocations?.cam?.paidAmount ||
    paymentData.allocations?.cam?.amount ||
    0;

  // Format payment method
  const paymentMethod = paymentData.paymentMethod || payment.paymentMethod;
  const paymentMethodDisplay =
    paymentMethod === "cheque"
      ? "Cheque"
      : paymentMethod === "bank_transfer"
        ? "Bank Transfer"
        : paymentMethod === "cash"
          ? "Cash"
          : paymentMethod || "N/A";

  // Prepare PDF data in the format expected by generatePDFToBuffer
  const pdfData = {
    receiptNo: (paymentData._id || paymentData.id || payment._id).toString(),
    amount: paymentData.amount || payment.amount,
    paymentDate: formattedPaymentDate,
    tenantName: tenant?.name || "N/A",
    property: property?.name || "N/A",
    paidFor,
    paymentMethod: paymentMethodDisplay,
    transactionRef:
      paymentData.transactionRef || payment.transactionRef || null,
    receivedBy:
      rent?.lastPaidBy || paymentData.receivedBy || payment.receivedBy || "",
    rentAmount,
    camAmount,
  };

  const pdfBuffer = await generatePDFToBuffer(pdfData);

  if (tenant?.email) {
    const receiptNo = (
      paymentData._id ||
      paymentData.id ||
      payment._id
    ).toString();
    await sendPaymentReceiptEmail({
      to: tenant.email,
      tenantName: tenant.name,
      pdfBuffer,
      pdfFileName: `receipt-${receiptNo}.pdf`,
      payment: paymentData,
      rent,
      cam,
      rentAmount,
      camAmount,
      paidFor,
      propertyName: property?.name || "N/A",
      receiptNo,
      amount: paymentData.amount || payment.amount,
      paymentDate: formattedPaymentDate,
    });
  }

  const paymentId = (
    paymentData._id ||
    paymentData.id ||
    payment._id
  ).toString();
  uploadPDFBufferToCloudinary(pdfBuffer, paymentId)
    .then(async (res) => {
      if (!res) return;
      const receiptGeneratedAt = new Date();
      const paymentIdToUpdate =
        paymentData._id || paymentData.id || payment._id;
      await Payment.findByIdAndUpdate(paymentIdToUpdate, {
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
