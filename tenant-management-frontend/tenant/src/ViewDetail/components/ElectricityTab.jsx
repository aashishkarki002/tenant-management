import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from "@/components/ui/table";
import { Zap } from "lucide-react";
import { useElectricityData } from "../../electricity/hooks/useElectricityData";
import { ElectricitySummaryCards } from "../../electricity/components/ElectricitySummaryCards";
import { ElectricityTableRow } from "../../electricity/components/ElectricityTableRow";

const TABLE_HEADERS = [
  "Name", "Type", "Building", "Block",
  "Prev (kWh)", "Curr (kWh)", "Usage",
  "Bill", "Status", "Action", "Receipt", "Date",
];

export function ElectricityTab({ tenantId }) {
  const { grouped, summary, loading, refetch } = useElectricityData(
    tenantId ? { tenantId } : {}
  );

  const allReadings = useMemo(() => {
    const r = [];
    for (const key of ["unit", "common_area", "parking", "sub_meter"]) {
      r.push(...(grouped[key]?.readings ?? []));
    }
    return r;
  }, [grouped]);

  if (!tenantId) {
    return (
      <div className="text-sm text-muted-foreground py-4">No tenant selected.</div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-2">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading electricity data…</p>
      </div>
    );
  }

  if (allReadings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
          <Zap className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No electricity readings</p>
        <p className="text-xs text-muted-foreground mt-1">
          Readings for this tenant will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ElectricitySummaryCards summary={summary} />

      <Card className="border border-border shadow-sm rounded-xl bg-background">
        <CardHeader className="p-4 sm:p-5 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg leading-tight">Electricity Readings</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allReadings.length} reading{allReadings.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-5 sm:pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-y border-border bg-muted/30 hover:bg-muted/30">
                  {TABLE_HEADERS.map((h) => (
                    <TableHead
                      key={h}
                      className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3 whitespace-nowrap"
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allReadings.map((record, index) => (
                  <ElectricityTableRow
                    key={record._id ?? index}
                    record={record}
                    index={index}
                    onPaymentRecorded={refetch}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
