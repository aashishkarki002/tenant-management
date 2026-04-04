/**
 * liabilty.route.js  (UPDATED)
 * Add these two routes to your existing liabilities router.
 * They wire up the GET endpoints the LiabilitiesPage frontend needs.
 */

import { Router } from "express";
import {
  createLiabilityController,
  getAllLiabilitiesController,
} from "./liabilty.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();
const guard = [protect, authorize("admin", "super_admin", "staff")];

// Existing
router.post("/create", ...guard, createLiabilityController);

// NEW — feeds LiabilitiesPage
router.get("/", ...guard, getAllLiabilitiesController);

export default router;
