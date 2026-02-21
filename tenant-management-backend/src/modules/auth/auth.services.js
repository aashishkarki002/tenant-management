import crypto from "crypto";
import Admin from "./admin.Model.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";

// Helper: SHA-256 hash a token before storing in DB.
// Raw JWTs in the DB are a liability if the DB is ever dumped.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const loginUserService = async (email, password) => {
  const admin = await Admin.findOne({ email });

  if (!admin) {
    // FIX: Return a generic message — don't reveal whether the email exists.
    return { success: false, message: "Invalid credentials" };
  }

  const isPasswordCorrect = await admin.comparePassword(password);
  if (!isPasswordCorrect) {
    return { success: false, message: "Invalid credentials" };
  }

  if (!admin.isActive) {
    return { success: false, message: "Account is deactivated" };
  }

  if (!admin.isEmailVerified) {
    return { success: false, message: "Please verify your email first" };
  }

  const accessToken = generateAccessToken({ id: admin._id, role: admin.role });
  const refreshToken = generateRefreshToken({
    id: admin._id,
    role: admin.role,
  });

  // FIX: Store a hash of the refresh token, not the raw value.
  admin.refreshToken = hashToken(refreshToken);
  await admin.save({ validateBeforeSave: false });

  return { success: true, admin, accessToken, refreshToken };
};

export async function changePasswordService(adminId, oldPassword, newPassword) {
  try {
    const admin = await Admin.findById(adminId).select("+password");

    if (!admin) {
      return { success: false, message: "Admin not found" };
    }

    const isPasswordCorrect = await admin.comparePassword(oldPassword);
    if (!isPasswordCorrect) {
      return { success: false, message: "Old password is incorrect" };
    }

    admin.password = newPassword;
    admin.passwordChangedAt = new Date();

    // FIX: Revoke all existing refresh tokens when password changes.
    // Without this, a stolen refresh token stays valid after a password change.
    admin.refreshToken = null;

    await admin.save();

    const accessToken = generateAccessToken({
      id: admin._id,
      role: admin.role,
    });
    const refreshToken = generateRefreshToken({
      id: admin._id,
      role: admin.role,
    });

    // FIX: Store hash of new refresh token.
    admin.refreshToken = hashToken(refreshToken);
    await admin.save({ validateBeforeSave: false });

    return {
      success: true,
      message: "Password changed successfully",
      accessToken,
      refreshToken,
    };
  } catch (error) {
    console.error("Change password service error:", error);
    return {
      success: false,
      message: "Change password failed",
      error: error.message,
    };
  }
}
