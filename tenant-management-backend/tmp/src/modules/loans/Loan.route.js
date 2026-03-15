import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  createLoanController,
  recordPaymentController,
  getAmortizationController,
  getLoansController,
} from "./Loan.controller.js";

const router = Router();

// GET  /loans                     — list all loans for an entity
router.get("/", protect, authorize("admin", "super_admin"), getLoansController);

// POST /loans                     — create new loan + disbursement journal
router.post(
  "/",
  protect,
  authorize("admin", "super_admin"),
  createLoanController,
);

// POST /loans/:loanId/payment     — record EMI payment
router.post(
  "/:loanId/payment",
  protect,
  authorize("admin", "super_admin"),
  recordPaymentController,
);

// GET  /loans/:loanId/schedule    — full amortization schedule
router.get(
  "/:loanId/schedule",
  protect,
  authorize("admin", "super_admin", "staff"),
  getAmortizationController,
);

export default router;
