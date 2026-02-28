import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, FileText, Key, CalendarDays, TrendingUp } from "lucide-react";
import { toNepaliDate } from "../../utils/formatNepali";
import { Separator } from "@/components/ui/separator";

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-white p-3 sm:p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-all mt-0.5">{value || "—"}</p>
      </div>
    </div>
  );
}

function DateField({ label, adDate, bsDate }) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-wide font-medium text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground w-6">AD</span>
          <span className="text-xs font-medium text-right">{adDate || "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground w-6">BS</span>
          <span className="text-xs font-semibold text-right">{bsDate || "—"}</span>
        </div>
      </div>
    </div>
  );
}

function FinancialRow({ label, value, sublabel, highlight, muted, topBorder }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 ${topBorder ? "border-t pt-3 mt-1" : ""}`}>
      <div>
        <p className={`text-xs sm:text-sm ${highlight ? "font-bold text-foreground" : muted ? "text-muted-foreground" : "font-medium"}`}>
          {label}
        </p>
        {sublabel && <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
      <p className={`text-xs sm:text-sm whitespace-nowrap ${highlight ? "font-bold text-foreground" : muted ? "text-muted-foreground" : "font-medium"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

export function OverviewLeaseTab({ tenant }) {
  const leaseStartAD = tenant?.leaseStartDate ? new Date(tenant.leaseStartDate).toDateString() : null;
  const leaseEndAD = tenant?.leaseEndDate ? new Date(tenant.leaseEndDate).toDateString() : null;
  const keyHandoverAD = tenant?.keyHandoverDate ? new Date(tenant.keyHandoverDate).toDateString() : null;

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left column — Personal Info + Lease Terms */}
      <div className="flex-[2] space-y-4">
        {/* Personal Info */}
        <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
          <CardHeader className="p-4 sm:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg">Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              <InfoCard icon={Mail} label="Email Address" value={tenant?.email} />
              <InfoCard icon={Phone} label="Contact Number" value={tenant?.phone} />
              <InfoCard icon={MapPin} label="Permanent Address" value={tenant?.address} />
            </div>
          </CardContent>
        </Card>

        {/* Lease Terms */}
        <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
          <CardHeader className="p-4 sm:p-6 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Lease Terms
              </CardTitle>
              <Badge variant={tenant?.status === "active" ? "default" : "secondary"} className="capitalize text-xs">
                {tenant?.status ?? "—"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-3">
            {/* Dates grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border bg-white p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wide font-medium">Start</span>
                </div>
                <DateField
                  adDate={leaseStartAD}
                  bsDate={tenant?.leaseStartDateNepali}
                />
              </div>
              <div className="rounded-lg border bg-white p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wide font-medium">End</span>
                </div>
                <DateField
                  adDate={leaseEndAD}
                  bsDate={tenant?.leaseEndDateNepali}
                />
              </div>
              <div className="rounded-lg border bg-white p-3 sm:p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Key className="w-3.5 h-3.5" />
                  <span className="text-xs uppercase tracking-wide font-medium">Key Handover</span>
                </div>
                <DateField
                  adDate={keyHandoverAD}
                  bsDate={tenant?.keyHandoverDateNepali}
                />
              </div>
            </div>

            {/* Rent Escalation badge if enabled */}
            {tenant?.rentEscalation?.enabled && (
              <div className="flex items-center justify-between rounded-lg border bg-amber-50 border-amber-200 px-3 sm:px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <div>
                    <span className="text-xs sm:text-sm font-medium text-amber-800">
                      Rent Escalation Active
                    </span>
                    <p className="text-xs text-amber-600 mt-0.5">
                      {tenant.rentEscalation.percentageIncrease}% every {tenant.rentEscalation.intervalMonths} months
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-600">Next escalation</p>
                  <p className="text-xs font-semibold text-amber-800">{tenant.rentEscalation.nextEscalationNepaliDate ?? "—"} BS</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right column — Financial Snapshot */}
      <div className="flex-1">
        <Card className="rounded-xl border border-border bg-gray-50 shadow-sm h-full">
          <CardHeader className="p-4 sm:p-6 pb-3">
            <CardTitle className="text-base sm:text-lg">Financial Snapshot</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Monthly rent breakdown
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-2">
            {/* Step 1–4: Rent derivation */}
            <div className="rounded-lg border bg-white p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-3">Rent Calculation</p>

              {/* Row: Price per sqft */}
              <FinancialRow
                label="Price per Sqft"
                sublabel={`Area: ${tenant?.leasedSquareFeet} sqft`}
                value={tenant?.pricePerSqftFormatted}
              />

              {/* Row: TDS per sqft — deduction */}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">TDS per Sqft</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    P − (P ÷ 1.1) &nbsp;·&nbsp; {tenant?.tdsPercentage ?? 10}%
                  </p>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground">−{tenant?.tdsFormatted?.replace("Rs.", "Rs.")}</p>
              </div>

              {/* Row: Rental Rate per sqft */}
              <div className="flex items-center justify-between gap-4 py-2.5 border-t">
                <div>
                  <p className="text-xs sm:text-sm font-medium">Rental Rate per Sqft</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Price − TDS/sqft</p>
                </div>
                <p className="text-xs sm:text-sm font-medium">{tenant?.rentalRateFormatted}</p>
              </div>

              {/* Row: Final Rent Amount = A × RR */}
              <div className="flex items-center justify-between gap-4 py-2.5 border-t bg-muted/40 rounded-md px-2 -mx-2 mt-1">
                <div>
                  <p className="text-xs sm:text-sm font-bold">Final Rent Amount</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tenant?.leasedSquareFeet} sqft × {tenant?.rentalRateFormatted}/sqft
                  </p>
                </div>
                <p className="text-sm sm:text-base font-bold">{tenant?.totalRentFormatted}</p>
              </div>
            </div>

            {/* CAM Charges — additive on top of rent */}
            <div className="rounded-lg border bg-white p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-3">CAM Charges</p>
              <FinancialRow
                label="CAM Rate per Sqft"
                sublabel={`${tenant?.leasedSquareFeet} sqft × ${tenant?.camRatePerSqftFormatted}/sqft`}
                value={tenant?.camChargesFormatted}
              />
              <div className="flex items-center justify-between gap-4 py-2.5 border-t bg-muted/40 rounded-md px-2 -mx-2 mt-1">
                <div>
                  <p className="text-xs sm:text-sm font-bold">Net Amount incl. CAM</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Final Rent + CAM</p>
                </div>
                <p className="text-sm sm:text-base font-bold">{tenant?.netAmountFormatted}</p>
              </div>
            </div>

            {/* Quarterly payment — only if applicable */}
            {tenant?.rentPaymentFrequency === "quarterly" && (
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 px-3 sm:px-4 py-3">
                <p className="text-xs uppercase tracking-wide font-semibold text-primary/70 mb-1">Quarterly Payment</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">3 months × {tenant?.netAmountFormatted}</p>
                  <p className="text-base font-bold">{tenant?.quarterlyRentAmountFormatted}</p>
                </div>
              </div>
            )}

            <Separator className="my-1" />

            {/* Security Deposit — one-time, visually separate */}
            <div className="rounded-lg border bg-white px-3 sm:px-4 py-3">
              <p className="text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1.5">
                Security Deposit <span className="normal-case font-normal">(one-time)</span>
              </p>
              <p className="text-base font-bold">{tenant?.securityDepositFormatted}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}