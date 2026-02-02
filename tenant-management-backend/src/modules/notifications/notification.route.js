import { Router } from "express";
import { getNotifications } from "./notification.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();

router.get("/get-notifications", protect, getNotifications);

export default router;
