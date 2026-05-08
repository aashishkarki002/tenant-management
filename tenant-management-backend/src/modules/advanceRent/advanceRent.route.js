import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { listAdvances, receiveAdvance, recognizeAdvance } from "./advanceRent.controller.js";

const router = Router();
router.get("/",                          protect, authorize("admin","super_admin","staff"), listAdvances);
router.post("/",                         protect, authorize("admin","super_admin"), receiveAdvance);
router.post("/:advanceRentId/recognize", protect, authorize("admin","super_admin"), recognizeAdvance);
export default router;
