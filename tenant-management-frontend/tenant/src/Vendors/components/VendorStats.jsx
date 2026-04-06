import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Users } from "lucide-react";

export default function VendorStats({ stats }) {
  const statCards = [
    {
      label: "Total Vendor Revenue",
      value: `रू ${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: TrendingUp,
      color: "var(--color-success)",
      bgColor: "var(--color-success-bg)",
      borderColor: "var(--color-success-border)",
    },
    {
      label: "Total Vendor Expenses",
      value: `रू ${(stats?.totalExpenses || 0).toLocaleString()}`,
      icon: TrendingDown,
      color: "var(--color-danger)",
      bgColor: "var(--color-danger-bg)",
      borderColor: "var(--color-danger-border)",
    },
    {
      label: "Outstanding Balance",
      value: `रू ${(stats?.outstandingBalance || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "var(--color-info)",
      bgColor: "var(--color-info-bg)",
      borderColor: "var(--color-info-border)",
    },
    {
      label: "Active Stall Vendors",
      value: stats?.activeStallVendors || 0,
      icon: Users,
      color: "var(--color-accent)",
      bgColor: "var(--color-accent-light)",
      borderColor: "var(--color-accent-mid)",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  {stat.label}
                </p>
                <p
                  className="mt-2 text-2xl font-bold"
                  style={{ color: "var(--color-text-strong)" }}
                >
                  {stat.value}
                </p>
              </div>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg"
                style={{
                  backgroundColor: stat.bgColor,
                  border: `1px solid ${stat.borderColor}`,
                }}
              >
                <stat.icon className="h-5 w-5" style={{ color: stat.color }} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
