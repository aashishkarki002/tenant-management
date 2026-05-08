import { useState } from "react";
import { Card, Lbl, Skeleton } from "../AccountingPrimitives";
import { useAccounts } from "../../hooks/useAccounts";
import { useEntity } from "../../../context/EntityContext";
import { PencilIcon, CheckIcon, XIcon } from "lucide-react";

const ACCOUNT_TYPES = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"];

const TYPE_COLORS = {
  ASSET:     "var(--color-info)",
  LIABILITY: "var(--color-danger)",
  EQUITY:    "var(--color-success)",
  REVENUE:   "var(--color-primary)",
  EXPENSE:   "var(--color-warning)",
};

function EditableRow({ acct, onSave }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(acct.name);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    try {
      setSaving(true);
      await onSave(acct._id, { name });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-b border-[var(--color-border)]/30 hover:bg-[var(--color-surface-hover)] transition-colors group">
      <td className="py-2 pr-4 text-xs font-mono text-[var(--color-text-sub)]">{acct.code}</td>
      <td className="py-2 pr-4 text-xs text-[var(--color-text)]">
        {editing ? (
          <input
            className="border border-[var(--color-border)] rounded px-2 py-0.5 text-xs bg-[var(--color-surface)] text-[var(--color-text)] w-48"
            value={name} onChange={(e) => setName(e.target.value)} autoFocus
          />
        ) : name}
      </td>
      <td className="py-2 pr-4 text-xs font-semibold" style={{ color: TYPE_COLORS[acct.type] ?? "inherit" }}>
        {acct.type}
      </td>
      <td className="py-2 pr-4 text-right text-xs font-mono">
        {acct.currentBalancePaisa != null
          ? `Rs ${(acct.currentBalancePaisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : "—"}
      </td>
      <td className="py-2 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <button onClick={save} disabled={saving} className="w-6 h-6 rounded flex items-center justify-center bg-[var(--color-success)] text-white disabled:opacity-50">
              <CheckIcon size={12} />
            </button>
            <button onClick={() => { setEditing(false); setName(acct.name); }} className="w-6 h-6 rounded flex items-center justify-center bg-[var(--color-surface-hover)] text-[var(--color-text-sub)]">
              <XIcon size={12} />
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)} className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded flex items-center justify-center text-[var(--color-text-sub)] hover:bg-[var(--color-surface-hover)] transition-all ml-auto">
            <PencilIcon size={12} />
          </button>
        )}
      </td>
    </tr>
  );
}

export default function CoaManagementTab() {
  const { selectedEntity } = useEntity();
  const [typeFilter, setTypeFilter] = useState("");
  const { data, loading, error, refetch, create, update } = useAccounts(selectedEntity?.id ?? null, typeFilter || null);

  const [form, setForm] = useState({ code: "", name: "", type: "EXPENSE" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError(null);
      await create({ ...form, entityId: selectedEntity?.id });
      setForm({ code: "", name: "", type: "EXPENSE" });
    } catch (ex) {
      setFormError(ex.response?.data?.message ?? "Failed to create account");
    } finally {
      setSaving(false);
    }
  };

  // Group by type
  const grouped = {};
  for (const a of data) {
    (grouped[a.type] = grouped[a.type] ?? []).push(a);
  }

  return (
    <div className="space-y-4">
      {/* Add account form */}
      <Card>
        <div className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-sub)] mb-3">Add Account</div>
        <form onSubmit={handleCreate} className="flex flex-wrap gap-3 items-end">
          <div>
            <Lbl>Code</Lbl>
            <input type="text" required
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-24"
              value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="e.g. 5100" />
          </div>
          <div>
            <Lbl>Name</Lbl>
            <input type="text" required
              className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)] w-48"
              value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Account name" />
          </div>
          <div>
            <Lbl>Type</Lbl>
            <select className="border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-raised)] text-[var(--color-text)]"
              value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-[var(--color-primary)] disabled:opacity-50">
            {saving ? "Saving…" : "Add Account"}
          </button>
        </form>
        {formError && <div className="mt-2 text-xs text-[var(--color-danger)]">{formError}</div>}
      </Card>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTypeFilter("")}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!typeFilter ? "bg-[var(--color-primary)] text-white" : "bg-[var(--color-surface-raised)] text-[var(--color-text-sub)] border border-[var(--color-border)]"}`}>
          All
        </button>
        {ACCOUNT_TYPES.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${typeFilter === t ? "text-white" : "bg-[var(--color-surface-raised)] text-[var(--color-text-sub)] border border-[var(--color-border)]"}`}
            style={typeFilter === t ? { background: TYPE_COLORS[t] } : {}}>
            {t}
          </button>
        ))}
      </div>

      {loading && <div className="space-y-2">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>}
      {error && <div className="p-4 text-sm text-[var(--color-danger)] text-center">{error} <button onClick={refetch} className="underline ml-2 text-xs">Retry</button></div>}

      {!loading && !error && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {["Code", "Name", "Type", "Balance", ""].map((h) => (
                    <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-sub)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-xs text-[var(--color-text-sub)]">No accounts</td></tr>
                )}
                {ACCOUNT_TYPES.filter((t) => !typeFilter || t === typeFilter).map((type) =>
                  (grouped[type] ?? []).map((acct) => (
                    <EditableRow key={acct._id} acct={acct} onSave={update} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
