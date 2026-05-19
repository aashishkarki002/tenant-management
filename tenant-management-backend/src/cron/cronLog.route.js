import { Router } from "express";
import { protect } from "../middleware/protect.js";
import { authorize } from "../middleware/authorize.js";
import { getRuns, getRunDetail, getLogs, triggerCron } from "./cronLog.controller.js";

const router = Router();

router.use(protect);
router.use(authorize("admin", "super_admin"));

router.get("/runs",        getRuns);
router.get("/runs/:runId", getRunDetail);
router.get("/",            getLogs);
router.post("/trigger",    triggerCron);

export default router;
