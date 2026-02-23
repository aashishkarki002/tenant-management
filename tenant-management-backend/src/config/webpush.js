import webPush from "web-push";
import PushSubscription from "../modules/push/push.Model.js";

let initialized = false;

export function initializeWebPush() {
  if (initialized) return;

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL } = process.env;

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_EMAIL) {
    console.warn(
      "[webpush] VAPID keys not set — push notifications disabled. Add VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL to .env",
    );
    return;
  }

  webPush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
  console.log("[webpush] ✅ VAPID configured");
}

/**
 * Send a push notification to all subscriptions belonging to an admin.
 * Silently no-ops if VAPID is not configured.
 */
export async function sendPushToAdmin(adminId, { title, body, data = {} }) {
  if (!initialized) return;

  const subscriptions = await PushSubscription.find({ admin: adminId });
  if (!subscriptions.length) return;

  const payload = JSON.stringify({ title, body, data });

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(sub.subscription, payload);
      } catch (err) {
        // 410 Gone / 404 = subscription expired, clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
          console.log(
            `[webpush] removed expired subscription for admin ${adminId}`,
          );
        } else {
          console.error(
            `[webpush] send failed for admin ${adminId}:`,
            err.message,
          );
        }
      }
    }),
  );
}
