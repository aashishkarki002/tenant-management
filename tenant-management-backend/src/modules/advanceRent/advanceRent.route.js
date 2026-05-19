import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { listAdvances, receiveAdvance, recognizeAdvance, allocateAdvanceController } from "./advanceRent.controller.js";

const router = Router();
router.get("/",                          protect, authorize("admin","super_admin","staff"), listAdvances);
router.post("/",                         protect, authorize("admin","super_admin"), receiveAdvance);
router.post("/:advanceRentId/recognize", protect, authorize("admin","super_admin"), recognizeAdvance);
router.post("/:advanceRentId/allocate",  protect, authorize("admin","super_admin"), allocateAdvanceController);
export default router;
