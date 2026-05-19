import { CronLog } from "./model/CronLog.js";
import { masterCron } from "./service/master-cron.js";

// GET /api/cron-logs/runs?page=1&limit=20
// Returns one entry per runId (latest step timestamp, overall success, step summary)
export async function getRuns(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [runs, total] = await Promise.all([
      CronLog.aggregate([
        { $sort: { ranAt: -1 } },
        {
          $group: {
            _id: { $ifNull: ["$runId", { $dateToString: { format: "%Y-%m-%d", date: "$ranAt" } }] },
            runId:     { $first: "$runId" },
            ranAt:     { $first: "$ranAt" },
            steps:     { $sum: 1 },
            succeeded: { $sum: { $cond: ["$success", 1, 0] } },
            failed:    { $sum: { $cond: ["$success", 0, 1] } },
            types:     { $push: "$type" },
          },
        },
        { $sort: { ranAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
      CronLog.aggregate([
        { $group: { _id: { $ifNull: ["$runId", { $dateToString: { format: "%Y-%m-%d", date: "$ranAt" } }] } } },
        { $count: "total" },
      ]),
    ]);

    res.json({ runs, total: total[0]?.total ?? 0, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/cron-logs/runs/:runId
// runId is either a UUID (new records) or a YYYY-MM-DD date string (legacy records with no runId)
export async function getRunDetail(req, res) {
  try {
    const { runId } = req.params;

    // Try UUID-based lookup first
    let steps = await CronLog.find({ runId }).sort({ ranAt: 1 }).lean();

    // Legacy records have no runId — grouped by date string (aggregation used UTC date).
    // Use a ±1 day window to tolerate NPT (UTC+5:45) timezone offset.
    if (!steps.length && /^\d{4}-\d{2}-\d{2}$/.test(runId)) {
      const dayStart = new Date(`${runId}T00:00:00.000Z`);
      dayStart.setDate(dayStart.getDate() - 1);
      const dayEnd = new Date(`${runId}T23:59:59.999Z`);
      dayEnd.setDate(dayEnd.getDate() + 1);
      steps = await CronLog.find({
        runId: { $exists: false },
        ranAt: { $gte: dayStart, $lte: dayEnd },
      }).sort({ ranAt: 1 }).lean();
    }

    if (!steps.length) return res.status(404).json({ message: "Run not found" });
    res.json({ runId, steps });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// GET /api/cron-logs?type=MONTHLY_EMAIL&page=1&limit=50
// Raw log access with optional type filter
export async function getLogs(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 30);
    const filter = {};
    if (req.query.type) filter.type = req.query.type;

    const [logs, total] = await Promise.all([
      CronLog.find(filter).sort({ ranAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      CronLog.countDocuments(filter),
    ]);
    res.json({ logs, total, page, limit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

// POST /api/cron-logs/trigger  (admin only, manual run)
export async function triggerCron(req, res) {
  try {
    res.json({ message: "Cron run triggered" });
    // Fire in background after response — don't await (can take seconds)
    masterCron({ forceRun: true }).catch((e) =>
      console.error("[triggerCron]", e.message),
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}
