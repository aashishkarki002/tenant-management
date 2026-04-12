import PushSubscription from "./push.Model.js";
import { sendPushToAdmin } from "../../config/webpush.js";

// ── Test notification — admin/super_admin only, requires auth ─────────────────
export const sendTestNotification = async (req, res) => {
  try {
    const { title, body } = req.body || {};

    // If adminId provided in body, send only to that admin (useful for targeting yourself).
    // Otherwise broadcast to all subscribers.
    const targetId = req.body.adminId || null;

    const adminIds = targetId
      ? [targetId]
      : await PushSubscription.distinct("admin");

    if (adminIds.length === 0) {
      return res
        .status(200)
        .json({ message: "No push subscriptions found.", sent: 0 });
    }

    for (const adminId of adminIds) {
      await sendPushToAdmin(adminId, {
        title: title ?? "Test Notification",
        body: body ?? "Push notifications are working ✅",
        data: { url: "/" },
      });
    }

    res.status(200).json({
      success: true,
      message: `Test notification sent.`,
      sent: adminIds.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to send test notification",
      error: error.message,
    });
  }
};

// ── Initial subscribe — requires auth to bind endpoint → adminId ──────────────
export const savePushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription object" });
    }

    await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": subscription.endpoint },
      { admin: req.admin.id, subscription },
      { upsert: true, returnDocument: "after" },
    );

    res.status(201).json({ success: true, message: "Push subscription saved" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to save subscription", error });
  }
};

// ── Token-free renewal — endpoint URL itself proves prior registration ─────────
export const renewPushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription object" });
    }

    const existing = await PushSubscription.findOneAndUpdate(
      { "subscription.endpoint": subscription.endpoint },
      { $set: { subscription } },
      { returnDocument: "after" },
    );

    if (!existing) {
      return res.status(200).json({
        success: false,
        reason: "unknown_endpoint",
        message: "Subscription not found — re-subscribe required",
      });
    }

    res.status(200).json({ success: true, message: "Subscription renewed" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to renew subscription",
      error: error.message,
    });
  }
};

export const deletePushSubscription = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint)
      return res
        .status(400)
        .json({ success: false, message: "endpoint required" });

    await PushSubscription.deleteOne({
      "subscription.endpoint": endpoint,
    });

    res.status(200).json({ success: true, message: "Subscription removed" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to remove subscription",
      error,
    });
  }
};
