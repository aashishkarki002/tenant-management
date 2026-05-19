import { useState } from "react";
import api from "../../plugins/axios";

const WARNING_TEXT = "RESET";

export default function DevToolsPage() {
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleReset = async () => {
    if (confirm !== WARNING_TEXT) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const { data } = await api.post("/api/dev/reset");
      setResult(data.deleted);
    } catch (err) {
      setError(err.response?.data?.message ?? err.message);
    } finally {
      setLoading(false);
      setConfirm("");
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-sm font-semibold text-destructive mb-1">DEV ENVIRONMENT ONLY</p>
        <p className="text-sm text-muted-foreground">
          Deletes all transactional data (tenants, rents, payments, ledger, journals, CAM,
          electricity, security deposits, etc.) and resets unit occupancy + counter sequences.
          Static data (accounts, units, buildings, banks, vendors) is preserved.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-base font-semibold">Reset Test Data</h2>

        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            Type <span className="font-mono font-bold text-foreground">{WARNING_TEXT}</span> to confirm
          </label>
          <input
            type="text"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={WARNING_TEXT}
            className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-destructive/50"
          />
        </div>

        <button
          onClick={handleReset}
          disabled={confirm !== WARNING_TEXT || loading}
          className="px-4 py-2 rounded-md text-sm font-medium bg-destructive text-destructive-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-destructive/90 transition-colors"
        >
          {loading ? "Resetting…" : "Reset All Test Data"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-green-600 dark:text-green-400">Reset complete</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {Object.entries(result).map(([key, count]) => (
              <div key={key} className="flex justify-between text-xs py-0.5 border-b border-border/50">
                <span className="text-muted-foreground font-mono">{key}</span>
                <span className={typeof count === "string" ? "text-destructive" : "font-medium tabular-nums"}>
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
