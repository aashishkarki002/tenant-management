import { Router } from "express";
import createUnit from "./unit.controller.js";

const router = Router();

router.post("/create", createUnit);
export default router;
