import {
  getStaffsService,
  updateStaffService,
  deleteStaffService,
  createStaffProfileService,
  getStaffByIdService,
  getMyStaffProfileService,
  updateStaffProfileService,
} from "./staffs.service.js";

// ─── EXISTING CONTROLLERS (response shape preserved exactly) ──────────────────

export const getStaffsController = async (req, res) => {
  try {
    const staffs = await getStaffsService();
    res.status(200).json({
      success: staffs.success,
      message: staffs.message,
      data: staffs.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStaffController = async (req, res) => {
  try {
    const staff = await updateStaffService(req.params.id, req.body);
    res.status(200).json({
      success: staff.success,
      message: staff.message,
      data: staff.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStaffController = async (req, res) => {
  try {
    const staff = await deleteStaffService(req.params.id);
    res.status(200).json({
      success: staff.success,
      message: "Staff deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── NEW CONTROLLERS (StaffProfile) ──────────────────────────────────────────

/**
 * POST /api/staffs/profile
 * Create a StaffProfile for an existing staff Admin.
 * Protected: admin / super_admin only.
 */
export const createStaffProfileController = async (req, res) => {
  try {
    const { adminId, ...profileData } = req.body;
    if (!adminId) {
      return res
        .status(400)
        .json({ success: false, message: "adminId is required" });
    }

    const result = await createStaffProfileService(
      adminId,
      profileData,
      req.admin.id,
    );
    res.status(result.success ? 201 : 400).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/staffs/me
 * Staff reads their own profile. ID always derived from JWT.
 * Protected: all authenticated users (staff reads own record).
 */
export const getMyStaffProfileController = async (req, res) => {
  try {
    const result = await getMyStaffProfileService(req.admin.id);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/staffs/get-staff/:id
 * Get a single staff member with their profile.
 * Protected: admin / super_admin only.
 */
export const getStaffByIdController = async (req, res) => {
  try {
    const result = await getStaffByIdService(req.params.id);
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/staffs/update-profile/:id
 * Update employment/salary details. Salary change triggers salaryHistory entry.
 * Protected: admin / super_admin only.
 */
export const updateStaffProfileController = async (req, res) => {
  try {
    const result = await updateStaffProfileService(
      req.params.id,
      req.body,
      req.admin.id,
    );
    res.status(result.success ? 200 : 404).json({
      success: result.success,
      message: result.message,
      data: result.data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: error.message });
  }
};
