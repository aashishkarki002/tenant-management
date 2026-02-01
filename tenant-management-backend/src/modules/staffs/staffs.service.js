import adminModel from "../auth/admin.Model.js";
export const getStaffsService = async () => {
  try {
    const staffs = await adminModel
      .find({ role: "staff" })
      .select("name email phone");
    return {
      success: true,
      message: "Staffs fetched successfully",
      data: staffs,
    };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};
