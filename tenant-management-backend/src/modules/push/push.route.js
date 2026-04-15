import { Router } from "express";
import {
  savePushSubscription,
  renewPushSubscription,
  deletePushSubscription,
  sendTestNotification,
} from "./push.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

// Requires auth — binds push endpoint to this admin's _id in DB (runs once on first install)
router.post("/subscribe", protect, savePushSubscription);

// No auth — endpoint URL itself is the credential (see controller comment for security rationale)
// Called by the hook when an existing subscription is found locally but may need key refresh
router.post("/renew", renewPushSubscription);

// No auth — endpoint URL is treated as proof-of-possession, same model as /renew
router.post("/unsubscribe", deletePushSubscription);

// Dev/admin test — protected + admin only so it's never accidentally triggered in prod
router.post(
  "/send-test",
  protect,
  authorize("admin", "super_admin"),
  sendTestNotification,
);

export default router;
