import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import {
  savePushSubscription,
  deletePushSubscription,
} from "./push.controller.js";

const router = Router();

router.post("/subscribe", protect, savePushSubscription);
router.post("/unsubscribe", protect, deletePushSubscription);

export default router;
