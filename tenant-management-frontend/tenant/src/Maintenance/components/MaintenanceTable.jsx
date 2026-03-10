import { useState, useEffect } from 'react';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import CompletionDialog from './CompletionDialog';

const STATUS_COLORS = {
  OPEN: 'bg-muted-fill text-text-strong',
  IN_PROGRESS: 'bg-muted-fill text-text-strong',
  COMPLETED: 'bg-muted-fill text-text-strong',
  CANCELLED: 'bg-muted-fill text-text-sub',
};

const PRIORITY_COLORS = {
  URGENT: 'bg-muted-fill text-text-strong',
  HIGH: 'bg-muted-fill text-text-strong',
  MEDIUM: 'bg-muted-fill text-text-strong',
  LOW: 'bg-muted-fill text-text-sub',
};

export default function MaintenanceTable({
  data = [],
  formatStatus,
  formatDate,
  onUpdate,
  bankAccounts = [],
}) {
  const [completionItem, setCompletionItem] = useState(null);
  const [staffs, setStaffs] = useState([]);

  useEffect(() => {
    const fetchStaffs = async () => {
      try {
        const res = await api.get('/api/staff/get-staffs');
        const d = res.data?.data;
        setStaffs(Array.isArray(d) ? d : d?.data ?? []);
      } catch {
        setStaffs([]);
      }
    };
    fetchStaffs();
  }, []);

  const handleStatusChange = async (item, newStatus) => {
    if (newStatus === item.status) return;
    if (newStatus === 'COMPLETED') {
      setCompletionItem(item);
      return;
    }
    try {
      await api.patch(`/api/maintenance/${item._id}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      onUpdate?.();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAssign = async (item, staffId) => {
    const value = staffId === '__unassigned__' ? null : staffId;
    try {
      await api.patch(`/api/maintenance/${item._id}/assign`, {
        assignedTo: value,
      });
      toast.success(value ? 'Staff assigned' : 'Assignment cleared');
      onUpdate?.();
    } catch {
      toast.error('Failed to update assignment');
    }
  };

  return (
    <>
      <CompletionDialog
        item={completionItem}
        bankAccounts={bankAccounts}
        open={!!completionItem}
        onOpenChange={(open) => !open && setCompletionItem(null)}
        onComplete={onUpdate}
      />

      <div className="rounded-xl border border-muted-fill bg-surface-raised shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted-fill/80">
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide pl-4">
                Task
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">
                Unit
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">
                Priority
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">
                Scheduled
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">
                Assigned
              </TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide text-right pr-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((item) => {
              const status = (item.status || 'OPEN').toUpperCase();
              const priority = (item.priority || 'LOW').toUpperCase();
              const assignedId =
                item.assignedTo?._id ?? item.assignedTo ?? '';
              const assignedName = assignedId
                ? staffs.find((s) => s._id === assignedId)?.name ??
                item.assignedTo?.name ??
                'Assigned'
                : null;
              const isOverdue = (() => {
                if (status === 'COMPLETED' || status === 'CANCELLED')
                  return false;
                try {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const d = new Date(item.scheduledDate);
                  d.setHours(0, 0, 0, 0);
                  return d < today;
                } catch {
                  return false;
                }
              })();

              return (
                <TableRow key={item._id} className="group hover:bg-muted-fill/80">
                  <TableCell className="pl-4">
                    <div>
                      <p className="font-medium text-text-strong text-sm">
                        {item.title}
                      </p>
                      <p className="text-xs text-text-sub">
                        #WO-
                        {String(item._id || '')
                          .slice(-4)
                          .toUpperCase()}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div>
                      <span className="text-sm text-text-strong">
                        {item.unit?.name || '—'}
                      </span>
                      {item.tenant?.name && (
                        <p className="text-xs text-text-sub">
                          {item.tenant.name}
                        </p>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      className={cn(
                        'rounded-full border-0 px-2 py-0.5 text-[10px] font-medium uppercase',
                        PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW,
                      )}
                    >
                      {item.priority || 'Low'}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        className={cn(
                          'rounded-full border-0 px-2.5 py-0.5 text-xs font-medium',
                          STATUS_COLORS[status] || STATUS_COLORS.OPEN,
                        )}
                      >
                        {formatStatus(item.status)}
                      </Badge>
                      {isOverdue && (
                        <Badge className="rounded-full bg-muted-fill text-text-strong border-0 px-2 py-0.5 text-[10px] font-medium">
                          Overdue
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="text-sm text-text-sub">
                      {formatDate(item.scheduledDate)}
                    </span>
                  </TableCell>

                  <TableCell>
                    <Select
                      value={assignedId || '__unassigned__'}
                      onValueChange={(val) => handleAssign(item, val)}
                    >
                      <SelectTrigger className="h-7 w-36 border-0 bg-transparent text-xs hover:bg-muted-fill rounded-md">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-text-sub" />
                            <span className="truncate">
                              {assignedName || 'Unassigned'}
                            </span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">
                          Unassigned
                        </SelectItem>
                        {staffs.map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      <Select
                        value={item.status}
                        onValueChange={(val) =>
                          handleStatusChange(item, val)
                        }
                      >
                        <SelectTrigger className="h-7 w-auto gap-1 border-muted-fill bg-surface-raised text-xs font-medium px-2.5 rounded-md">
                          <SelectValue>Status</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="OPEN">Open</SelectItem>
                          <SelectItem value="IN_PROGRESS">
                            In Progress
                          </SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                          <SelectItem value="CANCELLED">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                      {status !== 'COMPLETED' && status !== 'CANCELLED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-text-strong hover:text-text-body hover:bg-muted-fill"
                          onClick={() =>
                            handleStatusChange(item, 'COMPLETED')
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
