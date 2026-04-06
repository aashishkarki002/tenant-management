import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  MapPin,
  FileText,
  Key,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-3 sm:p-4 hover:border-blue-200 transition-colors duration-150">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-light">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium break-all text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

function DateCard({ icon: Icon, label, adDate, bsDate }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 sm:p-4 space-y-2">
      <div className="flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground w-5">AD</span>
          <span className="text-xs font-medium text-right text-foreground">{adDate || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground w-5">BS</span>
          <span className="text-xs font-semibold text-right text-foreground">{bsDate || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function AmountRow({ label, sublabel, value, highlight, muted }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${muted ? "opacity-70" : ""}`}>
      <div className="min-w-0">
        <p className={`text-xs sm:text-sm ${highlight ? "font-bold text-foreground" : "font-medium text-foreground"}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </div>
      <p className={`text-xs sm:text-sm whitespace-nowrap tabular-nums ${highlight ? "font-bold text-foreground" : "font-medium"} ${muted ? "text-muted-foreground" : ""}`}>
        {value || "—"}
      </p>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

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
    <div className="flex flex-col lg:flex-row gap-4">

      {/* ── Left column ─────────────────────────────────────────────────────── */}
      <div className="flex-[2] space-y-4">

        {/* Personal Info */}
        <Card className="border border-border shadow-sm rounded-xl bg-background">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <InfoCard icon={Mail} label="Email Address" value={tenant?.email} />
              <InfoCard icon={Phone} label="Contact Number" value={tenant?.phone} />
              <InfoCard icon={MapPin} label="Permanent Address" value={tenant?.address} />
            </div>
          </CardContent>
        </Card>

        {/* Lease Terms */}
        <Card className="border border-border shadow-sm rounded-xl bg-background">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Lease Terms
                </CardTitle>
              </div>
              <Badge
                variant="outline"
                className={`text-xs capitalize ${tenant?.status === "active"
                  ? "border-success-border text-success bg-success-light"
                  : "border-border text-muted-foreground bg-muted"
                  }`}
              >
                {tenant?.status ?? "—"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
            {/* Date cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <DateCard
                icon={CalendarDays}
                label="Start"
                adDate={leaseStartAD}
                bsDate={tenant?.leaseStartDateNepali}
              />
              <DateCard
                icon={CalendarDays}
                label="End"
                adDate={leaseEndAD}
                bsDate={tenant?.leaseEndDateNepali}
              />
              <DateCard
                icon={Key}
                label="Key Handover"
                adDate={keyHandoverAD}
                bsDate={tenant?.keyHandoverDateNepali}
              />
            </div>

            {/* Rent Escalation banner */}
            {tenant?.rentEscalation?.enabled && (
              <div className="flex items-center justify-between rounded-lg border border-warning-border bg-warning-light px-3 sm:px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-light">
                    <TrendingUp className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-warning">Rent Escalation Active</p>
                    <p className="text-xs text-warning mt-0.5">
                      {tenant.rentEscalation.percentageIncrease}% every{" "}
                      {tenant.rentEscalation.intervalMonths} months
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-warning">Next escalation</p>
                  <p className="text-xs font-semibold text-warning">
                    {tenant.rentEscalation.nextEscalationNepaliDate ?? "—"} BS
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Right column — Financial Snapshot ──────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <Card className="rounded-xl border border-border bg-background shadow-sm h-full">
          <CardHeader className="p-4 sm:p-5 pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Financial Snapshot
              </CardTitle>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Monthly rent breakdown</p>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0 space-y-3">

            {/* Rent Calculation block */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Rent Calculation
              </p>

              <AmountRow
                label="Price per Sqft"
                sublabel={`Area: ${tenant?.leasedSquareFeet ?? "—"} sqft`}
                value={tenant?.pricePerSqftFormatted}
              />

              <div className="flex items-center justify-between gap-4 py-2.5 opacity-70">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">TDS per Sqft</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    P − (P ÷ 1.1) · {tenant?.tdsPercentage ?? 10}%
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground tabular-nums">
                  −{tenant?.tdsFormatted}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 py-2.5 border-t border-border">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Rental Rate / Sqft</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Price − TDS/sqft</p>
                </div>
                <p className="text-xs sm:text-sm font-medium tabular-nums">{tenant?.rentalRateFormatted}</p>
              </div>

              {/* Final rent highlight */}
              <div className="flex items-center justify-between gap-4 py-2.5 px-3 -mx-1 mt-2 rounded-lg bg-primary-light border border-primary-border">
                <div>
                  <p className="text-xs sm:text-sm font-bold text-primary">Final Rent Amount</p>
                  <p className="text-xs text-primary mt-0.5">
                    {tenant?.leasedSquareFeet} sqft × {tenant?.rentalRateFormatted}/sqft
                  </p>
                </div>
                <p className="text-sm sm:text-base font-bold text-primary tabular-nums">
                  {tenant?.totalRentFormatted}
                </p>
              </div>
            </div>

            {/* CAM Charges block */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                CAM Charges
              </p>
              <AmountRow
                label="CAM Rate per Sqft"
                sublabel={`${tenant?.leasedSquareFeet} sqft × ${tenant?.camRatePerSqftFormatted}/sqft`}
                value={tenant?.camChargesFormatted}
              />
              <div className="flex items-center justify-between gap-4 py-2.5 px-3 -mx-1 mt-2 rounded-lg bg-muted/50 border border-border">
                <div>
                  <p className="text-xs sm:text-sm font-bold">Net Amount incl. CAM</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Final Rent + CAM</p>
                </div>
                <p className="text-sm sm:text-base font-bold tabular-nums">{tenant?.netAmountFormatted}</p>
              </div>
            </div>

            {/* Quarterly payment */}
            {tenant?.rentPaymentFrequency === "quarterly" && (
              <div className="rounded-lg border-2 border-primary-border bg-primary-light px-3 sm:px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                  Quarterly Payment
                </p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-primary">3 months × {tenant?.netAmountFormatted}</p>
                  <p className="text-base font-bold text-primary tabular-nums">
                    {tenant?.quarterlyRentAmountFormatted}
                  </p>
                </div>
              </div>
            )}

            <Separator />

            {/* Security Deposit */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 sm:px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Security Deposit
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">One-time</p>
              </div>
              <p className="text-base font-bold tabular-nums">{tenant?.securityDepositFormatted}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
