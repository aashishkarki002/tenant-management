import { getStaffsService } from "./staffs.service.js";
export const getStaffsController = async (req, res) => {
  try {
    const staffs = await getStaffsService();
    res.status(200).json({
      success: true,
      message: staffs.message,
      data: staffs,
    });
  } catch (error) {
    console.log(error);
    res
      .status(500)
      .json({ success: false, message: error.message, error: error });
  }
};
