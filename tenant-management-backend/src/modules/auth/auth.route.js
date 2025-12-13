import {Router} from "express";
import { registerUser } from "./auth.controller.js";
import { loginUser } from "./auth.controller.js";
import middleware from "../../middleware/auth.middleware.js";
const router = Router();
router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/test", middleware, (req, res) => {
   
    try {
        res.status(200).json({
            success: true,
            message: `Hello this is a private route of ${req.user.role}`, 
            user: req.user
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
});
export default router;
