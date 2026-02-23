import PushSubscription from "./push.Model.js";
import { sendPushToAdmin } from "../../config/webpush.js";

/** Test route: POST /send-notification with { title, body } — sends to all admins with push subscriptions */
export const sendTestNotification = async (req, res) => {
  try {
    const { title, body } = req.body || {};
    const titleText = title ?? "Test";
    const bodyText = body ?? "Test notification";
    const adminIds = await PushSubscription.distinct("admin");
    if (adminIds.length === 0) {
      return res
        .status(200)
        .json({ message: "No push subscriptions; nothing sent.", sent: 0 });
    }
    for (const adminId of adminIds) {
      await sendPushToAdmin(adminId, {
        title: titleText,
        body: bodyText,
        data: {},
      });
    }
    res.status(200).json({
      message: "Test notification sent to all subscribers.",
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
      { upsert: true, new: true },
    );

    res.status(201).json({ success: true, message: "Push subscription saved" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to save subscription", error });
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
      admin: req.admin.id,
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
