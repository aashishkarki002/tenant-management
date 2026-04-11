import { Router } from "express";
import {
  listChequeDraftsController,
  getChequeDraftSummaryController,
  getChequeDraftByIdController,
  depositChequeDraftController,
  bounceChequeDraftController,
  cancelChequeDraftController,
} from "./chequeDraft.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

const adminOrSuper = [protect, authorize("admin", "super_admin")];

router.get("/",           ...adminOrSuper, listChequeDraftsController);
router.get("/summary",    ...adminOrSuper, getChequeDraftSummaryController);
router.get("/:id",        ...adminOrSuper, getChequeDraftByIdController);
router.patch("/:id/deposit", ...adminOrSuper, depositChequeDraftController);
router.patch("/:id/bounce",  ...adminOrSuper, bounceChequeDraftController);
router.patch("/:id/cancel",  ...adminOrSuper, cancelChequeDraftController);

export default router;
