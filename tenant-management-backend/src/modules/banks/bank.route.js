import { Router } from "express";
import {
  createBankAccount,
  getBankAccounts,
  deleteBankAccount,
} from "./bank.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create-bank-account", protect, createBankAccount);
router.get("/get-bank-accounts", protect, getBankAccounts);
router.patch("/delete-bank-account/:id", protect, deleteBankAccount);
export default router;
