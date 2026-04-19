import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { getCalendarEventsController } from "./calendar.controller.js";

const router = Router();

router.use(protect);

// GET /api/calendar/events?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get("/events", getCalendarEventsController);

export default router;
