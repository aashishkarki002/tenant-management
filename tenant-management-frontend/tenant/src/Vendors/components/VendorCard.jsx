import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  Store,
  Calendar,
  Zap,
  MapPin,
  Phone,
  FileText,
} from "lucide-react";

export default function VendorCard({ vendor }) {
  const isStallVendor = vendor.vendor_type === "stall";

  const getVendorTypeBadge = (type) => {
    if (type === "service") {
      return (
        <Badge
          className="text-xs"
          style={{
            backgroundColor: "var(--color-info-bg)",
            color: "var(--color-info)",
            border: "1px solid var(--color-info-border)",
          }}
        >
          Service Vendor
        </Badge>
      );
    }
    return (
      <Badge
        className="text-xs"
        style={{
          backgroundColor: "var(--color-success-bg)",
          color: "var(--color-success)",
          border: "1px solid var(--color-success-border)",
        }}
      >
        Stall Vendor
      </Badge>
    );
  };

  const formatBalance = (balance, vendorType) => {
    if (!balance || balance === 0) {
      return { text: "रू 0", color: "var(--color-text-sub)" };
    }

    if (vendorType === "stall") {
      return {
        text: `रू ${Math.abs(balance).toLocaleString()}`,
        color: balance > 0 ? "var(--color-success)" : "var(--color-danger)",
      };
    } else {
      return {
        text: `रू ${Math.abs(balance).toLocaleString()}`,
        color: balance > 0 ? "var(--color-danger)" : "var(--color-success)",
      };
    }
  };

  const balanceInfo = formatBalance(vendor.balance, vendor.vendor_type);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-2xl">
              {vendor.name}
            </CardTitle>
            <div className="mt-2">{getVendorTypeBadge(vendor.vendor_type)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div
            className="flex items-start gap-3 rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <DollarSign
              className="mt-1 h-5 w-5"
              style={{ color: "var(--color-text-sub)" }}
            />
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--color-text-sub)" }}
              >
                Current Balance
              </p>
              <p
                className="mt-1 text-xl font-bold"
                style={{ color: balanceInfo.color }}
              >
                {balanceInfo.text}
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-3 rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <Store
              className="mt-1 h-5 w-5"
              style={{ color: "var(--color-text-sub)" }}
            />
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--color-text-sub)" }}
              >
                Vendor Type
              </p>
              <p
                className="mt-1 text-lg font-semibold"
                style={{ color: "var(--color-text-strong)" }}
              >
                {isStallVendor ? "Stall Vendor" : "Service Vendor"}
              </p>
            </div>
          </div>

          <div
            className="flex items-start gap-3 rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <Calendar
              className="mt-1 h-5 w-5"
              style={{ color: "var(--color-text-sub)" }}
            />
            <div>
              <p
                className="text-xs font-medium uppercase tracking-wide"
                style={{ color: "var(--color-text-sub)" }}
              >
                Last Transaction
              </p>
              <p
                className="mt-1 text-lg font-semibold"
                style={{ color: "var(--color-text-strong)" }}
              >
                {vendor.last_transaction_date
                  ? new Date(vendor.last_transaction_date).toLocaleDateString(
                      "en-GB"
                    )
                  : "N/A"}
              </p>
            </div>
          </div>

          {isStallVendor && vendor.submeter_id && (
            <div
              className="flex items-start gap-3 rounded-lg border p-4"
              style={{
                backgroundColor: "var(--color-warning-bg)",
                borderColor: "var(--color-warning-border)",
              }}
            >
              <Zap
                className="mt-1 h-5 w-5"
                style={{ color: "var(--color-warning)" }}
              />
              <div>
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--color-warning)" }}
                >
                  Linked Submeter
                </p>
                <p
                  className="mt-1 text-lg font-semibold"
                  style={{ color: "var(--color-warning)" }}
                >
                  {vendor.submeter_id}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {vendor.contact && (
            <div className="flex items-center gap-2">
              <Phone
                className="h-4 w-4"
                style={{ color: "var(--color-text-sub)" }}
              />
              <span style={{ color: "var(--color-text-body)" }}>
                {vendor.contact}
              </span>
            </div>
          )}

          {isStallVendor && vendor.stall_location && (
            <div className="flex items-center gap-2">
              <MapPin
                className="h-4 w-4"
                style={{ color: "var(--color-text-sub)" }}
              />
              <span style={{ color: "var(--color-text-body)" }}>
                {vendor.stall_location}
              </span>
            </div>
          )}

          {isStallVendor && vendor.rent_amount && (
            <div className="flex items-center gap-2">
              <DollarSign
                className="h-4 w-4"
                style={{ color: "var(--color-text-sub)" }}
              />
              <span style={{ color: "var(--color-text-body)" }}>
                Monthly Rent: रू {vendor.rent_amount.toLocaleString()}
              </span>
            </div>
          )}

          {vendor.notes && (
            <div className="flex items-start gap-2">
              <FileText
                className="mt-1 h-4 w-4"
                style={{ color: "var(--color-text-sub)" }}
              />
              <div className="flex-1">
                <p
                  className="text-xs font-medium"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  Notes
                </p>
                <p
                  className="mt-1 text-sm"
                  style={{ color: "var(--color-text-body)" }}
                >
                  {vendor.notes}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
