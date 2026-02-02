import Notification from "./notification.model.js";

export const getNotifications = async (req, res) => {
  try {
    console.log("admin id", req.admin.id);
    const notifications = await Notification.find()
      .populate("admin", "name email")
      .sort({ createdAt: -1 }); // Sort by newest first
    res.status(200).json({ success: true, notifications });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get notifications",
      error: error,
    });
  }
};
