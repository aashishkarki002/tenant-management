import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  getAllEntities,
  createEntity,
  getEntityById,
  updateEntity,
} from "./ownership.controller.js";

const router = Router();

const superAdmin = [protect, authorize("super_admin")];

router.get("/", ...superAdmin, getAllEntities);
router.post("/", ...superAdmin, createEntity);
router.get("/:id", ...superAdmin, getEntityById);
router.patch("/:id", ...superAdmin, updateEntity);

export default router;
