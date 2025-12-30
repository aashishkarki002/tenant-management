import { Router } from "express";
import createRent from "./rent.controller.js";
import { getRents, getRentsFiltered } from "./rent.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create-rent", protect, createRent);
router.get("/get-rents", protect, getRents);
router.get("/get-rents-filtered", protect, getRentsFiltered);
export default router;
