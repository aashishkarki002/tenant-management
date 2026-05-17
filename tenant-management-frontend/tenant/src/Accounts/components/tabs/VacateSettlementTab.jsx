import { useState, useEffect } from "react";
import { useVacateSettlement, useVacateList } from "../../hooks/useVacateSettlement";

import api from "../../../../plugins/axios";
import {Input} from "../../../components/ui/input";

import { fmtRs } from "../../../utils/formatter";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-NP", {
    year: "numeric", month: "short", day: "2-digit",
  });
}

function StatusBadge({ status }) {
  const map = {
    COMPLETED: "bg-green-100 text-green-800",
    DRAFT:     "bg-yellow-100 text-yellow-800",
    CANCELLED: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${map[status] ?? "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

function PreviewCard({ preview }) {
  const rows = [
    { label: "Existing AR (open charges)", value: preview.finalRentDuePaisa, color: "text-orange-600" },
    { label: `Pro-rated rent (${preview.proRatedDays}/${preview.totalDaysInMonth} days)`, value: preview.proRatedRentPaisa, color: "text-orange-600" },
    { label: "Pro-rated CAM", value: preview.proRatedCamPaisa, color: "text-orange-600" },
    { label: "Total AR at vacate", value: preview.totalArAtVacatePaisa, color: "font-bold text-[var(--color-text-body)]" },
    null,
    { label: "Security deposit held", value: preview.sdBalancePaisa, color: "text-[var(--color-text-sub)]" },
    { label: "Applied to AR", value: -preview.sdAppliedToArPaisa, color: "text-green-600" },
    { label: "Maintenance deduction", value: -preview.sdMaintenanceDeduction, color: "text-green-600" },
    { label: "Cash refund to tenant", value: -preview.sdCashRefundPaisa, color: "text-blue-600" },
    null,
    { label: "Bad debt write-off", value: preview.badDebtWrittenOffPaisa, color: "text-red-600" },
  ];

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-[13px] font-semibold text-[var(--color-text-body)] mb-3">Settlement Preview</h3>
      <div className="flex flex-col gap-1">
        {rows.map((row, i) =>
          row === null ? (
            <div key={i} className="border-t border-[var(--color-border)] my-1" />
          ) : row.value !== 0 && row.value != null ? (
            <div key={row.label} className="flex justify-between text-[12px]">
              <span className="text-[var(--color-text-sub)]">{row.label}</span>
              <span className={row.color}>{fmtRs(row.value)}</span>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}

export default function VacateSettlementTab({ entityId }) {
  const [tenants, setTenants] = useState([]);
  const [tenantId, setTenantId] = useState("");
  const [vacateDate, setVacateDate] = useState("");
  const [maintenanceDed, setMaintenanceDed] = useState(0);
  const [writeOff, setWriteOff] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { preview, computing, executing, error, compute, execute } =
    useVacateSettlement(entityId);
  const { settlements, refetch: refetchList } =
    useVacateList(entityId, undefined);

  // Load active tenants
  useEffect(() => {
    if (!entityId) return;
    api.get("/api/tenant", { params: { entityId, limit: 200 } })
      .then(r => setTenants((r.data?.tenants ?? r.data?.data ?? []).filter(t => t.vacateStatus !== "vacated")))
      .catch(() => {});
  }, [entityId]);

  const handleCompute = async () => {
    if (!tenantId || !vacateDate) return;
    await compute({
      tenantId,
      vacateDate,
      maintenanceDeductionPaisa: Math.round(maintenanceDed * 100),
      writeOffBadDebt: writeOff,
      paymentMethod,
      notes,
    });
  };

  const handleExecute = async () => {
    try {
      await execute({
        tenantId,
        paymentMethod,
        writeOffBadDebt: writeOff,
        notes,
      });
      setSuccessMsg("Settlement completed. Tenant ledger is now locked.");
      setShowConfirm(false);
      refetchList();
    } catch { /* error set by hook */ }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2 className="text-[15px] font-semibold text-[var(--color-text-body)]">
          Vacate Settlement
        </h2>
        <p className="text-[12px] text-[var(--color-text-sub)] mt-0.5">
          Pro-rate final charges, settle security deposit, lock tenant ledger
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-[12px] text-green-700 font-semibold">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
          {error}
        </div>
      )}

      {/* Wizard */}
      <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface)] flex flex-col gap-4">
        <h3 className="text-[13px] font-semibold text-[var(--color-text-body)]">New Settlement</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-[var(--color-text-sub)] mb-1 block">Tenant</label>
            <select
              value={tenantId}
              onChange={e => setTenantId(e.target.value)}
              className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
            >
              <option value="">Select tenant...</option>
              {tenants.map(t => (
                <option key={t._id} value={t._id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[var(--color-text-sub)] mb-1 block">Vacate Date</label>
            <Input
              type="date"
              value={vacateDate}
              onChange={e => setVacateDate(e.target.value)}
              className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--color-text-sub)] mb-1 block">Maintenance Deduction (Rs)</label>
            <input
              type="number"
              min="0"
              value={maintenanceDed}
              onChange={e => setMaintenanceDed(Number(e.target.value))}
              className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
            />
          </div>

          <div>
            <label className="text-[11px] text-[var(--color-text-sub)] mb-1 block">SD Refund Method</label>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
              className="w-full text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="writeoff"
            type="checkbox"
            checked={writeOff}
            onChange={e => setWriteOff(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="writeoff" className="text-[12px] text-[var(--color-text-body)]">
            Write off remaining AR as bad debt (if any balance remains after SD)
          </label>
        </div>

        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          className="text-[12px] px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text-body)]"
        />

        <button
          onClick={handleCompute}
          disabled={!tenantId || !vacateDate || computing}
          className="self-start px-4 py-2 text-[12px] font-semibold rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {computing ? "Computing..." : "Compute Preview"}
        </button>
      </div>

      {/* Preview */}
      {preview && (
        <>
          <PreviewCard preview={preview} />
          <button
            onClick={() => setShowConfirm(true)}
            className="self-start px-4 py-2 text-[12px] font-semibold rounded-lg bg-green-600 text-white hover:opacity-90 transition-opacity"
          >
            Execute Settlement
          </button>
        </>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-[var(--color-bg)] rounded-2xl border border-[var(--color-border)] p-6 shadow-2xl">
            <h3 className="text-[15px] font-bold text-[var(--color-text-body)] mb-2">
              Confirm Settlement
            </h3>
            <p className="text-[12px] text-[var(--color-text-sub)] mb-4">
              This will post all journals, lock the tenant&apos;s ledger, and mark them as vacated.
              <strong className="text-[var(--color-text-body)]"> This cannot be undone.</strong>
            </p>
            {error && <p className="text-[11px] text-red-600 mb-2">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--color-border)] text-[var(--color-text-sub)] hover:bg-[var(--color-surface)]"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                disabled={executing}
                className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-green-600 text-white hover:opacity-90 disabled:opacity-40"
              >
                {executing ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Past settlements list */}
      {settlements.length > 0 && (
        <div>
          <h3 className="text-[13px] font-semibold text-[var(--color-text-body)] mb-2">Settlement History</h3>
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Tenant</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Status</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Total AR</th>
                  <th className="text-right px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">SD Refund</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Vacate Date</th>
                  <th className="text-left px-4 py-2.5 font-semibold text-[var(--color-text-sub)]">Settled By</th>
                </tr>
              </thead>
              <tbody>
                {settlements.map((s) => (
                  <tr key={s._id} className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface)]">
                    <td className="px-4 py-2.5 text-[var(--color-text-body)]">{s.tenant?.name ?? "—"}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-2.5 text-right text-orange-600 font-mono">{fmtRs(s.totalArAtVacatePaisa)}</td>
                    <td className="px-4 py-2.5 text-right text-blue-600 font-mono">{fmtRs(s.sdCashRefundPaisa)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">{fmtDate(s.vacateDate)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-sub)]">{s.settledBy?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
