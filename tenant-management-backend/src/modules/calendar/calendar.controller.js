import { getCalendarEvents } from "./calendar.service.js";

export async function getCalendarEventsController(req, res) {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate query params are required (YYYY-MM-DD)",
      });
    }

    const events = await getCalendarEvents({ startDate, endDate });
    return res.status(200).json({ success: true, events });
  } catch (err) {
    console.error("[calendar] getCalendarEvents error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
}
