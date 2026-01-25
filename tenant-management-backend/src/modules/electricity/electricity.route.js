import { Router } from "express";
import { createElectricity, getAllElectricity } from "./electricity.controller.js";
import upload from "../../middleware/upload.js";
import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create", protect, upload.single("billMedia"), createElectricity);
router.get("/all", protect, getAllElectricity);
export default router;