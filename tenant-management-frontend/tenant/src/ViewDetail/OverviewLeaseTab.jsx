import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Mail, Phone, MapPin, FileText, Key } from "lucide-react";
import { toNepaliDate } from "../../utils/formatNepali";
import { Separator } from "@/components/ui/separator";

export function OverviewLeaseTab({ tenant }) {
  return (
    <div className="flex flex-col lg:flex-row gap-4">
      <div className="flex-1 lg:flex-2">
        <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
          <CardHeader className="space-y-4 p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">
              Personal Info
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Card className="w-full">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
                    <CardTitle className="text-sm sm:text-base">
                      Email Address
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <span className="text-xs sm:text-sm text-gray-500 font-bold break-all">
                    {tenant?.email}
                  </span>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
                    <CardTitle className="text-sm sm:text-base">
                      Contact Number
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <span className="text-xs sm:text-sm text-gray-500 font-bold">
                    {tenant?.phone}
                  </span>
                </CardContent>
              </Card>
              <Card className="w-full">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                    <CardTitle className="text-sm sm:text-base">
                      Permanent Address
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <span className="text-xs sm:text-sm text-gray-500 font-bold break-words">
                    {tenant?.address}
                  </span>
                </CardContent>
              </Card>
            </div>
            <div className="mt-4">
              <Card className="w-full">
                <CardHeader className="p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                    <CardTitle className="text-sm sm:text-base">
                      Lease Terms
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="rounded-xl border bg-background p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-4 rounded-lg border p-3 sm:p-4">
                      <div className="flex-1">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Lease Start Date
                        </p>
                        <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                          <span className="text-muted-foreground">AD</span>
                          <span className="font-medium break-words text-right">
                            {tenant?.leaseStartDate
                              ? new Date(tenant.leaseStartDate).toDateString()
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">BS</span>
                          <span className="font-medium break-words text-right">
                            {tenant?.leaseStartDate
                              ? toNepaliDate(tenant.leaseStartDate)
                              : "—"}
                          </span>
                        </div>
                      </div>
                      <Separator orientation="vertical" className="hidden sm:block" />
                      <Separator className="sm:hidden" />
                      <div className="flex-1">
                        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                          Lease End Date
                        </p>
                        <div className="flex items-center justify-between text-xs sm:text-sm mb-1">
                          <span className="text-muted-foreground">AD</span>
                          <span className="font-medium break-words text-right">
                            {tenant?.leaseEndDate
                              ? new Date(tenant.leaseEndDate).toDateString()
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="text-muted-foreground">BS</span>
                          <span className="font-medium break-words text-right">
                            {tenant?.leaseEndDate
                              ? toNepaliDate(tenant.leaseEndDate)
                              : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border px-3 sm:px-4 py-3">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md bg-muted">
                          <Key className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                        </div>
                        <span className="text-xs sm:text-sm">
                          Key Handover Status
                        </span>
                      </div>
                      <span className="text-xs sm:text-sm font-medium">
                        {tenant?.keyHandoverDate
                          ? new Date(tenant.keyHandoverDate).toDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex-1 lg:flex-1">
        <Card className="rounded-xl border border-border bg-gray-50 shadow-sm">
          <CardHeader className="space-y-2 p-4 sm:p-6">
            <CardTitle className="text-lg sm:text-xl">
              Financial Snapshot
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Overview of the tenant&apos;s financials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-xs sm:text-sm font-medium">Lease Area</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {tenant?.leasedSquareFeet} <span>sqft</span>
                </p>
              </div>
              <div className="flex flex-col items-end">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Rate Per Sqft
                </p>
                <p className="text-xs sm:text-sm font-medium">
                  {tenant?.pricePerSqftFormatted ??
                    (tenant?.pricePerSqft != null
                      ? `₹${tenant.pricePerSqft.toLocaleString()}`
                      : "—")}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium">Security Deposit</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {tenant?.securityDepositFormatted ??
                  (tenant?.securityDeposit != null
                    ? `₹${tenant.securityDeposit.toLocaleString()}`
                    : "—")}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-medium">
                TDS ({tenant?.tdsPercentage ?? 10}%)
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {tenant?.tdsFormatted ??
                  (tenant?.tds != null
                    ? `₹${tenant.tds.toLocaleString()}`
                    : "—")}
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-semibold">
                Net Amount including CAM
              </p>
              <p className="text-xs sm:text-sm font-semibold">
                {tenant?.netAmountFormatted ??
                  (tenant?.netAmount != null
                    ? `₹${tenant.netAmount.toLocaleString()}`
                    : "—")}
              </p>
            </div>
            {tenant?.rentPaymentFrequency === "quarterly" && (
              <div className="flex items-center justify-between">
                <p className="text-xs sm:text-sm font-semibold">
                  Quarterly Rent Amount
                </p>
                <p className="text-xs sm:text-sm font-semibold">
                  {tenant?.quarterlyRentAmountFormatted ??
                    (tenant?.quarterlyRentAmount != null
                      ? `₹${tenant.quarterlyRentAmount.toLocaleString()}`
                      : "—")}
                </p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs sm:text-sm font-semibold">
                Gross Amount excluding CAM
              </p>
              <p className="text-xs sm:text-sm font-semibold">
                {tenant?.grossAmountFormatted ??
                  (tenant?.grossAmount != null
                    ? `₹${tenant.grossAmount.toLocaleString()}`
                    : "—")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
