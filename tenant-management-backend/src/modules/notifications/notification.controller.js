import Notification from "./notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      admin: req.admin.id,
      isRead: false,
    })
      .populate("admin", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error.message, // ✅ never expose raw error objects to clients
    });
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
      { new: true },
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
