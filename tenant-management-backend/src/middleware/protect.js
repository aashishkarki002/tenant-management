import jwt from "jsonwebtoken";
import Admin from "../modules/auth/admin.Model.js";
import dotenv from "dotenv";
dotenv.config();

export const protect = async (req, res, next) => {
  try {
    // Get token from Authorization header (Bearer token) or fallback to cookie
    let token = req.headers.authorization?.split(" ")[1]; // Bearer <token>
    if (!token) {
      token = req.cookies.accessToken;
    }
    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.admin = {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      phone: admin.phone,
    };

    next();
  } catch (error) {
    console.error("Protect error:", error);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
};
