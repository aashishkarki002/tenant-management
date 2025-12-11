  import jwt from "jsonwebtoken";
  import dotenv from "dotenv";
  dotenv.config();
  const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ;
  const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ;
  const ACCESS_EXPIRES_IN = process.env.ACCESS_EXPIRES_IN || "15m";
  const REFRESH_EXPIRES_IN = process.env.REFRESH_EXPIRES_IN || "7d";

  export const generateAccessToken = (payload) => {
    return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES_IN });
  };
  export const verifyAccessToken = (token) => {
    try {
      return jwt.verify(token, JWT_ACCESS_SECRET);
    } catch (err) {
      return null;
    }
  };
  export const generateRefreshToken = (payload) => {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  };
  export const verifyRefreshToken = (token) => {
    try {
      return jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      return null;
    }
  };