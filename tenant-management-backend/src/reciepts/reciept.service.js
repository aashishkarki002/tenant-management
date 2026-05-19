import { Rent } from "../modules/rents/rent.Model.js";
import { Cam } from "../modules/cam/cam.model.js";
import { generatePDFToBuffer } from "../utils/rentGenrator.js";
import { sendPaymentReceiptEmail } from "../config/nodemailer.js";
import { uploadPDFBufferToCloudinary } from "../utils/rentGenrator.js";
import { Payment } from "../modules/payment/payment.model.js";
import { rupeesToPaisa, paisaToRupees } from "../utils/moneyUtil.js";
import adminModel from "../modules/auth/admin.Model.js";

export async function handleReceiptSideEffects({ payment, rentId, camId }) {
  if (!payment) {
    console.error("Payment not provided");
    return;
  }

  // Ensure we have a fresh payment object with allocations
  let paymentData = payment;
  if (
    !payment.allocations ||
    (!payment.allocations.rent && !payment.allocations.cam)
  ) {
    paymentData = await Payment.findById(payment._id || payment).lean();
    if (!paymentData) {
      console.error("Payment not found in database");
      return;
    }
  } else if (payment.toObject) {
    paymentData = payment.toObject();
  }

  const [rent, cam] = await Promise.all([
    rentId
      ? Rent.findById(rentId).populate("tenant", "name email").populate("property", "name")
      : null,
    camId
      ? Cam.findById(camId).populate("tenant", "name email").populate("property", "name")
      : null,
  ]);

  // Resolve tenant
  let tenant = rent?.tenant || cam?.tenant;
  if (!tenant && paymentData.tenant) {
    const { Tenant } = await import("../modules/tenant/Tenant.Model.js");
    tenant = await Tenant.findById(paymentData.tenant).select("name email");
  }

  if (!tenant) {
    console.error("Tenant not found for receipt generation");
    return;
  }

  // Resolve receivedBy name — field is ObjectId ref to Admin
  let receivedByName = "";
  const receivedByRef = paymentData.receivedBy ?? rent?.lastPaidBy;
  if (receivedByRef) {
    try {
      const admin = await adminModel.findById(receivedByRef).select("name").lean();
      receivedByName = admin?.name ?? "";
    } catch {
      // non-blocking
    }
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
  // Always normalize to paisa first, then derive rupees for PDF/email.
  // Handle both new paisa fields and old rupee fields for backward compatibility.
  const rentAmountPaisa =
    paymentData.allocations?.rent?.amountPaisa !== undefined
      ? paymentData.allocations.rent.amountPaisa
      : paymentData.allocations?.rent?.amount
        ? rupeesToPaisa(paymentData.allocations.rent.amount)
        : 0;

  const camAmountPaisa =
    paymentData.allocations?.cam?.paidAmountPaisa !== undefined
      ? paymentData.allocations.cam.paidAmountPaisa
      : paymentData.allocations?.cam?.paidAmount
        ? rupeesToPaisa(paymentData.allocations.cam.paidAmount)
        : paymentData.allocations?.cam?.amount
          ? rupeesToPaisa(paymentData.allocations.cam.amount)
          : 0;

  const electricityAmountPaisa = (paymentData.allocations?.electricity ?? [])
    .reduce((sum, e) => sum + (e.amountPaisa ?? rupeesToPaisa(e.amount || 0)), 0);

  const lateFeeAmountPaisa =
    paymentData.allocations?.lateFee?.amountPaisa !== undefined
      ? paymentData.allocations.lateFee.amountPaisa
      : paymentData.allocations?.lateFee?.amount
        ? rupeesToPaisa(paymentData.allocations.lateFee.amount)
        : 0;

  const rentAmount = paisaToRupees(rentAmountPaisa);
  const camAmount = paisaToRupees(camAmountPaisa);
  const electricityAmount = paisaToRupees(electricityAmountPaisa);
  const lateFeeAmount = paisaToRupees(lateFeeAmountPaisa);

  // Total amount in paisa for consistent money formatting in email
  const totalAmountPaisa =
    (paymentData.amountPaisa ?? payment.amountPaisa ?? 0) ||
    rentAmountPaisa + camAmountPaisa + electricityAmountPaisa + lateFeeAmountPaisa;

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

  // Use human-readable RCPT document number; fall back to _id for legacy payments
  const paymentObjectId = (paymentData._id || paymentData.id || payment._id).toString();
  const receiptNo = paymentData.documentNumber || paymentObjectId;

  // Prepare PDF data
  const pdfData = {
    receiptNo,
    amount:
      paymentData.amount ??
      payment.amount ??
      paisaToRupees(totalAmountPaisa),
    paymentDate: formattedPaymentDate,
    nepaliDate: paymentData.nepaliDate || "",
    tenantName: tenant?.name || "N/A",
    property: property?.name || "N/A",
    paidFor,
    paymentMethod: paymentMethodDisplay,
    transactionRef: paymentData.transactionRef || payment.transactionRef || null,
    receivedBy: receivedByName,
    rentAmount,
    camAmount,
    electricityAmount,
    lateFeeAmount,
  };

  const pdfBuffer = await generatePDFToBuffer(pdfData);

  if (tenant?.email) {
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
      electricityAmount,
      lateFeeAmount,
      paidFor,
      propertyName: property?.name || "N/A",
      receiptNo,
      amount: totalAmountPaisa,
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
