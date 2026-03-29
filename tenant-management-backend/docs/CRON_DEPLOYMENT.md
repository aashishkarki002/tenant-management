# Cron jobs and multi-instance deployments

The backend registers in-process schedules with `node-cron` when the HTTP server starts (see `src/server.js`). Each running Node process has its own timers.

## Daily checklist creation

Morning checklist results are created with an atomic upsert and a unique partial index on `(template, nepaliDate)` so concurrent writers cannot insert duplicate rows for the same template and Nepali calendar day.

If you run **multiple Node processes** (PM2 cluster mode, several containers, Kubernetes replicas), each instance still executes the same crons at 07:30, 10:30, and 16:30 NPT. The database layer prevents duplicate `ChecklistResult` documents, but you may still get duplicate **push notifications** or extra **CronLog** entries unless only one leader runs those jobs.

Recommended options:

1. **Single worker for the API that runs crons** — e.g. PM2 `instances: 1`, or a dedicated small process that only runs scheduled tasks.
2. **Distributed lock** — acquire a Redis-based lock (e.g. Redlock) at the start of each cron handler; skip if another instance holds the lock. The rent lifecycle cron in `src/cron/service/master-cron.js` notes the same pattern for multi-instance setups.

## Deploying the checklist unique index

If the database already contains duplicate checklist results for the same template and day, create the unique index only **after** deduplication:

1. Run `node scripts/dedupe-checklist-results.mjs` (use `DRY_RUN=1` first to preview).
2. Deploy the application so Mongoose builds the new index (or run `syncIndexes` / create the index manually in MongoDB).
