import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  ChevronUp, ChevronDown, User, Clock, CheckCircle2, UserPlus,
} from 'lucide-react';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CompletionDialog from './CompletionDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function MaintenanceCard({
  maintenanceItem,
  isExpanded,
  toggleExpand,
  getPriorityStyle,
  formatStatus,
  formatDate,
  workOrderId,
  onUpdate,
  bankAccounts = [],
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [staffs, setStaffs] = useState([]);
  const [assigning, setAssigning] = useState(false);
  const [showAssignSelect, setShowAssignSelect] = useState(false);

  useEffect(() => {
    const fetchStaffs = async () => {
      try {
        const res = await api.get('/api/staff/get-staffs');
        const data = res.data?.data;
        setStaffs(Array.isArray(data) ? data : data?.data ?? []);
      } catch {
        setStaffs([]);
      }
    };
    fetchStaffs();
  }, []);

  const handleStatusSelect = async (newStatus) => {
    if (newStatus === maintenanceItem.status) return;
    if (newStatus === 'COMPLETED') {
      setIsDialogOpen(true);
      return;
    }
    try {
      await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      onUpdate?.();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleAssignStaff = async (staffId) => {
    const value = staffId === '__unassigned__' ? null : staffId;
    setAssigning(true);
    try {
      await api.patch(`/api/maintenance/${maintenanceItem._id}/assign`, {
        assignedTo: value,
      });
      toast.success(value ? 'Staff assigned' : 'Assignment cleared');
      onUpdate?.();
    } catch {
      toast.error('Failed to update assignment');
    } finally {
      setAssigning(false);
      setShowAssignSelect(false);
    }
  };

  const assignedStaffId =
    maintenanceItem.assignedTo?._id ?? maintenanceItem.assignedTo ?? '';
  const assignedStaffName = assignedStaffId
    ? staffs.find((s) => s._id === assignedStaffId)?.name ??
    maintenanceItem.assignedTo?.name ??
    'Assigned'
    : null;

  const statusColour =
    {
      OPEN: 'bg-slate-100 text-slate-700',
      IN_PROGRESS: 'bg-blue-100 text-blue-700',
      COMPLETED: 'bg-emerald-100 text-emerald-700',
      CANCELLED: 'bg-gray-100 text-gray-500',
    }[maintenanceItem.status] ?? 'bg-slate-100 text-slate-700';

  const isOverdue = useMemo(() => {
    const s = (maintenanceItem.status || 'OPEN').toUpperCase();
    if (s === 'COMPLETED' || s === 'CANCELLED') return false;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const d = new Date(maintenanceItem.scheduledDate);
      d.setHours(0, 0, 0, 0);
      return d < today;
    } catch {
      return false;
    }
  }, [maintenanceItem.status, maintenanceItem.scheduledDate]);

  const unitName = maintenanceItem.unit?.name || '';
  const tenantName = maintenanceItem.tenant?.name || '';

  const paymentBadgeColour =
    {
      pending: 'bg-muted-fill text-text-strong',
      partially_paid: 'bg-muted-fill text-text-strong',
      paid: 'bg-muted-fill text-text-strong',
      overpaid: 'bg-muted-fill text-text-strong',
    }[maintenanceItem.paymentStatus] ?? 'bg-muted-fill text-text-sub';

  const getInitials = (name) => {
    if (!name || typeof name !== 'string') return '?'
    return name
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return (
    <>
      <CompletionDialog
        item={maintenanceItem}
        bankAccounts={bankAccounts}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onComplete={onUpdate}
      />

      <Card className="rounded-xl border border-muted-fill bg-surface-raised shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          {/* ── Row 1: Title + Status ── */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-text-strong truncate">
                {maintenanceItem.title}
              </h3>
              {(unitName || tenantName) && (
                <p className="mt-0.5 text-sm text-text-sub">
                  {unitName}
                  {unitName && tenantName && ' • '}
                  {tenantName}
                </p>
              )}
            </div>
            <Select
              value={maintenanceItem.status}
              onValueChange={handleStatusSelect}
            >
              <SelectTrigger
                className={cn(
                  'h-7 w-auto gap-1 rounded-full border-0 px-3 text-xs font-medium shrink-0',
                  statusColour,
                )}
              >
                <SelectValue>
                  {formatStatus(maintenanceItem.status)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Row 2: Meta badges ── */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {maintenanceItem.priority && (
              <Badge
                className={cn(
                  getPriorityStyle(maintenanceItem.priority),
                  'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase',
                )}
              >
                {maintenanceItem.priority}
              </Badge>
            )}
            {isOverdue && (
              <Badge className="rounded-full bg-muted-fill text-text-strong border-0 px-2 py-0.5 text-[10px] font-medium">
                Overdue
              </Badge>
            )}
            {maintenanceItem.paymentStatus === 'overpaid' && (
              <Badge className="rounded-full bg-muted-fill text-text-strong border-0 px-2 py-0.5 text-[10px] font-medium">
                Overpaid
              </Badge>
            )}
            <span className="text-xs text-text-sub">{workOrderId}</span>
            {maintenanceItem.scheduledDate && (
              <span className="flex items-center gap-1 text-xs text-text-sub">
                <Clock className="h-3 w-3" />
                {formatDate(maintenanceItem.scheduledDate)}
              </span>
            )}
          </div>

          {/* ── Row 3: Assignment + Quick Actions ── */}
          <div className="mt-3 flex items-center justify-between border-t border-muted-fill pt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <Avatar className="w-4 h-4 bg-accent/20 text-text-strong font-semibold">
                  <AvatarImage src={maintenanceItem.assignedTo?.profilePicture} alt={maintenanceItem.assignedTo?.name} width={16} height={16} />
                  <AvatarFallback className="text-text-strong">
                    {getInitials(maintenanceItem.assignedTo?.name)}
                  </AvatarFallback>
                </Avatar>
                <span>{assignedStaffName || 'Unassigned'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!showAssignSelect && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-text-sub hover:text-text-body"
                  onClick={() => setShowAssignSelect(true)}
                >
                  <UserPlus className="mr-1 h-3.5 w-3.5" />
                  Assign
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-text-sub hover:text-text-body"
                onClick={toggleExpand}
              >
                {isExpanded ? (
                  <ChevronUp className="mr-1 h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                )}
                {isExpanded ? 'Less' : 'Details'}
              </Button>
              {maintenanceItem.status !== 'COMPLETED' &&
                maintenanceItem.status !== 'CANCELLED' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                    onClick={() => handleStatusSelect('COMPLETED')}
                  >
                    <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                    Complete
                  </Button>
                )}
            </div>
          </div>

          {/* ── Inline Assign Select ── */}
          {showAssignSelect && (
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={assignedStaffId || '__unassigned__'}
                onValueChange={handleAssignStaff}
                disabled={assigning}
              >
                <SelectTrigger className="h-8 flex-1 bg-surface-raised border-muted-fill text-sm">
                  <SelectValue placeholder="Select staff">
                    {assignedStaffId
                      ? staffs.find((s) => s._id === assignedStaffId)?.name ??
                      'Assigned'
                      : 'Unassigned'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {staffs.map((staff) => (
                    <SelectItem key={staff._id} value={staff._id}>
                      {staff.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setShowAssignSelect(false)}
              >
                Cancel
              </Button>
            </div>
          )}

          {/* ── Expanded Details ── */}
          {isExpanded && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Info label="Type" value={maintenanceItem.type} />
                <Info
                  label="Estimated"
                  value={`₹${maintenanceItem.amount || 0}`}
                />
                <Info
                  label="Paid"
                  value={`₹${maintenanceItem.paidAmount || 0}`}
                  highlight={
                    maintenanceItem.paymentStatus === 'overpaid'
                      ? 'amber'
                      : null
                  }
                />
                <div>
                  <p className="text-xs text-text-sub uppercase tracking-wide">
                    Payment
                  </p>
                  <span
                    className={cn(
                      'mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                      paymentBadgeColour,
                    )}
                  >
                    {maintenanceItem.paymentStatus?.replace(/_/g, ' ') ?? 'N/A'}
                  </span>
                </div>
              </div>

              {maintenanceItem.description && (
                <div>
                  <p className="text-xs font-medium text-text-sub uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-text-strong leading-relaxed">
                    {maintenanceItem.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value, highlight }) {
  return (
    <div>
      <p className="text-xs text-text-sub uppercase tracking-wide">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-sm font-medium capitalize',
          highlight === 'amber' ? 'text-text-strong font-semibold' : 'text-text-body',
        )}
      >
        {value || 'N/A'}
      </p>
    </div>
  );
}
