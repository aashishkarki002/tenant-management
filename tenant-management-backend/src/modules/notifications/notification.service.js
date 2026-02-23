import Notification from "./notification.model.js";
import { emitNotification } from "../../config/socket.js";
import { sendPushToAdmin } from "../../config/webpush.js";
import Admin from "../auth/admin.Model.js";

/**
 * The single function to call whenever you want to notify admins.
 * It does 3 things in order:
 *   1. Saves notification(s) to MongoDB (offline admins see it on next login)
 *   2. Emits via Socket.io (online admins get it instantly in-tab)
 *   3. Sends Web Push (admins with push enabled get native OS notification even if tab is closed)
 *
 * @param {Object}   options
 * @param {string}   options.type       - Notification type (must match model enum)
 * @param {string}   options.title      - Short title shown in notification
 * @param {string}   options.message    - Full message body
 * @param {Object}  [options.data]      - Extra payload (e.g. { generatorId })
 * @param {string[]} [options.adminIds] - Target specific admins. Omit to broadcast to ALL active admins.
 */
export async function createAndEmitNotification({
  type,
  title,
  message,
  data = {},
  adminIds,
}) {
  // 1. Resolve targets
  let targetAdminIds = adminIds;
  if (!targetAdminIds || targetAdminIds.length === 0) {
    const admins = await Admin.find({ isActive: true }).select("_id");
    targetAdminIds = admins.map((a) => a._id.toString());
  }

  if (targetAdminIds.length === 0) {
    console.warn(
      "[notification] createAndEmitNotification called but no active admins found",
    );
    return [];
  }

  // 2. Bulk insert — one document per admin
  const docs = targetAdminIds.map((adminId) => ({
    admin: adminId,
    type,
    title,
    message,
    data,
    isRead: false,
  }));

  const saved = await Notification.insertMany(docs);

  // 3. Deliver to each admin via socket + push (in parallel, failures are isolated)
  await Promise.allSettled(
    saved.map(async (notification) => {
      const adminId = notification.admin.toString();
      // Socket: instant if the admin's browser tab is open
      emitNotification(adminId, notification);
      // Web Push: native OS notification even if tab is closed
      await sendPushToAdmin(adminId, { title, body: message, data });
    }),
  );

  return saved;
}
