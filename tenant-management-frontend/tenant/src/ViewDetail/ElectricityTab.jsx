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
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Loading electricity data…
      </div>
    );
  }
  if (allReadings.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No electricity readings for this tenant.
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <Card className="rounded-lg shadow bg-white">
        <CardContent className="p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Name</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Type</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Building</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Block</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Prev (kWh)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Curr (kWh)</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Consumption</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Bill</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Action</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Receipt</TableHead>
                  <TableHead className="text-xs font-semibold text-gray-600 uppercase">Reading Date</TableHead>
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
