import Notification from "./notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const { includeRead, type, page = "1", limit = "20" } = req.query;

    const filter = { admin: req.admin.id };
    if (!includeRead || includeRead === "false") filter.isRead = false;
    if (type) filter.type = type;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error.message,
    });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ admin: req.admin.id, isRead: false });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to get unread count", error: error.message });
  }
};

export const deleteAllReadNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({ admin: req.admin.id, isRead: true });
    res.status(200).json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to delete notifications", error: error.message });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    // ✅ FIX: scope to the authenticated admin only
    await Notification.updateMany({ admin: req.admin.id }, { isRead: true });

    res
      .status(200)
      .json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read",
      error: error.message,
    });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    // ✅ FIX: ownership check — admin can only update their own notification
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, admin: req.admin.id },
      { isRead: true },
      { returnDocument: "after" },
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or access denied",
      });
    }

    res
      .status(200)
      .json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error.message,
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      admin: req.admin.id,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or access denied",
      });
    }

    await notification.deleteOne();
    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete notification",
      error: error.message,
    });
  }
};
