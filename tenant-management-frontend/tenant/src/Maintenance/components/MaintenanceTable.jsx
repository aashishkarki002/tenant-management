import { useState } from 'react';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { User, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import SettlementDialog from './SettlementDialog';
import { STATUS_SELECT_COLORS } from '../constants/maintenance.constants';

const PRIORITY_COLORS = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW: 'bg-gray-100 text-gray-600',
};

// Status items available in the dropdown.
// COMPLETED is excluded — only reachable via /settle.
const STATUS_DROPDOWN_ITEMS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_SETTLEMENT', label: 'Pending Settlement' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function MaintenanceTable({
  data = [],
  formatStatus,
  formatDate,
  onUpdate,
  bankAccounts = [],
  staffs = [],
}) {
  const [settlementItem, setSettlementItem] = useState(null);

  const handleStatusChange = async (item, newStatus) => {
    if (newStatus === item.status) return;
    if (newStatus === 'COMPLETED') return; // blocked — use settle flow

    try {
      const res = await api.patch(`/api/maintenance/${item._id}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      onUpdate?.(res.data?.maintenance);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  const handleAssign = async (item, staffId) => {
    const value = staffId === '__unassigned__' ? null : staffId;
    try {
      const res = await api.patch(`/api/maintenance/${item._id}/assign`, {
        assignedTo: value,
      });
      toast.success(value ? 'Staff assigned' : 'Assignment cleared');
      onUpdate?.(res.data?.maintenance);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign staff');
    }
  };

  return (
    <>
      <SettlementDialog
        item={settlementItem}
        bankAccounts={bankAccounts}
        open={!!settlementItem}
        onOpenChange={(open) => !open && setSettlementItem(null)}
        onComplete={onUpdate}
      />

      <div className="rounded-xl border border-muted-fill bg-surface-raised shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted-fill/80">
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide pl-4">Task</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">Unit / Scope</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">Priority</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">Scheduled</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide">Assigned</TableHead>
              <TableHead className="text-xs font-semibold text-text-sub uppercase tracking-wide text-right pr-4">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {data.map((item) => {
              const status = (item.status || 'OPEN').toUpperCase();
              const priority = (item.priority || 'LOW').toUpperCase();
              const scope = item.scope || 'UNIT';

              const assignedIdRaw = item.assignedTo?._id ?? item.assignedTo ?? '';
              const assignedId = assignedIdRaw?.toString?.() ?? assignedIdRaw;
              const assignedName = assignedId
                ? staffs.find((s) => String(s?._id ?? '') === assignedId)?.name ??
                item.assignedTo?.name ??
                'Assigned'
                : null;

              const isOverdue = (() => {
                if (status === 'COMPLETED' || status === 'CANCELLED') return false;
                try {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const d = new Date(item.scheduledDate); d.setHours(0, 0, 0, 0);
                  return d < today;
                } catch { return false; }
              })();

              const isPendingSettlement = status === 'PENDING_SETTLEMENT';
              const isCompleted = status === 'COMPLETED';

              return (
                <TableRow key={item._id} className="group hover:bg-muted-fill/80">

                  {/* Task */}
                  <TableCell className="pl-4">
                    <div>
                      <p className="font-medium text-text-strong text-sm">{item.title}</p>
                      <p className="text-xs text-text-sub">
                        #WO-{String(item._id || '').slice(-4).toUpperCase()}
                      </p>
                    </div>
                  </TableCell>

                  {/* Unit / Scope */}
                  <TableCell>
                    <div>
                      <span className="text-sm text-text-strong">{item.unit?.name || '—'}</span>
                      {item.tenant?.name && (
                        <p className="text-xs text-text-sub">{item.tenant.name}</p>
                      )}
                      {scope !== 'UNIT' && (
                        <span className="mt-0.5 inline-block rounded-full bg-muted-fill text-text-sub px-1.5 py-0.5 text-[10px] font-medium">
                          {scope.replace('_', ' ').toLowerCase()}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  {/* Priority */}
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

                  {/* Status */}
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        className={cn(
                          'rounded-full border-0 px-2.5 py-0.5 text-xs font-medium',
                          STATUS_SELECT_COLORS[status] ?? STATUS_SELECT_COLORS.OPEN,
                        )}
                      >
                        {formatStatus(item.status)}
                      </Badge>
                      {isOverdue && (
                        <Badge className="rounded-full bg-red-100 text-red-700 border-0 px-2 py-0.5 text-[10px]">
                          Overdue
                        </Badge>
                      )}
                      {isPendingSettlement && (
                        <Badge className="rounded-full bg-violet-100 text-violet-700 border-0 px-2 py-0.5 text-[10px]">
                          Awaiting Payment
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  {/* Scheduled */}
                  <TableCell>
                    <span className="text-sm text-text-sub">{formatDate(item.scheduledDate)}</span>
                  </TableCell>

                  {/* Assigned */}
                  <TableCell>
                    <Select
                      value={assignedId || '__unassigned__'}
                      onValueChange={(val) => handleAssign(item, val)}
                    >
                      <SelectTrigger className="h-7 w-36 border-0 bg-transparent text-xs hover:bg-muted-fill rounded-md">
                        <SelectValue>
                          <span className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-text-sub" />
                            <span className="truncate">{assignedName || 'Unassigned'}</span>
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unassigned__">Unassigned</SelectItem>
                        {staffs.map((s) => (
                          <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Status dropdown — hidden for COMPLETED (terminal) */}
                      {!isCompleted && (
                        <Select
                          value={item.status}
                          onValueChange={(val) => handleStatusChange(item, val)}
                        >
                          <SelectTrigger className="h-7 w-auto gap-1 border-muted-fill bg-surface-raised text-xs font-medium px-2.5 rounded-md">
                            <SelectValue>Status</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_DROPDOWN_ITEMS.map(({ value: v, label }) => (
                              <SelectItem key={v} value={v}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      {/* Settle button — only for PENDING_SETTLEMENT */}
                      {isPendingSettlement && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                          onClick={() => setSettlementItem(item)}
                          title="Settle payment"
                        >
                          <Coins className="h-3.5 w-3.5 mr-1" />
                          Settle
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