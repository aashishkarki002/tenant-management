import { getIO } from "../config/socket.js";
import Notification from "../modules/notifications/notification.model.js";
import dotenv from "dotenv";
import BankAccount from "../modules/banks/BankAccountModel.js";
dotenv.config();
const ADMIN_ID = process.env.SYSTEM_ADMIN_ID;
export const emitPaymentNotification = async (paymentData) => {
  const io = getIO();
  try {
    const {
      paymentId,
      tenantId,
      amount,
      paymentDate,
      paymentMethod,
      paymentStatus,
      note,
      receivedBy,
      bankAccountId,
    } = paymentData;
 
    let bankName = "Unknown";

    if (bankAccountId) {
      const bank = await BankAccount.findById(bankAccountId).select("name");
      if (bank?.name) {
        bankName = bank.name;
      }
    }
    
    const notificationMessage = `Payment of Rs. ${amount} received from tenant on ${new Date(
      paymentDate
    ).toLocaleDateString()} using ${paymentMethod}${
      bankAccountId ? ` (Bank Account: ${bankName})` : ""
    }`;

    const notification = await Notification.create({
      admin: ADMIN_ID,
      type: "PAYMENT_NOTIFICATION",
      title: "Payment Notification",
      message: notificationMessage,
      data: {
        paymentId,
        tenantId,
        amount,
        paymentDate,
        paymentMethod,
        paymentStatus,
        note,
        receivedBy,
        bankAccountId,
      },
    });

    io.to(`admin:${ADMIN_ID}`).emit("new-notification", {
      notification: {
        _id: notification._id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        isRead: false,
        createdAt: notification.createdAt,
      },
    });
    return {
      success: true,
      message: "Payment notification emitted successfully",
    };
  } catch (error) {
    console.error("Error emitting payment notification:", error);
    return {
      success: false,
      message: "Failed to emit payment notification",
      error: error.message,
    };
  }
};
