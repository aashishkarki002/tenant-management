import Admin from "./admin.Model.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { loginUserService, changePasswordService } from "./auth.services.js";
import { sendEmail } from "../../config/nodemailer.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import dotenv from "dotenv";
import generateEmailVerificationToken from "../../utils/token.js";
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
      message: "Staff account created. Verification link sent to their email.",
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

    const user = await Admin.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
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
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpiresAt = undefined;
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
