import { Router } from "express";
import { protect } from "../../middleware/protect.js";
import { authorize } from "../../middleware/authorize.js";
import {
  createEventHandler,
  getEventsHandler,
  getEventByIdHandler,
  updateEventHandler,
  createStallHandler,
  getStallsByEventHandler,
  createKioskHandler,
  getKiosksByStallHandler,
  recordKioskRevenueHandler,
  recordEventExpenseHandler,
  getEventSummaryHandler,
} from "./event.controller.js";

const eventRouter = Router();

eventRouter.use(protect);
eventRouter.use(authorize("admin", "super_admin"));

// Events
eventRouter.post("/", createEventHandler);
eventRouter.get("/", getEventsHandler);
eventRouter.get("/:id", getEventByIdHandler);
eventRouter.patch("/:id", updateEventHandler);

// Stalls (scoped to event)
eventRouter.post("/:eventId/stalls", createStallHandler);
eventRouter.get("/:eventId/stalls", getStallsByEventHandler);

// Kiosks (scoped to stall)
eventRouter.post("/stalls/:stallId/kiosks", createKioskHandler);
eventRouter.get("/stalls/:stallId/kiosks", getKiosksByStallHandler);

// Revenue & Expense (scoped to event)
eventRouter.post("/:eventId/revenue", recordKioskRevenueHandler);
eventRouter.post("/:eventId/expenses", recordEventExpenseHandler);
eventRouter.get("/:eventId/summary", getEventSummaryHandler);

export { eventRouter };
