/**
 * NeaBillSection
 *
 * Two-tab module scoped to the current billing period:
 *   Tab "NEA Bill"  — bill document + pay button + bill history
 *   Tab "Readings"  — tenant unit readings + building sub-meter readings
 *
 * Props:
 *   bill            {Object|null}  current NeaBill doc (with reconciliation)
 *   bills           {Array}        all bills for history
 *   grouped         {Object}       useElectricityData grouped output
 *   loading         {boolean}      bills loading
 *   onPay           {Function}     (billId, paymentData) => Promise
 *   paying          {boolean}
 *   onUpload        {Function}     open upload dialog
 */

import React, { useState } from "react";
import {
  FileText,
  Zap,
  Building2,
  PlusCircle,
  AlertCircle,
  TrendingUp,
} from "lucide-react";
import { NeaBillCard } from "./NeaBillCard";
import { NeaBillHistory } from "./NeaBillHistory";

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const fmtRs = (n) =>
  `Rs\u00a0${Number(n ?? 0).toLocaleString("en-NP", { maximumFractionDigits: 0 })}`;
const fmtKwh = (n) =>
  `${Number(n ?? 0).toLocaleString("en-NP", { maximumFractionDigits: 1 })} kWh`;

const STATUS_COLOR = {
  paid:          { text: "var(--color-success)", bg: "var(--color-success-bg)" },
  partially_paid:{ text: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  pending:       { text: "var(--color-text-sub)", bg: "var(--color-muted)" },
  overdue:       { text: "var(--color-danger)",  bg: "#fee2e2" },
};

/* ─── Tabs ──────────────────────────────────────────────────────────────────── */

function Tab({ id, active, icon: Icon, label, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "9px 16px",
        fontSize: "13px",
        fontWeight: active ? 700 : 500,
        color: active ? "var(--color-accent)" : "var(--color-text-sub)",
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--color-accent)" : "2px solid transparent",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "color 150ms, border-color 150ms",
        marginBottom: "-1px",
      }}
    >
      <Icon size={13} />
      {label}
      {badge != null && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "99px",
            backgroundColor: active ? "var(--color-accent-light)" : "var(--color-muted)",
            color: active ? "var(--color-accent)" : "var(--color-text-sub)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ─── Empty states ──────────────────────────────────────────────────────────── */

function NoBillState({ onUpload }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        padding: "40px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          backgroundColor: "var(--color-accent-light)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Zap size={20} color="var(--color-accent)" />
      </div>
      <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>
        No NEA bill recorded
      </p>
      <p style={{ fontSize: "12px", color: "var(--color-text-sub)", margin: 0, maxWidth: "260px" }}>
        Record the monthly NEA bill first. Tenant readings are reconciled against it.
      </p>
      {onUpload && (
        <button
          type="button"
          onClick={onUpload}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "8px 16px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--color-accent)",
            backgroundColor: "var(--color-accent-light)",
            color: "var(--color-accent)",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            marginTop: "4px",
          }}
        >
          <PlusCircle size={13} />
          Record NEA Bill
        </button>
      )}
    </div>
  );
}

/* ─── Tenant readings table ─────────────────────────────────────────────────── */

function TenantReadingsTable({ readings = [] }) {
  if (!readings.length) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", color: "var(--color-text-sub)" }}>
          No unit readings for this period
        </p>
      </div>
    );
  }

  // Summary row
  const totalKwh   = readings.reduce((s, r) => s + (r.consumption ?? 0), 0);
  const totalBilled = readings.reduce((s, r) => s + (r.totalAmountPaisa ?? 0), 0);
  const totalNeaCost = readings.reduce((s, r) => s + (r.neaCostPaisa ?? 0), 0);
  const totalPaid  = readings.reduce((s, r) => s + (r.paidAmountPaisa ?? 0), 0);
  const totalPending = Math.max(0, totalBilled - totalPaid);

  return (
    <div>
      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
              {["Unit", "Tenant", "Prev → Curr", "kWh", "Rate", "Billed", "Paid", "Status"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "7px 12px",
                    textAlign: h === "Unit" || h === "Tenant" ? "left" : "right",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--color-text-sub)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {readings.map((r) => {
              const sc = STATUS_COLOR[r.status] ?? STATUS_COLOR.pending;
              const unitName = r.unit?.unitName ?? r.unit?.name ?? "—";
              const blockName = r.unit?.block?.name ? `${r.unit.block.name} · ` : "";
              const tenantName = r.tenant?.name ?? "Vacant";
              const rate = r.ratePerUnitPaisa != null ? `Rs\u00a0${(r.ratePerUnitPaisa / 100).toFixed(2)}` : "—";

              return (
                <tr
                  key={r._id}
                  style={{
                    borderBottom: "1px solid var(--color-border)",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
                >
                  <td style={{ padding: "9px 12px" }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "var(--color-text-strong)" }}>{unitName}</p>
                    {blockName && <p style={{ margin: 0, fontSize: "10px", color: "var(--color-text-sub)" }}>{blockName.replace(" · ", "")}</p>}
                  </td>
                  <td style={{ padding: "9px 12px", color: "var(--color-text-body)" }}>{tenantName}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-sub)" }}>
                    {r.previousReading} → {r.currentReading}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums" }}>
                    {Number(r.consumption ?? 0).toLocaleString("en-NP")}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--color-text-sub)", fontVariantNumeric: "tabular-nums" }}>
                    {rate}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-text-strong)" }}>
                    {fmtRs(r.totalAmountPaisa)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-sub)" }}>
                    {fmtRs(r.paidAmountPaisa ?? 0)}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "99px",
                        color: sc.text,
                        backgroundColor: sc.bg,
                        textTransform: "capitalize",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.status?.replace("_", " ") ?? "pending"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer summary */}
      <div
        style={{
          display: "flex",
          gap: "24px",
          padding: "10px 14px",
          backgroundColor: "var(--color-muted)",
          borderTop: "2px solid var(--color-border)",
          flexWrap: "wrap",
        }}
      >
        <SumCell label="Total kWh" value={fmtKwh(totalKwh)} accent />
        <SumCell label="Total Billed" value={fmtRs(totalBilled)} accent />
        {totalNeaCost > 0 && <SumCell label="NEA Cost" value={fmtRs(totalNeaCost)} />}
        <SumCell label="Collected" value={fmtRs(totalPaid)} />
        {totalPending > 0 && <SumCell label="Outstanding" value={fmtRs(totalPending)} warn />}
      </div>
    </div>
  );
}

/* ─── Building meters table ─────────────────────────────────────────────────── */

function BuildingMetersTable({ grouped = {} }) {
  const buildingTypes = ["common_area", "parking", "sub_meter"];
  const LABELS = { common_area: "Common Area", parking: "Parking", sub_meter: "Sub-Meter" };

  const allReadings = buildingTypes.flatMap((t) => (grouped[t]?.readings ?? []).map((r) => ({ ...r, _typeLabel: LABELS[t] })));

  if (!allReadings.length) {
    return (
      <div style={{ padding: "24px", textAlign: "center" }}>
        <p style={{ fontSize: "13px", color: "var(--color-text-sub)" }}>
          No building meter readings for this period
        </p>
      </div>
    );
  }

  const totalKwh    = allReadings.reduce((s, r) => s + (r.consumption ?? 0), 0);
  const totalNeaCost = allReadings.reduce((s, r) => s + (r.neaCostPaisa ?? 0), 0);

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ backgroundColor: "var(--color-muted)", borderBottom: "1px solid var(--color-border)" }}>
              {["Type", "Meter / Location", "Prev → Curr", "kWh", "NEA Rate", "NEA Cost"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "7px 12px",
                    textAlign: h === "Type" || h === "Meter / Location" ? "left" : "right",
                    fontSize: "10px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    color: "var(--color-text-sub)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allReadings.map((r) => {
              const meterName = r.subMeter?.name ?? r.subMeter?.locationLabel ?? "—";
              const neaRate = r.neaRatePerUnitPaisa != null ? `Rs\u00a0${(r.neaRatePerUnitPaisa / 100).toFixed(2)}` : "—";

              return (
                <tr
                  key={r._id}
                  style={{ borderBottom: "1px solid var(--color-border)", transition: "background 120ms" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--color-muted)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = ""; }}
                >
                  <td style={{ padding: "9px 12px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        fontWeight: 700,
                        padding: "2px 7px",
                        borderRadius: "99px",
                        color: "var(--color-accent)",
                        backgroundColor: "var(--color-accent-light)",
                      }}
                    >
                      {r._typeLabel}
                    </span>
                  </td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "var(--color-text-strong)" }}>
                    {meterName}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--color-text-sub)" }}>
                    {r.previousReading} → {r.currentReading}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-text-strong)" }}>
                    {Number(r.consumption ?? 0).toLocaleString("en-NP")}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", color: "var(--color-text-sub)", fontVariantNumeric: "tabular-nums" }}>
                    {neaRate}
                  </td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "var(--color-text-strong)" }}>
                    {r.neaCostPaisa != null ? fmtRs(r.neaCostPaisa) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          display: "flex",
          gap: "24px",
          padding: "10px 14px",
          backgroundColor: "var(--color-muted)",
          borderTop: "2px solid var(--color-border)",
          flexWrap: "wrap",
        }}
      >
        <SumCell label="Total kWh" value={fmtKwh(totalKwh)} accent />
        {totalNeaCost > 0 && <SumCell label="Total NEA Cost" value={fmtRs(totalNeaCost)} accent />}
      </div>
    </div>
  );
}

/* ─── Readings tab ──────────────────────────────────────────────────────────── */

function ReadingsTab({ grouped = {}, bill }) {
  const unitCount   = grouped.unit?.count ?? 0;
  const buildingCount = (grouped.common_area?.count ?? 0) + (grouped.parking?.count ?? 0) + (grouped.sub_meter?.count ?? 0);
  const totalKwh    = (grouped.unit?.totalUnits ?? 0) + (grouped.common_area?.totalUnits ?? 0) + (grouped.parking?.totalUnits ?? 0) + (grouped.sub_meter?.totalUnits ?? 0);
  const billUnits   = bill?.totalUnits;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Coverage bar — metered vs purchased */}
      {billUnits != null && totalKwh > 0 && (
        <div
          style={{
            padding: "12px 16px",
            backgroundColor: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)" }}>
              Unit Coverage
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-strong)", fontVariantNumeric: "tabular-nums" }}>
              {fmtKwh(totalKwh)} / {fmtKwh(billUnits)}
              <span style={{ fontWeight: 400, color: "var(--color-text-sub)", marginLeft: "6px" }}>
                ({((totalKwh / billUnits) * 100).toFixed(1)}% accounted)
              </span>
            </span>
          </div>
          <div style={{ height: "6px", backgroundColor: "var(--color-border)", borderRadius: "99px", overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (totalKwh / billUnits) * 100).toFixed(1)}%`,
                backgroundColor: totalKwh > billUnits ? "var(--color-warning)" : "var(--color-accent)",
                borderRadius: "99px",
                transition: "width 400ms ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Tenant unit readings */}
      <Section
        title="Tenant Meters"
        icon={TrendingUp}
        badge={unitCount || null}
        badgeColor="var(--color-accent)"
        badgeBg="var(--color-accent-light)"
      >
        <TenantReadingsTable readings={grouped.unit?.readings ?? []} />
      </Section>

      {/* Building meter readings */}
      {buildingCount > 0 && (
        <Section
          title="Building Meters"
          icon={Building2}
          badge={buildingCount}
          badgeColor="var(--color-text-sub)"
          badgeBg="var(--color-muted)"
        >
          <BuildingMetersTable grouped={grouped} />
        </Section>
      )}

      {unitCount === 0 && buildingCount === 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "16px",
            backgroundColor: "var(--color-muted)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <AlertCircle size={15} color="var(--color-text-sub)" />
          <p style={{ fontSize: "13px", color: "var(--color-text-sub)", margin: 0 }}>
            No readings recorded for this period. Add readings to reconcile against the NEA bill.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Section wrapper ───────────────────────────────────────────────────────── */

function Section({ title, icon: Icon, badge, badgeColor, badgeBg, children }) {
  return (
    <div
      style={{
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        backgroundColor: "var(--color-surface-raised)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        <Icon size={13} color="var(--color-accent)" />
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-strong)", flex: 1 }}>
          {title}
        </span>
        {badge != null && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "99px",
              color: badgeColor,
              backgroundColor: badgeBg,
            }}
          >
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─── Summary cell ──────────────────────────────────────────────────────────── */

function SumCell({ label, value, accent, warn }) {
  return (
    <div>
      <p style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--color-text-sub)", margin: "0 0 1px 0" }}>
        {label}
      </p>
      <p
        style={{
          fontSize: "13px",
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          margin: 0,
          color: warn
            ? "var(--color-danger)"
            : accent
            ? "var(--color-accent)"
            : "var(--color-text-strong)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

/* ─── Main export ───────────────────────────────────────────────────────────── */

export function NeaBillSection({
  bill,
  bills = [],
  grouped = {},
  loading = false,
  onPay,
  paying = false,
  onUpload,
}) {
  const [tab, setTab] = useState("bill");

  const unitCount    = grouped.unit?.count ?? 0;
  const buildingCount = (grouped.common_area?.count ?? 0) + (grouped.parking?.count ?? 0) + (grouped.sub_meter?.count ?? 0);
  const totalReadings = unitCount + buildingCount;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-raised)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid var(--color-border)",
          backgroundColor: "var(--color-surface)",
          paddingLeft: "4px",
          paddingRight: "12px",
        }}
      >
        <div style={{ display: "flex" }}>
          <Tab
            id="bill"
            active={tab === "bill"}
            icon={FileText}
            label="NEA Bill"
            badge={bills.length > 0 ? bills.length : null}
            onClick={setTab}
          />
          <Tab
            id="readings"
            active={tab === "readings"}
            icon={Zap}
            label="Meter Readings"
            badge={totalReadings > 0 ? totalReadings : null}
            onClick={setTab}
          />
        </div>

        {/* Upload shortcut in header */}
        {onUpload && (
          <button
            type="button"
            onClick={onUpload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--color-accent)",
              background: "none",
              border: "1px solid var(--color-accent)",
              borderRadius: "var(--radius-md)",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            <PlusCircle size={11} />
            Record Bill
          </button>
        )}
      </div>

      {/* Tab content */}
      <div style={{ padding: "16px" }}>
        {tab === "bill" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {bill ? (
              <NeaBillCard bill={bill} onPay={onPay} paying={paying} />
            ) : (
              <NoBillState onUpload={onUpload} />
            )}
            <NeaBillHistory bills={bills} loading={loading} />
          </div>
        ) : (
          <ReadingsTab grouped={grouped} bill={bill} />
        )}
      </div>
    </div>
  );
}
