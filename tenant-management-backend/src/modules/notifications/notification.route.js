import { Router } from "express";
import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
  deleteAllReadNotifications,
} from "./notification.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.get("/get-notifications", protect, getNotifications);
router.get("/unread-count", protect, getUnreadCount);
router.patch(
  "/mark-all-notifications-as-read",
  protect,
  markAllNotificationsAsRead
);
router.patch("/mark-notification-as-read/:id", protect, markNotificationAsRead);
router.delete("/delete-all", protect, deleteAllReadNotifications);
router.delete("/:id", protect, deleteNotification);
export default router;
