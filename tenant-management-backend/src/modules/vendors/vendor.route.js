// ─── vendor.route.js ───────────────────────────────────────────────────────────
import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  createVendor,
  getAllVendors,
  getVendorById,
  updateVendor,
  createContract,
  getContractsByVendor,
  assignPersonnel,
  getPersonnelByContract,
  updatePersonnel,
} from "./vendor.controller.js";

const vendorRouter = Router();

vendorRouter.use(protect);
vendorRouter.use(authorize("admin", "super_admin")); // all vendor routes are admin-only

// Vendors
vendorRouter.post("/", createVendor);
vendorRouter.get("/", getAllVendors);
vendorRouter.get("/:id", getVendorById);
vendorRouter.patch("/:id", updateVendor);

// Contracts
vendorRouter.post("/contracts", createContract);
vendorRouter.get("/:vendorId/contracts", getContractsByVendor);

// Assigned Personnel
vendorRouter.post("/personnel", assignPersonnel);
vendorRouter.get("/contracts/:contractId/personnel", getPersonnelByContract);
vendorRouter.patch("/personnel/:id", updatePersonnel);

export { vendorRouter };
