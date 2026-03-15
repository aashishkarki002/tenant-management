import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import {
  savePushSubscription,
  renewPushSubscription,
  deletePushSubscription,
} from "./push.controller.js";

const router = Router();

// Requires auth — binds push endpoint to this admin's _id in DB (runs once on first install)
router.post("/subscribe", protect, savePushSubscription);

// No auth — endpoint URL itself is the credential (see controller comment for security rationale)
// Called by the hook when an existing subscription is found locally but may need key refresh
router.post("/renew", renewPushSubscription);

// Requires auth — admin can only unsubscribe their own endpoint
router.post("/unsubscribe", protect, deletePushSubscription);

export default router;
