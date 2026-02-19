import { Router } from "express";
import {
  processMonthlyRents,
  getRentsController,
  getRentByIdController,
  getRentsByTenantController,
  updateRentController,
} from "./rent.controller.js";
import { protect } from "../../middleware/protect.js";
import { sendEmailToTenantsController } from "./rent.controller.js";

const router = Router();
router.post("/process-monthly-rents", protect, processMonthlyRents);
router.get("/get-rents", protect, getRentsController);
router.get("/get-rent/:rentId", protect, getRentByIdController);
router.patch("/update-rent/:rentId", protect, updateRentController);
router.get(
  "/get-rents-by-tenant/:tenantId",
  protect,
  getRentsByTenantController,
);
router.post("/send-email-to-tenants", protect, sendEmailToTenantsController);
export default router;
