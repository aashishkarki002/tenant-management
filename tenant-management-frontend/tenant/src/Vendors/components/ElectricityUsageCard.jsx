import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

export default function ElectricityUsageCard({ electricityData }) {
  if (!electricityData || !electricityData.submeter_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" style={{ color: "var(--color-warning)" }} />
            Electricity Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8">
            <p
              className="text-sm"
              style={{ color: "var(--color-text-sub)" }}
            >
              No submeter connected
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" style={{ color: "var(--color-warning)" }} />
          Electricity Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-text-sub)" }}
            >
              Submeter ID
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "var(--color-text-strong)" }}
            >
              {electricityData.submeter_id}
            </p>
          </div>

          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-text-sub)" }}
            >
              Units This Month
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "var(--color-text-strong)" }}
            >
              {electricityData.units_consumed || 0} kWh
            </p>
          </div>

          <div
            className="rounded-lg border p-4"
            style={{
              backgroundColor: "var(--color-warning-bg)",
              borderColor: "var(--color-warning-border)",
            }}
          >
            <p
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-warning)" }}
            >
              Electricity Cost
            </p>
            <p
              className="mt-1 text-lg font-semibold"
              style={{ color: "var(--color-warning)" }}
            >
              रू {(electricityData.total_cost || 0).toLocaleString()}
            </p>
          </div>
        </div>

        {electricityData.rate && (
          <div
            className="rounded-lg border p-3"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <p
              className="text-xs"
              style={{ color: "var(--color-text-sub)" }}
            >
              Rate: रू {electricityData.rate} per kWh
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
