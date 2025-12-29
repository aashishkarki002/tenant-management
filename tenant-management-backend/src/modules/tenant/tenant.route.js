import { Router } from "express";
import {
  getTenants,
  getTenantById,
  updateTenant,
  deleteTenant,
  restoreTenant,
  searchTenants,
  createTenant,
} from "./tenant.controller.js";
import upload from "../../middleware/upload.js";
import { multerErrorHandler } from "../../middleware/multerErrorHandler.js";
const router = Router();
router.get("/get-tenants", getTenants);
router.get("/get-tenant/:id", getTenantById);
router.patch(
  "/update-tenant/:id",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "pdfAgreement", maxCount: 1 },
  ]),
  multerErrorHandler,
  updateTenant
);
router.patch("/delete-tenant/:id", deleteTenant);
router.patch("/restore-tenant/:id", restoreTenant);

router.get("/search-tenants", searchTenants);
router.post(
  "/create-tenant",
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "pdfAgreement", maxCount: 1 },
  ]),
  multerErrorHandler,
  createTenant
);
export default router;
