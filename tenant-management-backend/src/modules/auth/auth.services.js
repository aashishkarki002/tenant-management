import User from "./User.Model.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";

export const loginUserService = async (email, password) => {
    const user = await User.findOne({ email });
    if (!user) {
        return { success: false, message: "User not found" };
    }
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
        throw new Error("Invalid credentials");
    }
 const accessToken = generateAccessToken({ id: user._id, role: user.role });
 const refreshToken = generateRefreshToken({ id: user._id, role: user.role });
 return { success: true, message: "Login successful", user: user, accessToken, refreshToken };
}