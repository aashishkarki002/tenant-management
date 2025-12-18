import { Router } from "express";
import createTenant from "./tenant.controller.js";
import createBlock from "./block.controller.js";
import createInnerBlock from "./innerBlock.controller.js";
import getProperty from "./property.controller.js";
import createProperty from "./property.controller.js";
import upload from "../../middleware/upload.js";
import { getTenants, getTenantById, updateTenant, deleteTenant, restoreTenant } from "./tenant.controller.js";
import { searchTenants } from "./tenant.controller.js";
const router = Router();
router.get("/get-property", getProperty);

// Tenant route
router.post(
  "/create-tenant",
  (req, res, next) => {
    // Use Multer fields middleware
    upload.fields([
      { name: "image", maxCount: 1 },
      { name: "pdfAgreement", maxCount: 1 },
    ])(req, res, function (err) {
      if (err) {
        // Multer-specific errors
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            message: "File too large. Maximum size is 10MB.",
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE" || err.message.includes("Unexpected field")) {
          return res.status(400).json({
            success: false,
            message: "Invalid field name. Expected fields: 'image' and 'pdfAgreement'.",
            error: err.message,
          });
        }
        return res.status(400).json({
          success: false,
          message: "File upload error",
          error: err.message,
        });
      }
      next();
    });
  },
  createTenant
);
router.patch("/update-tenant/:id", upload.fields([
  { name: "image", maxCount: 1 },
  { name: "pdfAgreement", maxCount: 1 },
]), updateTenant);
router.patch("/delete-tenant/:id", deleteTenant);
router.patch("/restore-tenant/:id", restoreTenant);
router.post("/create-property", createProperty);
router.post("/create-block", createBlock);

router.post("/create-inner-block", createInnerBlock);
router.get("/get-tenants", getTenants);
router.get("/get-tenant/:id", getTenantById);
router.get("/search-tenants", searchTenants);
export default router;
