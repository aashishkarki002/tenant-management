import { Router } from "express";
import { createRent } from "./rent.controller.js";

import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create-rent", protect, createRent);

export default router;
