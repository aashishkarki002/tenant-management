import { Router } from "express";

import createTenant from "./tenant.controller.js";

import createBlock from "./block.controller.js";
import createInnerBlock from "./innerBlock.controller.js";
import getProperty from "./property.controller.js";
const router = Router();
router.get("/get-property", getProperty);
router.post("/create-tenant", createTenant);

router.post("/create-block", createBlock);
router.post("/create-inner-block", createInnerBlock);
export default router;