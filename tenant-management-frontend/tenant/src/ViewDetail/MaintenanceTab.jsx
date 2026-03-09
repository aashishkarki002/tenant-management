import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Wrench } from "lucide-react";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function MaintenanceTab({ tenantMaintenance = [] }) {
  return (
    <Card className="border border-border shadow-sm rounded-xl bg-background">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-text-sub" />
          <CardTitle className="text-lg sm:text-xl">Maintenance</CardTitle>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Maintenance tasks and requests for this tenant
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {tenantMaintenance?.length > 0 ? (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs font-semibold">Title</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  <TableHead className="text-xs font-semibold">Priority</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Scheduled</TableHead>
                  <TableHead className="text-xs font-semibold">Amount</TableHead>
                  <TableHead className="text-xs font-semibold">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantMaintenance.map((task) => (
                  <TableRow key={task._id} className="text-xs sm:text-sm">
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.title}</p>
                        {task.description && (
                          <p
                            className="text-text-sub truncate max-w-[180px]"
                            title={task.description}
                          >
                            {task.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{task.type ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          task.priority === "Urgent"
                            ? "border-danger-border text-danger bg-danger-bg"
                            : task.priority === "High"
                              ? "border-warning-border text-warning bg-warning-bg"
                              : task.priority === "Medium"
                                ? "border-info-border text-info bg-info-bg"
                                : "border-border text-text-sub bg-surface"
                        }
                      >
                        {task.priority ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          task.status === "COMPLETED"
                            ? "border-success-border text-success bg-success-bg"
                            : task.status === "IN_PROGRESS"
                              ? "border-accent-border text-accent bg-accent-bg"
                              : task.status === "CANCELLED"
                                ? "border-border text-text-sub bg-surface"
                                : "border-warning-border text-warning bg-warning-bg"
                        }
                      >
                        {task.status?.replace("_", " ") ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {task.scheduledDate
                        ? new Date(task.scheduledDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {task.amount != null
                        ? `₹${Number(task.amount).toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {task.paymentStatus?.replace("_", " ") ?? "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-text-sub">
            <Wrench className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-sm font-medium">No maintenance records</p>
            <p className="text-xs mt-1">
              Tasks for this tenant or their unit/property will appear here
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
