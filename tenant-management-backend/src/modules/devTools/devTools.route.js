import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { resetTestDataController } from "./devTools.controller.js";

const router = Router();

// Hard block in production — belt + suspenders on top of env var checks
router.use((req, res, next) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ success: false, message: "Not available in production" });
  }
  next();
});

router.post("/reset", protect, resetTestDataController);

export default router;
