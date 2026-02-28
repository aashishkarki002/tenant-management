import Admin from "./admin.Model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { loginUserService, changePasswordService } from "./auth.services.js";
import { sendEmail } from "../../config/nodemailer.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import dotenv from "dotenv";
import generateEmailVerificationToken from "../../utils/token.js";
import cloudinary from "../../config/cloudinary.js";
import { uploadProfilePicture } from "../../config/uploadProfilePicture.js";
import { uploadSingleFile } from "../tenant/uploads/upload.service.js";

dotenv.config();

// Helper: hash a token the same way auth.services.js does, for comparison.
const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

// Shared cookie options — defined once to guarantee consistency everywhere.
// FIX: All cookies use path "/" so they are sent on every request.
// Previously refreshToken cookie was set to "/api/auth/refresh-token" in some
// handlers and "/" in others, causing the cookie to vanish after a password change.
const cookieOptions = (maxAgeMs) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: maxAgeMs,
  path: "/",
});

const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const ACCESS_MAX_AGE = 15 * 60 * 1000; // 15 minutes

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, password, phone) are required",
      });
    }

    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const { rawToken, hashedToken, expires } = generateEmailVerificationToken();

    await Admin.create({
      name,
      email,
      password,
      phone,
      role: "admin",
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiresAt: expires,
      isEmailVerified: false,
    });

    const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${rawToken}`;

    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Verify your email</h2>
        <p>Click the link below to verify your account:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link expires in 10 minutes.</p>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "Account created. Please verify your email.",
    });
  } catch (error) {
    console.error("Register error:", error);
    return res
      .status(500)
      .json({ success: false, message: "User creation failed" });
  }
};

/** Creates a staff account. Protected — admin/super_admin only. */
export const registerStaff = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "All fields (name, email, password, phone) are required",
      });
    }

    const existingUser = await Admin.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }

    const { rawToken, hashedToken, expires } = generateEmailVerificationToken();

    await Admin.create({
      name,
      email,
      password,
      phone,
      role: role || "staff",
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiresAt: expires,
      isEmailVerified: false,
    });

    const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${rawToken}`;
    const loginUrl = `${process.env.FRONTEND_URL}/login`;

    // Send a single combined email: credentials + verification CTA.
    // Industry standard: one transactional email per action — don't flood the inbox.
    // NOTE: Sending a plaintext password in email is acceptable ONLY at account
    // creation time when the admin sets it. Instruct staff to change it on first login.
    await sendEmail({
      to: email,
      subject: `Your ${process.env.APP_NAME || "platform"} staff account is ready`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
          <h2 style="margin-bottom:4px">Welcome, ${name}!</h2>
          <p style="color:#555;margin-top:0">Your staff account has been created.</p>

          <div style="background:#f4f4f5;border-radius:8px;padding:20px;margin:24px 0">
            <p style="margin:0 0 8px 0;font-weight:600">Your login credentials</p>
            <p style="margin:4px 0">Email: <strong>${email}</strong></p>
            <p style="margin:4px 0">Password: <strong>${password}</strong></p>
            <p style="margin:12px 0 0 0;font-size:12px;color:#888">
              Please change your password immediately after your first login.
            </p>
          </div>

          <p>Before you can log in you must verify your email address. 
             This link expires in <strong>10 minutes</strong>.</p>

          <a href="${verificationUrl}"
             style="display:inline-block;background:#18181b;color:#fff;padding:12px 24px;
                    border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0">
            Verify Email &amp; Activate Account
          </a>

          <p style="margin-top:24px;font-size:13px;color:#888">
            After verifying, log in at <a href="${loginUrl}">${loginUrl}</a>
          </p>
        </div>
      `,
    });

    return res.status(201).json({
      success: true,
      message: "Staff account created. Credentials sent to their email.",
    });
  } catch (error) {
    console.error("Register staff error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Staff creation failed" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, message: "Verification token is required" });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // FIX: Do NOT use $gt inside the query — mongoose.set("sanitizeFilter", true)
    // strips $ operators, causing a CastError on the Date field.
    // Fetch by token only, then validate expiry in JS.
    const user = await Admin.findOne({
      emailVerificationToken: hashedToken,
    });

    if (!user || user.emailVerificationTokenExpiresAt < new Date()) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired token" });
    }

    if (user.isEmailVerified) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/login?success=Email already verified. Please login.`,
      );
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpiresAt = null;
    await user.save();

    return res.redirect(
      `${process.env.FRONTEND_URL}/login?success=Email verified successfully. Please login.`,
    );
  } catch (error) {
    console.error("Verify email error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Email verification failed" });
  }
};

export const resendEmailVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await Admin.findOne({ email });
    if (!user) {
      // FIX: Don't reveal whether the email is registered — return 200 either way.
      return res.status(200).json({
        success: true,
        message:
          "If that email is registered, a verification link has been sent.",
      });
    }
    if (user.isEmailVerified) {
      return res
        .status(200)
        .json({ success: true, message: "Email already verified" });
    }
    const { rawToken, hashedToken, expires } = generateEmailVerificationToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationTokenExpiresAt = expires;
    await user.save();
    const verificationUrl = `${process.env.BACKEND_URL}/api/auth/verify-email?token=${rawToken}`;
    await sendEmail({
      to: email,
      subject: "Verify your email",
      html: `
        <h2>Verify your email</h2>
        <p>Click the link below to verify your account:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link expires in 10 minutes.</p>
      `,
    });
    return res.status(200).json({
      success: true,
      message:
        "If that email is registered, a verification link has been sent.",
    });
  } catch (error) {
    console.error("Resend email verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Email verification failed" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const result = await loginUserService(email, password);

    if (!result.success) {
      return res.status(401).json({ success: false, message: result.message });
    }

    // Set httpOnly cookies — the frontend must NOT read these via JS.
    // The axios instance uses withCredentials:true so they are sent automatically.
    res.cookie(
      "refreshToken",
      result.refreshToken,
      cookieOptions(REFRESH_MAX_AGE),
    );
    res.cookie(
      "accessToken",
      result.accessToken,
      cookieOptions(ACCESS_MAX_AGE),
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: result.admin._id,
        name: result.admin.name,
        email: result.admin.email,
        role: result.admin.role,
        phone: result.admin.phone,
        address: result.admin.address,
        profilePicture: result.admin.profilePicture || null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }
    if (oldPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "New password cannot be the same as the old password",
      });
    }

    const result = await changePasswordService(
      adminId,
      oldPassword,
      newPassword,
    );

    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }

    // FIX: Use consistent cookie options (path: "/") for both tokens.
    // Previously refreshToken was set to path "/api/auth/refresh-token" here,
    // meaning it would never be sent to any other endpoint including itself on next refresh.
    res.cookie(
      "refreshToken",
      result.refreshToken,
      cookieOptions(REFRESH_MAX_AGE),
    );
    res.cookie(
      "accessToken",
      result.accessToken,
      cookieOptions(ACCESS_MAX_AGE),
    );

    return res.status(200).json({ success: true, message: result.message });
  } catch (error) {
    // FIX: Replaced `throw new Error(...)` with a proper response.
    // Throwing inside an async Express handler swallows the error or
    // sends it to the global handler without a useful HTTP response.
    console.error("Change password error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Change password failed" });
  }
};

export const logoutUser = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // FIX: Revoke the refresh token in the database.
    // Previously only the cookies were cleared client-side, so a captured
    // refresh token cookie could still be used after logout.
    const admin = await Admin.findById(adminId);
    if (admin) {
      admin.refreshToken = null;
      await admin.save({ validateBeforeSave: false });
    }

    // FIX: Clear cookies using the same path they were set with (path: "/").
    // Previously clearCookie used path "/api/auth/refresh-token" for refreshToken
    // while it was set with path "/", so the cookie was never actually cleared.
    res.clearCookie("refreshToken", { httpOnly: true, path: "/" });
    res.clearCookie("accessToken", { httpOnly: true, path: "/" });

    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({ success: false, message: "Logout failed" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res
        .status(401)
        .json({ success: false, message: "Invalid or expired refresh token" });
    }

    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res
        .status(401)
        .json({ success: false, message: "Admin not found" });
    }

    // FIX: Validate the incoming token against the hashed value in the DB.
    // Without this check, revoked tokens (from logout or password change)
    // could still be used to mint new access tokens indefinitely.
    if (!admin.refreshToken || admin.refreshToken !== hashToken(token)) {
      // Token reuse or revoked token — clear everything and force re-login.
      res.clearCookie("refreshToken", { httpOnly: true, path: "/" });
      res.clearCookie("accessToken", { httpOnly: true, path: "/" });
      return res.status(401).json({
        success: false,
        message: "Refresh token is invalid or has been revoked",
      });
    }

    const newAccessToken = generateAccessToken({
      id: admin._id,
      role: admin.role,
    });
    const newRefreshToken = generateRefreshToken({
      id: admin._id,
      role: admin.role,
    });

    // Rotate: store hash of the new refresh token.
    admin.refreshToken = hashToken(newRefreshToken);
    await admin.save({ validateBeforeSave: false });

    // FIX: Use consistent cookie options (path: "/") for both tokens.
    res.cookie("refreshToken", newRefreshToken, cookieOptions(REFRESH_MAX_AGE));
    res.cookie("accessToken", newAccessToken, cookieOptions(ACCESS_MAX_AGE));

    return res.status(200).json({
      success: true,
      message: "Token refreshed",
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};

export const getMe = async (req, res) => {
  try {
    const adminId = req.admin?.id;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const admin = await Admin.findById(adminId).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationTokenExpiresAt",
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    return res.status(200).json({
      success: true,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
        phone: admin.phone,
        address: admin.address || "",
        company: admin.company || "",
        profilePicture: admin.profilePicture || null,
        isEmailVerified: admin.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Get me error:", error);
    return res.status(500).json({
      success: false,
      message: "Get me failed",
    });
  }
};

export const updateAdmin = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    const { name, email, phone, address, company } = req.body;
    const admin = await Admin.findByIdAndUpdate(
      adminId,
      { name, email, phone, address, company },
      { new: true, runValidators: true },
    );
    return res
      .status(200)
      .json({ success: true, message: "Admin updated successfully", admin });
  } catch (error) {
    console.error("Update admin error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Update admin failed" });
  }
};
export const updateProfilePicture = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No image file provided" });
    }
    console.log(req.file);
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    // Delete old Cloudinary image if it exists
    if (admin.profilePicture) {
      try {
        // Extract public_id from URL: ".../profile_pictures/someId.jpg" → "profile_pictures/someId"
        const urlParts = admin.profilePicture.split("/");
        const fileWithExt = urlParts[urlParts.length - 1];
        const publicId = `profile_pictures/${fileWithExt.split(".")[0]}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        // Non-fatal — old image might already be gone
        console.warn(
          "Could not delete old profile picture:",
          deleteErr.message,
        );
      }
    }

    // Same flow and options as tenant doc uploads (upload.service.js) — avoid gravity: "face" to prevent timeout
    const uploadResult = await uploadSingleFile(req.file, {
      folder: "profile_pictures",
      imageTransform: [{ width: 400, height: 400, crop: "limit" }],
    });

    admin.profilePicture = uploadResult.url;
    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Profile picture updated successfully",
      profilePicture: uploadResult.url,
    });
  } catch (error) {
    const msg = error?.message || String(error);
    console.error("Update profile picture error:", msg, error);
    return res.status(500).json({
      success: false,
      message: msg || "Failed to update profile picture",
    });
  }
};

/**
 * PATCH /api/auth/remove-profile-picture
 * Protected: yes
 *
 * Removes the current profile picture from Cloudinary and clears the field.
 */
export const removeProfilePicture = async (req, res) => {
  try {
    const adminId = req.admin?.id;
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    if (!admin.profilePicture) {
      return res
        .status(400)
        .json({ success: false, message: "No profile picture to remove" });
    }

    // Delete from Cloudinary
    const urlParts = admin.profilePicture.split("/");
    const fileWithExt = urlParts[urlParts.length - 1];
    const publicId = `profile_pictures/${fileWithExt.split(".")[0]}`;
    await cloudinary.uploader.destroy(publicId);

    admin.profilePicture = null;
    await admin.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: "Profile picture removed successfully",
      profilePicture: null,
    });
  } catch (error) {
    console.error("Remove profile picture error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to remove profile picture" });
  }
};
