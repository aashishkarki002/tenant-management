import { Router } from "express";
import {
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  restoreTenant,
  searchTenants,
  createTenant,
  getTenantBalanceController,
  getTenantsWithArrears,
  rebuildTenantBalancesController,
  addUnitsToTenant,
  getTerminationSummary,
} from "./tenant.controller.js";
import upload from "../../middleware/upload.js";
import { multerErrorHandler } from "../../middleware/multerErrorHandler.js";
import { protect } from "../../middleware/protect.js";

const router = Router();

router.get("/get-tenants", protect, getTenants);
router.get("/get-tenant/:id", protect, getTenantById);
router.get("/search-tenants", protect, searchTenants);

router.post(
  "/create-tenant",
  protect,
  upload.fields([
    { name: "image", maxCount: 5 },
    { name: "pdfAgreement", maxCount: 5 },
    { name: "citizenShip", maxCount: 5 },
    { name: "bank_guarantee", maxCount: 5 },
    { name: "cheque", maxCount: 5 },
    { name: "company_docs", maxCount: 5 },
    { name: "tax_certificate", maxCount: 5 },
    { name: "other", maxCount: 5 },
  ]),
  multerErrorHandler,
  createTenant,
);

router.patch(
  "/update-tenant/:id",
  protect,
  upload.any(),
  multerErrorHandler,
  updateTenant,
);

router.post("/add-units/:id", protect, addUnitsToTenant);
router.get("/termination-summary/:id", protect, getTerminationSummary);
router.patch("/delete-tenant/:id", protect, deleteTenant);
router.patch("/restore-tenant/:id", protect, restoreTenant);
router.get("/tenant-balance/:tenantId", protect, getTenantBalanceController);
router.post("/tenant-balance/rebuild", protect, rebuildTenantBalancesController);
router.get("/arrears", protect, getTenantsWithArrears);

export default router;
