import { Router } from "express";
import {
  createExpenseController,
  getAllExpensesController,
  getExpenseSourcesController,
  getStaffExpensesController,
  getSalaryReportController,
  getExpensesByEntityController,
} from "./expense.controller.js";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

const adminOrSuper = [protect, authorize("admin", "super_admin")];

router.post("/create", protect, createExpenseController);
router.get("/get-all", protect, getAllExpensesController);
router.get("/get-expense-sources", protect, getExpenseSourcesController);

// Staff / salary routes
router.get("/staff/:staffId", ...adminOrSuper, getStaffExpensesController);
router.get("/salary-report", ...adminOrSuper, getSalaryReportController);

// Entity breakdown
router.get("/by-entity", ...adminOrSuper, getExpensesByEntityController);

export default router;
