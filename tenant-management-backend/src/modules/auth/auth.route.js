import {Router} from "express";
import { registerUser } from "./auth.controller.js";
import { loginUser } from "./auth.controller.js";
import middleware from "../../middleware/auth.middleware.js";
const router = Router();
router.post("/register", registerUser);
router.post("/login", loginUser);

export default router;
