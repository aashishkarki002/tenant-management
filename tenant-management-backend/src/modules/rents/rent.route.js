import { Router } from "express";
import { createRent } from "./rent.controller.js";
import { createBankAccount } from "./bank.controller.js";
import { protect } from "../../middleware/protect.js";
const router = Router();
router.post("/create-rent", protect, createRent);
router.post("/create-bank-account", protect, createBankAccount);
export default router;
