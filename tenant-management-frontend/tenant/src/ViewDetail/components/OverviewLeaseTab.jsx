import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  MapPin,
  Key,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeading({ children }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-widest mb-3"
      style={{ color: "var(--color-text-weak)" }}
    >
      {children}
    </p>
  );
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon
        className="w-3.5 h-3.5 mt-0.5 shrink-0"
        style={{ color: "var(--color-text-sub)" }}
      />
      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
        <span className="text-xs" style={{ color: "var(--color-text-sub)" }}>
          {label}
        </span>
        <span
          className="text-xs font-medium text-right break-all"
          style={{ color: "var(--color-text-body)" }}
        >
          {value || "—"}
        </span>
      </div>
    </div>
  );
}

function DateBlock({ icon: Icon, label, adDate, bsDate }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3 h-3 shrink-0" style={{ color: "var(--color-text-weak)" }} />
        <span className="text-xs font-medium" style={{ color: "var(--color-text-sub)" }}>
          {label}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug" style={{ color: "var(--color-text-strong)" }}>
        {bsDate || "—"} <span className="font-normal text-xs" style={{ color: "var(--color-text-weak)" }}>BS</span>
      </p>
      {adDate && (
        <p className="text-xs mt-0.5" style={{ color: "var(--color-text-sub)" }}>
          {adDate}
        </p>
      )}
    </div>
  );
}

function AmountLine({ label, sublabel, value, bold, muted }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0 ${muted ? "opacity-60" : ""}`}
    >
      <div className="min-w-0">
        <p
          className={`text-xs ${bold ? "font-semibold" : "font-medium"}`}
          style={{ color: bold ? "var(--color-text-strong)" : "var(--color-text-body)" }}
        >
          {label}
        </p>
        {sublabel && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-text-weak)" }}>
            {sublabel}
          </p>
        )}
      </div>
      <p
        className={`text-xs tabular-nums whitespace-nowrap ${bold ? "font-semibold" : ""}`}
        style={{ color: bold ? "var(--color-text-strong)" : "var(--color-text-sub)" }}
      >
        {value || "—"}
      </p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function OverviewLeaseTab({ tenant }) {
  const leaseStartAD = tenant?.leaseStartDate
    ? new Date(tenant.leaseStartDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;
  const leaseEndAD = tenant?.leaseEndDate
    ? new Date(tenant.leaseEndDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;
  const keyHandoverAD = tenant?.keyHandoverDate
    ? new Date(tenant.keyHandoverDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : null;

  return (
    <div className="flex flex-col lg:flex-row gap-8">

      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div className="flex-[2] space-y-8">

        {/* Personal Info */}
        <section>
          <SectionHeading>Personal Information</SectionHeading>
          <InfoRow icon={Mail}  label="Email"   value={tenant?.email}   />
          <InfoRow icon={Phone} label="Phone"   value={tenant?.phone}   />
          <InfoRow icon={MapPin} label="Address" value={tenant?.address} />
        </section>

        {/* Lease Terms */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <SectionHeading>Lease Terms</SectionHeading>
            {tenant?.status && (
              <span
                className="text-xs font-medium capitalize px-2 py-0.5 rounded-full"
                style={{
                  background: tenant.status === "active"
                    ? "var(--color-success-light)"
                    : "var(--color-surface)",
                  color: tenant.status === "active"
                    ? "var(--color-success)"
                    : "var(--color-text-sub)",
                  border: `1px solid ${tenant.status === "active"
                    ? "var(--color-success-border)"
                    : "var(--color-border)"}`,
                }}
              >
                {tenant.status}
              </span>
            )}
          </div>

          {/* Date grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5 pb-5 border-b border-border">
            <DateBlock icon={CalendarDays} label="Start"        adDate={leaseStartAD}  bsDate={tenant?.leaseStartDateNepali} />
            <DateBlock icon={CalendarDays} label="End"          adDate={leaseEndAD}    bsDate={tenant?.leaseEndDateNepali}   />
            <DateBlock icon={Key}          label="Key Handover" adDate={keyHandoverAD} bsDate={tenant?.keyHandoverDateNepali} />
          </div>

          {/* Rent Escalation */}
          {tenant?.rentEscalation?.enabled && (
            <div
              className="mt-4 flex items-center justify-between rounded-lg px-4 py-3"
              style={{
                background: "var(--color-warning-light)",
                border: "1px solid var(--color-warning-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-warning)" }} />
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
                    Rent Escalation Active
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-warning)" }}>
                    {tenant.rentEscalation.percentageIncrease}% every{" "}
                    {tenant.rentEscalation.intervalMonths} months
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: "var(--color-warning)" }}>Next</p>
                <p className="text-xs font-semibold" style={{ color: "var(--color-warning)" }}>
                  {tenant.rentEscalation.nextEscalationNepaliDate ?? "—"} BS
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Right column — Financial Snapshot ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <section>
          <div className="mb-4">
            <SectionHeading>Financial Snapshot</SectionHeading>
            <p className="text-xs -mt-2" style={{ color: "var(--color-text-weak)" }}>
              Monthly rent breakdown
            </p>
          </div>

          {/* Rent Calculation */}
          <div className="mb-5">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-sub)" }}>
              Rent Calculation
            </p>
            <AmountLine
              label="Price per Sqft"
              sublabel={`Area: ${tenant?.leasedSquareFeet ?? "—"} sqft`}
              value={tenant?.pricePerSqftFormatted}
            />
            <AmountLine
              label="TDS per Sqft"
              sublabel={`P − (P ÷ 1.1) · ${tenant?.tdsPercentage ?? 10}%`}
              value={`−${tenant?.tdsFormatted}`}
              muted
            />
            <AmountLine
              label="Rental Rate / Sqft"
              sublabel="Price − TDS/sqft"
              value={tenant?.rentalRateFormatted}
            />
            {/* Final rent highlight */}
            <div
              className="mt-3 flex items-center justify-between gap-4 rounded-lg px-3 py-3"
              style={{
                background: "var(--color-accent-light)",
                border: "1px solid var(--color-accent-mid)",
              }}
            >
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--color-accent)" }}>
                  Final Rent
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-accent)" }}>
                  {tenant?.leasedSquareFeet} sqft × {tenant?.rentalRateFormatted}/sqft
                </p>
              </div>
              <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>
                {tenant?.totalRentFormatted}
              </p>
            </div>
          </div>

          {/* CAM Charges */}
          <div className="mb-5 pt-4 border-t border-border">
            <p className="text-xs font-medium mb-1" style={{ color: "var(--color-text-sub)" }}>
              CAM Charges
            </p>
            <AmountLine
              label="CAM Rate per Sqft"
              sublabel={`${tenant?.leasedSquareFeet} sqft × ${tenant?.camRatePerSqftFormatted}/sqft`}
              value={tenant?.camChargesFormatted}
            />
            <div className="flex items-center justify-between gap-4 pt-2.5 mt-0.5">
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--color-text-strong)" }}>
                  Net Amount incl. CAM
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--color-text-weak)" }}>
                  Final Rent + CAM
                </p>
              </div>
              <p className="text-sm font-bold tabular-nums" style={{ color: "var(--color-text-strong)" }}>
                {tenant?.netAmountFormatted}
              </p>
            </div>
          </div>

          {/* Quarterly payment */}
          {tenant?.rentPaymentFrequency === "quarterly" && (
            <div
              className="mb-5 rounded-lg px-3 py-3"
              style={{
                background: "var(--color-accent-light)",
                border: "1px solid var(--color-accent-mid)",
              }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "var(--color-accent)" }}>
                Quarterly Payment
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs" style={{ color: "var(--color-accent)" }}>
                  3 months × {tenant?.netAmountFormatted}
                </p>
                <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>
                  {tenant?.quarterlyRentAmountFormatted}
                </p>
              </div>
            </div>
          )}

          {/* Security Deposit */}
          <div className="pt-4 border-t border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-text-sub)" }}>
                Security Deposit
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--color-text-weak)" }}>One-time</p>
            </div>
            <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-text-strong)" }}>
              {tenant?.securityDepositFormatted}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
