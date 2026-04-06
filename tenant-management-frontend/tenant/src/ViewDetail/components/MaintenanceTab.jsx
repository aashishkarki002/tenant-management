import {
  Card,
  CardHeader,
  CardTitle,
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

const PRIORITY_STYLES = {
  Urgent: "bg-red-50 text-red-700 border-red-200",
  High: "bg-amber-50 text-amber-700 border-amber-200",
  Medium: "bg-blue-50 text-blue-700 border-blue-200",
  Low: "bg-gray-50 text-gray-600 border-gray-200",
};

const STATUS_STYLES = {
  COMPLETED: "bg-green-50 text-green-700 border-green-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 border-blue-200",
  CANCELLED: "bg-gray-50 text-gray-500 border-gray-200",
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
};

export function MaintenanceTab({ tenantMaintenance = [] }) {
  return (
    <Card className="border border-border shadow-sm rounded-xl bg-background">
      <CardHeader className="p-4 sm:p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
              <Wrench className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg leading-tight">Maintenance</CardTitle>
              {tenantMaintenance.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {tenantMaintenance.length} record{tenantMaintenance.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          {tenantMaintenance.length > 0 && (
            <div className="flex items-center gap-2">
              {["Urgent", "High"].map((priority) => {
                const count = tenantMaintenance.filter((t) => t.priority === priority).length;
                if (!count) return null;
                return (
                  <Badge
                    key={priority}
                    className={`text-xs ${PRIORITY_STYLES[priority]}`}
                  >
                    {count} {priority}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {tenantMaintenance.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-3">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">No maintenance records</p>
            <p className="text-xs text-muted-foreground mt-1">
              Tasks for this tenant will appear here
            </p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="block sm:hidden px-4 pb-4 space-y-2">
              {tenantMaintenance.map((task) => (
                <div
                  key={task._id}
                  className="rounded-xl border border-border bg-background p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <PriorityBadge priority={task.priority} />
                  </div>
                  <div className="flex items-center justify-between">
                    <StatusBadge status={task.status} />
                    <span className="text-xs text-muted-foreground">
                      {task.scheduledDate
                        ? new Date(task.scheduledDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </span>
                  </div>
                  {task.amount != null && (
                    <div className="flex items-center justify-between border-t border-border pt-2">
                      <span className="text-xs text-muted-foreground">Amount</span>
                      <span className="text-xs font-semibold tabular-nums">
                        रू {Number(task.amount).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-y border-border bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Task</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Type</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Priority</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Scheduled</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Amount</TableHead>
                    <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-3">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantMaintenance.map((task, idx) => (
                    <TableRow
                      key={task._id}
                      className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${
                        idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                      }`}
                    >
                      <TableCell className="py-3">
                        <p className="text-sm font-medium">{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px] mt-0.5">
                            {task.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {task.type ?? "—"}
                      </TableCell>
                      <TableCell className="py-3">
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="py-3">
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {task.scheduledDate
                          ? new Date(task.scheduledDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-sm font-medium tabular-nums">
                        {task.amount != null
                          ? `रू ${Number(task.amount).toLocaleString()}`
                          : "—"}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground capitalize">
                        {task.paymentStatus?.replace("_", " ") ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityBadge({ priority }) {
  const style = PRIORITY_STYLES[priority] ?? "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <Badge className={`text-xs font-semibold border ${style} hover:bg-opacity-80`}>
      {priority ?? "—"}
    </Badge>
  );
}

function StatusBadge({ status }) {
  const key = status?.toUpperCase();
  const style = STATUS_STYLES[key] ?? "bg-gray-50 text-gray-500 border-gray-200";
  return (
    <Badge className={`text-xs font-semibold border ${style} hover:bg-opacity-80`}>
      {status?.replace("_", " ") ?? "—"}
    </Badge>
  );
}
