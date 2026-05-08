import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import { listBills, createBill, payBill } from "./vendorBills.controller.js";

const router = Router();
router.get("/",             protect, authorize("admin","super_admin","staff"), listBills);
router.post("/",            protect, authorize("admin","super_admin"), createBill);
router.post("/:billId/pay", protect, authorize("admin","super_admin"), payBill);
export default router;
