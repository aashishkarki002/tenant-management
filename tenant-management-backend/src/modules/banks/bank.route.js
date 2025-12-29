import { Router } from "express";
import { createBankAccount, getBankAccounts } from "./bank.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create-bank-account", protect, createBankAccount);
router.get("/get-bank-accounts", protect, getBankAccounts);
export default router;
