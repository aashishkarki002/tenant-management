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
    <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
      <CardHeader className="p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-muted-foreground" />
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
                            className="text-muted-foreground truncate max-w-[180px]"
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
                            ? "border-red-600 text-red-700 bg-red-50"
                            : task.priority === "High"
                              ? "border-orange-600 text-orange-700 bg-orange-50"
                              : task.priority === "Medium"
                                ? "border-amber-600 text-amber-700 bg-amber-50"
                                : "border-gray-500 text-gray-600 bg-gray-50"
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
                            ? "border-green-600 text-green-700 bg-green-50"
                            : task.status === "IN_PROGRESS"
                              ? "border-blue-600 text-blue-700 bg-blue-50"
                              : task.status === "CANCELLED"
                                ? "border-gray-500 text-gray-600 bg-gray-50"
                                : "border-amber-600 text-amber-700 bg-amber-50"
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
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
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
