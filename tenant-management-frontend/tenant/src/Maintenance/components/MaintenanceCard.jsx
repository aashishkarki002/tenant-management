import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  ChevronUp, ChevronDown, Clock, CheckCircle2, UserPlus, Coins,
} from 'lucide-react';
import api from '../../../plugins/axios';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import SettlementDialog from './SettlementDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  STATUS_SELECT_COLORS,
  SOURCE_TYPE_LABELS,
} from '../constants/maintenance.constants';

// ── Helper: initials from name ────────────────────────────────────────────────
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

// ── Allowed status transitions shown in the dropdown ─────────────────────────
// COMPLETED is intentionally absent — it's only reachable via /settle.
const STATUS_DROPDOWN_ITEMS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'PENDING_SETTLEMENT', label: 'Pending Settlement' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

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
  staffs = [],
}) {
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [showAssignSelect, setShowAssignSelect] = useState(false);

  // ── Status change handler ─────────────────────────────────────────────────
  const handleStatusSelect = async (newStatus) => {
    if (newStatus === maintenanceItem.status) return;

    // COMPLETED can only be reached via the settlement dialog
    if (newStatus === 'COMPLETED') return;

    // Opening settlement dialog — only valid from PENDING_SETTLEMENT
    if (newStatus === 'PENDING_SETTLEMENT' && maintenanceItem.status === 'PENDING_SETTLEMENT') {
      setIsSettlementOpen(true);
      return;
    }

    try {
      const res = await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
        status: newStatus,
      });
      toast.success('Status updated');
      onUpdate?.(res.data?.maintenance);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    }
  };

  // ── Staff assignment ──────────────────────────────────────────────────────
  const handleAssignStaff = async (staffId) => {
    const value = staffId === '__unassigned__' ? null : staffId;
    setAssigning(true);
    try {
      const res = await api.patch(`/api/maintenance/${maintenanceItem._id}/assign`, {
        assignedTo: value,
      });
      toast.success(value ? 'Staff assigned' : 'Assignment cleared');
      onUpdate?.(res.data?.maintenance);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign staff');
    } finally {
      setAssigning(false);
      setShowAssignSelect(false);
    }
  };

  const assignedStaffIdRaw = maintenanceItem.assignedTo?._id ?? maintenanceItem.assignedTo ?? '';
  const assignedStaffId = assignedStaffIdRaw?.toString?.() ?? assignedStaffIdRaw;
  const assignedStaffName = assignedStaffId
    ? staffs.find((s) => String(s?._id ?? '') === assignedStaffId)?.name ??
    maintenanceItem.assignedTo?.name ??
    'Assigned'
    : null;

  const status = (maintenanceItem.status || 'OPEN').toUpperCase();
  const statusColor = STATUS_SELECT_COLORS[status] ?? STATUS_SELECT_COLORS.OPEN;

  const isPendingSettlement = status === 'PENDING_SETTLEMENT';
  const isTerminal = status === 'COMPLETED' || status === 'CANCELLED';

  const isOverdue = useMemo(() => {
    if (status === 'COMPLETED' || status === 'CANCELLED') return false;
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const d = new Date(maintenanceItem.scheduledDate); d.setHours(0, 0, 0, 0);
      return d < today;
    } catch { return false; }
  }, [status, maintenanceItem.scheduledDate]);

  const unitName = maintenanceItem.unit?.name || '';
  const tenantName = maintenanceItem.tenant?.name || '';

  const paymentBadgeColour = {
    pending: 'bg-muted-fill text-text-sub',
    partially_paid: 'bg-amber-100 text-amber-700',
    paid: 'bg-emerald-100 text-emerald-700',
    overpaid: 'bg-orange-100 text-orange-700',
  }[maintenanceItem.paymentStatus] ?? 'bg-muted-fill text-text-sub';

  const sourceConfig = SOURCE_TYPE_LABELS[(maintenanceItem.sourceType || 'MANUAL').toUpperCase()];

  return (
    <>
      <SettlementDialog
        item={maintenanceItem}
        bankAccounts={bankAccounts}
        open={isSettlementOpen}
        onOpenChange={setIsSettlementOpen}
        onComplete={onUpdate}
      />

      <Card className="rounded-xl border border-muted-fill bg-surface-raised shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-5">

          {/* ── Row 1: Title + Status ─────────────────────────────────── */}
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

            {/* Status selector — COMPLETED is read-only badge, others are editable */}
            {status === 'COMPLETED' ? (
              <span className={cn(
                'shrink-0 rounded-full px-3 py-1 text-xs font-medium',
                statusColor,
              )}>
                {formatStatus(maintenanceItem.status)}
              </span>
            ) : (
              <Select value={maintenanceItem.status} onValueChange={handleStatusSelect}>
                <SelectTrigger
                  className={cn(
                    'h-7 w-auto gap-1 rounded-full border-0 px-3 text-xs font-medium shrink-0',
                    statusColor,
                  )}
                >
                  <SelectValue>{formatStatus(maintenanceItem.status)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_DROPDOWN_ITEMS.map(({ value: v, label }) => (
                    <SelectItem key={v} value={v}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── Row 2: Meta badges ───────────────────────────────────── */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {maintenanceItem.priority && (
              <Badge
                className={cn(
                  getPriorityStyle(maintenanceItem.priority),
                  'rounded-full px-2 py-0.5 text-[10px] font-medium uppercase border-0',
                )}
              >
                {maintenanceItem.priority}
              </Badge>
            )}
            {isOverdue && (
              <Badge className="rounded-full bg-red-100 text-red-700 border-0 px-2 py-0.5 text-[10px] font-medium">
                Overdue
              </Badge>
            )}
            {isPendingSettlement && (
              <Badge className="rounded-full bg-violet-100 text-violet-700 border-0 px-2 py-0.5 text-[10px] font-medium">
                Awaiting Payment
              </Badge>
            )}
            {maintenanceItem.paymentStatus === 'overpaid' && (
              <Badge className="rounded-full bg-orange-100 text-orange-700 border-0 px-2 py-0.5 text-[10px] font-medium">
                Overpaid
              </Badge>
            )}
            {/* Scope badge */}
            {maintenanceItem.scope && maintenanceItem.scope !== 'UNIT' && (
              <Badge className="rounded-full bg-muted-fill text-text-sub border-0 px-2 py-0.5 text-[10px] font-medium capitalize">
                {maintenanceItem.scope.replace('_', ' ').toLowerCase()}
              </Badge>
            )}
            {/* Source type badge */}
            {maintenanceItem.sourceType && maintenanceItem.sourceType !== 'MANUAL' && (
              <Badge
                className={cn(
                  'rounded-full border-0 px-2 py-0.5 text-[10px] font-medium',
                  sourceConfig?.color ?? 'bg-muted-fill text-text-sub',
                )}
              >
                {sourceConfig?.label ?? maintenanceItem.sourceType}
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

          {/* ── Row 3: Assignment + Quick Actions ────────────────────── */}
          <div className="mt-3 flex items-center justify-between border-t border-muted-fill pt-3">
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Avatar className="w-4 h-4">
                <AvatarImage
                  src={maintenanceItem.assignedTo?.profilePicture}
                  alt={maintenanceItem.assignedTo?.name}
                  width={16} height={16}
                />
                <AvatarFallback className="text-text-strong text-[8px]">
                  {getInitials(maintenanceItem.assignedTo?.name)}
                </AvatarFallback>
              </Avatar>
              <span>{assignedStaffName || 'Unassigned'}</span>
            </div>

            <div className="flex items-center gap-1">
              {!isTerminal && !showAssignSelect && (
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
                {isExpanded
                  ? <ChevronUp className="mr-1 h-3.5 w-3.5" />
                  : <ChevronDown className="mr-1 h-3.5 w-3.5" />}
                {isExpanded ? 'Less' : 'Details'}
              </Button>

              {/* ── Settle button (only for PENDING_SETTLEMENT) ────── */}
              {isPendingSettlement && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-violet-600 hover:text-violet-700 hover:bg-violet-50"
                  onClick={() => setIsSettlementOpen(true)}
                >
                  <Coins className="mr-1 h-3.5 w-3.5" />
                  Settle
                </Button>
              )}
            </div>
          </div>

          {/* ── Inline Assign Select ──────────────────────────────────── */}
          {showAssignSelect && (
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={assignedStaffId || '__unassigned__'}
                onValueChange={handleAssignStaff}
                disabled={assigning}
              >
                <SelectTrigger className="h-8 flex-1 bg-surface-raised border-muted-fill text-sm">
                  <SelectValue placeholder="Select staff">
                    {assignedStaffId ? assignedStaffName ?? 'Assigned' : 'Unassigned'}
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

          {/* ── Expanded Details ──────────────────────────────────────── */}
          {isExpanded && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Info label="Type" value={maintenanceItem.type} />
                <Info label="Scope" value={maintenanceItem.scope?.replace('_', ' ')} />
                <Info label="Estimated" value={`₹${(maintenanceItem.amount || 0).toLocaleString('en-IN')}`} />
                <Info
                  label="Paid"
                  value={`₹${(maintenanceItem.paidAmount || 0).toLocaleString('en-IN')}`}
                  highlight={maintenanceItem.paymentStatus === 'overpaid' ? 'amber' : null}
                />
              </div>

              {/* Payment status */}
              {maintenanceItem.paymentStatus && (
                <div>
                  <p className="text-xs text-text-sub uppercase tracking-wide mb-1">Payment</p>
                  <span className={cn(
                    'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                    paymentBadgeColour,
                  )}>
                    {maintenanceItem.paymentStatus.replace(/_/g, ' ')}
                  </span>
                </div>
              )}

              {/* Contractor */}
              {maintenanceItem.contractor?.name && (
                <div>
                  <p className="text-xs text-text-sub uppercase tracking-wide mb-1">Contractor</p>
                  <p className="text-sm text-text-strong">{maintenanceItem.contractor.name}</p>
                  {maintenanceItem.contractor.phone && (
                    <p className="text-xs text-text-sub">{maintenanceItem.contractor.phone}</p>
                  )}
                </div>
              )}

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

              {maintenanceItem.completionNotes && (
                <div>
                  <p className="text-xs font-medium text-text-sub uppercase tracking-wide mb-1">
                    Completion Notes
                  </p>
                  <p className="text-sm text-text-strong leading-relaxed">
                    {maintenanceItem.completionNotes}
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
      <p className={cn(
        'mt-0.5 text-sm font-medium capitalize',
        highlight === 'amber' ? 'text-orange-600 font-semibold' : 'text-text-body',
      )}>
        {value || 'N/A'}
      </p>
    </div>
  );
}