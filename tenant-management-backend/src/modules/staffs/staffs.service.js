import adminModel from "../auth/admin.Model.js";
import StaffProfile from "./staffProfile.model.js";

// ─── EXISTING SERVICES (preserved exactly) ────────────────────────────────────

export const getStaffsService = async () => {
  try {
    const staffs = await adminModel
      .find({ role: "staff" })
      .select("name email phone role profilePicture isActive");

    // Join StaffProfile for each staff member
    const adminIds = staffs.map((s) => s._id);
    const profiles = await StaffProfile.find({ admin: { $in: adminIds } })
      .populate("reportsTo", "name email")
      .lean();

    const profileMap = {};
    profiles.forEach((p) => {
      profileMap[p.admin.toString()] = p;
    });

    const data = staffs.map((s) => ({
      ...s.toObject(),
      profile: profileMap[s._id.toString()] || null,
    }));

    return { success: true, message: "Staffs fetched successfully", data };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

export const updateStaffService = async (staffId, staffData) => {
  try {
    // Only allow safe Admin-level fields to be updated here.
    // Employment/salary fields go through updateStaffProfileService.
    const allowedFields = ["name", "phone", "address", "company", "isActive"];
    const sanitized = {};
    allowedFields.forEach((f) => {
      if (staffData[f] !== undefined) sanitized[f] = staffData[f];
    });

    const staff = await adminModel
      .findByIdAndUpdate(staffId, sanitized, {
        new: true,
        runValidators: true,
      })
      .select("name email phone role profilePicture isActive");

    if (!staff) {
      return { success: false, message: "Staff not found", data: null };
    }

    return {
      success: true,
      message: "Staff updated successfully",
      data: staff,
    };
  } catch (error) {
    console.log(error);
    throw new Error("Failed to update staff");
  }
};

export const deleteStaffService = async (staffId) => {
  try {
    // Also clean up the StaffProfile to avoid orphaned records
    await StaffProfile.findOneAndDelete({ admin: staffId });
    const staff = await adminModel.findByIdAndDelete(staffId);
    if (!staff) {
      return { success: false, message: "Staff not found" };
    }
    return { success: true };
  } catch (error) {
    console.log(error);
    throw new Error("Failed to delete staff");
  }
};

// ─── NEW SERVICES (StaffProfile) ──────────────────────────────────────────────

export const createStaffProfileService = async (
  adminId,
  profileData,
  createdByAdminId,
) => {
  try {
    const admin = await adminModel.findById(adminId);
    if (!admin) {
      return { success: false, message: "Admin not found", data: null };
    }
    if (admin.role !== "staff") {
      return {
        success: false,
        message: "StaffProfile can only be created for users with role 'staff'",
        data: null,
      };
    }

    const existing = await StaffProfile.findOne({ admin: adminId });
    if (existing) {
      return {
        success: false,
        message: "StaffProfile already exists for this user",
        data: null,
      };
    }

    const {
      department,
      designation,
      reportsTo,
      accessLevel,
      joiningDate,
      salaryType,
      salaryAmountPaisa,
      bankDetails,
      notes,
    } = profileData;

    const profile = await StaffProfile.create({
      admin: adminId,
      department: department || "other",
      designation: designation || "Staff",
      reportsTo: reportsTo || null,
      accessLevel: accessLevel || 1,
      joiningDate: joiningDate || new Date(),
      salaryType: salaryType || "monthly",
      salaryAmountPaisa: salaryAmountPaisa || 0,
      salaryHistory: salaryAmountPaisa
        ? [
            {
              amountPaisa: salaryAmountPaisa,
              effectiveFrom: new Date(joiningDate || new Date()),
              changedBy: createdByAdminId,
              reason: "Initial salary",
            },
          ]
        : [],
      bankDetails: bankDetails || {},
      notes: notes || null,
    });

    return {
      success: true,
      message: "Staff profile created successfully",
      data: profile,
    };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

export const getStaffByIdService = async (staffId) => {
  try {
    const admin = await adminModel
      .findById(staffId)
      .select("name email phone role profilePicture isActive");

    if (!admin || admin.role !== "staff") {
      return { success: false, message: "Staff member not found", data: null };
    }

    const profile = await StaffProfile.findOne({ admin: staffId })
      .populate("reportsTo", "name email")
      .lean();

    return {
      success: true,
      message: "Staff fetched successfully",
      data: { ...admin.toObject(), profile },
    };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

export const getMyStaffProfileService = async (adminId) => {
  try {
    const admin = await adminModel
      .findById(adminId)
      .select("name email phone role profilePicture isActive");

    if (!admin) {
      return { success: false, message: "Admin not found", data: null };
    }

    const profile = await StaffProfile.findOne({ admin: adminId })
      .populate("reportsTo", "name email")
      .lean();

    return {
      success: true,
      message: "Profile fetched successfully",
      data: { ...admin.toObject(), profile },
    };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};

export const updateStaffProfileService = async (
  staffId,
  profileData,
  updatedByAdminId,
) => {
  try {
    const profile = await StaffProfile.findOne({ admin: staffId });
    if (!profile) {
      return { success: false, message: "Staff profile not found", data: null };
    }

    const {
      department,
      designation,
      reportsTo,
      accessLevel,
      salaryType,
      salaryAmountPaisa,
      salaryChangeReason,
      bankDetails,
      leavingDate,
      notes,
    } = profileData;

    // Salary change: push current value to history before overwriting
    if (
      salaryAmountPaisa != null &&
      salaryAmountPaisa !== profile.salaryAmountPaisa
    ) {
      profile.salaryHistory.push({
        amountPaisa: profile.salaryAmountPaisa,
        effectiveFrom: profile.updatedAt,
        changedBy: updatedByAdminId,
        reason: salaryChangeReason || "Salary revision",
      });
      profile.salaryAmountPaisa = salaryAmountPaisa;
    }

    if (department !== undefined) profile.department = department;
    if (designation !== undefined) profile.designation = designation;
    if (reportsTo !== undefined) profile.reportsTo = reportsTo;
    if (accessLevel !== undefined) profile.accessLevel = accessLevel;
    if (salaryType !== undefined) profile.salaryType = salaryType;
    if (bankDetails !== undefined) profile.bankDetails = bankDetails;
    if (leavingDate !== undefined) profile.leavingDate = leavingDate;
    if (notes !== undefined) profile.notes = notes;

    await profile.save();

    return {
      success: true,
      message: "Staff profile updated successfully",
      data: profile,
    };
  } catch (error) {
    console.log(error);
    throw new Error(error.message);
  }
};
