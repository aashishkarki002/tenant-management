import { createPayment, sendPaymentReceiptEmail } from "./payment.service.js";
import { Rent } from "../rents/rent.Model.js";
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
