import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const fmtKwh = (n) =>
  `${Number(n ?? 0).toLocaleString("en-NP", {
    maximumFractionDigits: 1,
  })} kWh`;

const fmtRs = (n) =>
  `Rs ${Number(n ?? 0).toLocaleString("en-NP", {
    maximumFractionDigits: 0,
  })}`;

function KpiCard({ label, value, subtext, valueClass = "" }) {
  return (
    <Card className=" shadow-none">
      <CardContent className="flex flex-col gap-1 p-4">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>

        <div
          className={`text-2xl font-semibold tracking-tight tabular-nums ${valueClass}`}
        >
          {value}
        </div>

        {subtext ? (
          <span className="text-xs text-muted-foreground">{subtext}</span>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function ElectricityKpiStrip({
  grouped = {},
  summary = {},
  neaBill = null,
}) {
  const totalKwh =
    neaBill?.totalUnits ?? Number(summary.grandTotalUnits) ?? 0;

  const totalRevenue = Number(summary.grandTotalAmount) ?? 0;
  const totalMargin = Number(summary.grandTotalMargin) ?? 0;

  const marginPercent =
    totalRevenue > 0
      ? ((totalMargin / totalRevenue) * 100).toFixed(1)
      : null;

  const marginNegative = totalMargin < 0;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <KpiCard
        label="Consumption"
        value={fmtKwh(totalKwh)}
        subtext={neaBill ? "NEA bill" : "Tenant readings"}
      />

      <KpiCard
        label="Revenue"
        value={fmtRs(totalRevenue)}
        subtext={
          totalRevenue > 0 ? "Recovered from tenants" : "No billing yet"
        }
      />

      <KpiCard
        label="Margin"
        value={fmtRs(totalMargin)}
        valueClass={marginNegative ? "text-red-600" : ""}
        subtext={
          marginPercent !== null
            ? `${marginPercent}% ${
                marginNegative ? "below cost" : "margin"
              }`
            : "No data"
        }
      />
    </div>
  );
}