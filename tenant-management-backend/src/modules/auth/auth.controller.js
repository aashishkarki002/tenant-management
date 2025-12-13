import User from "./User.Model.js";
import { generateAccessToken, generateRefreshToken } from "../../utils/jwt.js";
import { loginUserService } from "./auth.services.js";
export const registerUser = async (req, res) => {

    try {
        const { name, email, password, phone , role } = req.body;
        const user = await User.create({ name, email, password, phone, role });
        const { password: _, ...userWithoutPassword } = user.toObject();
        const token = generateAccessToken({ id: user._id , role: user.role });
        const refreshToken = generateRefreshToken({ id: user._id , role: user.role });

        res.status(201).json({
            success: true,
            message: "User created successfully",
                user: userWithoutPassword,
                token: token,
                refreshToken: refreshToken
        });
    } catch (error) {   
        console.log(error);
        res.status(500).json({
            success: false,
            message: "User creation failed",
            error: error
        });
    }
}
export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

     const result = await loginUserService(email, password);
        if (!result.success) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        return res.status(200).json({
            success: true,
            message: "Login successful",
            user: {
                id: result.user._id,
                name: result.user.name,
                email: result.user.email,
                role: result.user.role,
                phone: result.user.phone
            },
            token: result.accessToken,
            refreshToken: result.refreshToken
        });
    }
    catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Login failed",
            error: error
        });
    }
}