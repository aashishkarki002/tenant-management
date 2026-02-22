import { Router } from "express";
import { searchController } from "./search.controller.js";
// import { protect } from "../../middleware/auth.middleware.js"; // uncomment if you have auth middleware

const router = Router();

// GET /api/search?q=ram
// GET /api/search?q=2081&limit=10
router.get("/", searchController);
// router.get("/", protect, searchController);  // use this line if you want auth protection

export default router;
