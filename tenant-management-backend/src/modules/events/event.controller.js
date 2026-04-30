import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  createStall,
  getStallsByEvent,
  createKiosk,
  getKiosksByStall,
  recordKioskRevenue,
  recordEventExpense,
  getEventSummary,
} from "./event.service.js";

// ─── EVENTS ────────────────────────────────────────────────────────────────────

export const createEventHandler = async (req, res) => {
  try {
    const event = await createEvent(req.body);
    return res.status(201).json({ success: true, message: "Event created", event });
  } catch (error) {
    console.error("createEvent error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to create event" });
  }
};

export const getEventsHandler = async (req, res) => {
  try {
    const events = await getEvents(req.query);
    return res.status(200).json({ success: true, count: events.length, events });
  } catch (error) {
    console.error("getEvents error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch events" });
  }
};

export const getEventByIdHandler = async (req, res) => {
  try {
    const { event, stalls } = await getEventById(req.params.id);
    return res.status(200).json({ success: true, event, stalls });
  } catch (error) {
    console.error("getEventById error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to fetch event" });
  }
};

export const updateEventHandler = async (req, res) => {
  try {
    const event = await updateEvent(req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Event updated", event });
  } catch (error) {
    console.error("updateEvent error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to update event" });
  }
};

// ─── STALLS ────────────────────────────────────────────────────────────────────

export const createStallHandler = async (req, res) => {
  try {
    const stall = await createStall({ ...req.body, eventId: req.params.eventId });
    return res.status(201).json({ success: true, message: "Stall created", stall });
  } catch (error) {
    console.error("createStall error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to create stall" });
  }
};

export const getStallsByEventHandler = async (req, res) => {
  try {
    const stalls = await getStallsByEvent(req.params.eventId);
    return res.status(200).json({ success: true, count: stalls.length, stalls });
  } catch (error) {
    console.error("getStallsByEvent error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch stalls" });
  }
};

// ─── KIOSKS ────────────────────────────────────────────────────────────────────

export const createKioskHandler = async (req, res) => {
  try {
    const kiosk = await createKiosk({ ...req.body, stallId: req.params.stallId });
    return res.status(201).json({ success: true, message: "Kiosk created", kiosk });
  } catch (error) {
    console.error("createKiosk error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to create kiosk" });
  }
};

export const getKiosksByStallHandler = async (req, res) => {
  try {
    const kiosks = await getKiosksByStall(req.params.stallId);
    return res.status(200).json({ success: true, count: kiosks.length, kiosks });
  } catch (error) {
    console.error("getKiosksByStall error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch kiosks" });
  }
};

// ─── REVENUE ───────────────────────────────────────────────────────────────────

export const recordKioskRevenueHandler = async (req, res) => {
  try {
    const revenue = await recordKioskRevenue(req.params.eventId, req.body, req.admin.id);
    return res.status(201).json({ success: true, message: "Revenue recorded", revenue });
  } catch (error) {
    console.error("recordKioskRevenue error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to record revenue" });
  }
};

// ─── EXPENSE ───────────────────────────────────────────────────────────────────

export const recordEventExpenseHandler = async (req, res) => {
  try {
    const expense = await recordEventExpense(req.params.eventId, req.body, req.admin.id);
    return res.status(201).json({ success: true, message: "Expense recorded", expense });
  } catch (error) {
    console.error("recordEventExpense error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to record expense" });
  }
};

// ─── SUMMARY ───────────────────────────────────────────────────────────────────

export const getEventSummaryHandler = async (req, res) => {
  try {
    const summary = await getEventSummary(req.params.eventId);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    console.error("getEventSummary error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to fetch summary" });
  }
};
