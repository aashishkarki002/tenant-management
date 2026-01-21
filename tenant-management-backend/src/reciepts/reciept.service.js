import { Rent } from "../modules/rents/rent.Model.js";
import { generatePDFToBuffer } from "../utils/rentGenrator.js";
import { sendPaymentReceiptEmail } from "../config/nodemailer.js";
import { uploadPDFBufferToCloudinary } from "../utils/rentGenrator.js";
import { Payment } from "../modules/payment/payment.model.js";

export async function handleReceiptSideEffects({ payment, rentId }) {
  const rent = await Rent.findById(rentId)
    .populate("tenant", "name email")
    .populate("property", "name");

  if (!rent) return;

  const pdfBuffer = await generatePDFToBuffer({ payment, rent });

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
