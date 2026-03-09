import { useMemo } from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
} from "@/components/ui/table";
import { useElectricityData } from "../electricity/hooks/useElectricityData";
import { ElectricitySummaryCards } from "../electricity/components/ElectricitySummaryCards";
import { ElectricityTableRow } from "../electricity/components/ElectricityTableRow";

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
      <div className="text-sm text-muted-foreground py-4">
        No tenant selected.
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-text-sub">
        Loading electricity data…
      </div>
    );
  }
  if (allReadings.length === 0) {
    return (
      <div className="text-sm text-text-sub py-4">
        No electricity readings for this tenant.
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <Card className="rounded-lg shadow bg-background">
        <CardContent className="p-5 bg-surface">
          <div className="overflow-x-auto">
            <Table className="bg-surface">
              <TableHeader>
                <TableRow className="border-b border-border">
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Building</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Block</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Prev (kWh)</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Curr (kWh)</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Consumption</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Bill</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Action</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Receipt</TableHead>
                  <TableHead className="text-xs font-semibold text-text-sub uppercase">Reading Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="bg-surface">
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
