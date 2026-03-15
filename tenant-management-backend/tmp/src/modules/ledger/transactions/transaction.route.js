import express from "express";
import { getAll, getRecent } from "./transaction.controller.js";

const router = express.Router();

router.get("/get-all", getAll);
router.get("/recent", getRecent);

export default router;
