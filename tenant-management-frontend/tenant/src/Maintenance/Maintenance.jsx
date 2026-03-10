import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import {
  Plus, ChevronDown, ChevronUp, Zap, Calendar, List,
  Search, LayoutGrid, LayoutList,
} from 'lucide-react';
import MaintenanceCard from './components/MaintenanceCard';
import MaintenanceCalendar from './components/MaintenanceCalendar';
import MaintenanceTable from './components/MaintenanceTable';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import DualCalendarTailwind from '@/components/dualDate';
import { parseNepaliFields } from '@/hooks/useNepaliDate';
import api from '../../plugins/axios';
import { useUnits } from '../hooks/use-units';
import { useBankAccounts } from '../Accounts/hooks/useAccounting';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useFormik } from 'formik';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';
import GeneratorPanel from '../Generators/Generator';
import { useHeaderSlot } from '../context/HeaderSlotContext';

/* ── Style helpers ────────────────────────────────────────────────────────── */
export const getPriorityStyle = (priority) => {
  const p = (priority || '').toUpperCase();
  if (p === 'URGENT') return 'bg-red-100 text-red-700';
  if (p === 'HIGH') return 'bg-orange-100 text-orange-700';
  if (p === 'MEDIUM') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-600';
};

export const getStatusStyle = (status) => {
  const s = (status || 'OPEN').toUpperCase();
  if (s === 'COMPLETED') return 'bg-emerald-600 text-emerald-50';
  if (s === 'IN_PROGRESS') return 'bg-blue-600 text-blue-50';
  if (s === 'CANCELLED') return 'bg-gray-500 text-gray-100';
  return 'bg-slate-600 text-slate-100';
};

const PRIORITY_OPTIONS = [
  { value: 'Low', dot: 'bg-gray-500', label: 'Low' },
  { value: 'Medium', dot: 'bg-amber-500', label: 'Medium' },
  { value: 'High', dot: 'bg-orange-500', label: 'High' },
  { value: 'Urgent', dot: 'bg-red-500', label: 'Urgent' },
];

const STATUS_FILTERS = ['All', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const PRIORITY_FILTERS = ['All', 'Urgent', 'High', 'Medium', 'Low'];

const SECTION_CONFIG = [
  { key: 'overdue', label: 'Overdue', dot: 'bg-red-500', textColor: 'text-red-700' },
  { key: 'urgent', label: 'Urgent Priority', dot: 'bg-orange-500', textColor: 'text-orange-700' },
  { key: 'open', label: 'Open', dot: 'bg-slate-400', textColor: 'text-slate-700' },
  { key: 'inProgress', label: 'In Progress', dot: 'bg-blue-500', textColor: 'text-blue-700' },
  { key: 'completed', label: 'Completed', dot: 'bg-emerald-500', textColor: 'text-emerald-700' },
];

/* ─────────────────────────────────────────────────────────────────────────── */
export default function Maintenance() {
  const [tenant, setTenant] = useState([]);
  const { units = [] } = useUnits();
  const { bankAccounts = [] } = useBankAccounts();
  const [maintenance, setMaintenance] = useState([]);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [staffs, setStaffs] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [activeTab, setActiveTab] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('cards');

  const [formSections, setFormSections] = useState({
    general: true, property: false, assign: false, timing: false,
  });

  /* ── Data fetching ── */
  useEffect(() => {
    const getTenants = async () => {
      const response = await api.get('/api/tenant/get-tenants');
      setTenant(response.data.tenants);
    };
    getTenants();
  }, []);

  const fetchMaintenance = async () => {
    const response = await api.get('/api/maintenance/all');
    setMaintenance(response.data.maintenance);
    const uniqueStaffs = [];
    const staffMap = new Map();
    (response.data.maintenance || []).forEach((item) => {
      if (item.assignedTo?._id && !staffMap.has(item.assignedTo._id)) {
        staffMap.set(item.assignedTo._id, item.assignedTo);
        uniqueStaffs.push(item.assignedTo);
      }
    });
    setStaffs(uniqueStaffs);
  };

  useEffect(() => { fetchMaintenance(); }, []);

  /* ── Form ── */
  const formik = useFormik({
    initialValues: {
      title: '', category: '', priority: '', status: '',
      unit: '', tenant: '', assignTo: '', estimatedCost: '',
      description: '', scheduledDate: '',
      scheduledNepaliDate: '', scheduledNepaliMonth: null, scheduledNepaliYear: null,
    },
    onSubmit: async (values) => {
      try {
        setIsLoading(true);
        const categoryMap = { repair: 'Repair', maintenance: 'Maintenance', inspection: 'Inspection', other: 'Other' };
        const maintenanceData = {
          title: values.title,
          description: values.description,
          type: values.category ? categoryMap[values.category.toLowerCase()] || 'Maintenance' : 'Maintenance',
          priority: values.priority || 'Medium',
          status: values.status || 'OPEN',
          unit: values.unit,
          tenant: values.tenant || undefined,
          assignedTo: values.assignTo || undefined,
          amount: values.estimatedCost ? parseFloat(values.estimatedCost) : 0,
          scheduledDate: values.scheduledDate ? new Date(values.scheduledDate) : new Date(),
          ...parseNepaliFields(values.scheduledDate || new Date().toISOString().slice(0, 10)),
        };
        const response = await api.post('/api/maintenance/create', maintenanceData);
        if (response.data.success) {
          toast.success('Maintenance task created successfully');
          formik.resetForm();
          setSelectedTenant(null);
          fetchMaintenance();
        } else {
          toast.error(response.data.message || 'Failed to create maintenance task');
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to create maintenance task');
      } finally {
        formik.resetForm();
        setIsLoading(false);
      }
    },
  });

  useEffect(() => {
    if (formik.values.unit) {
      const foundTenant = tenant.find((t) =>
        t.units?.some((u) => (typeof u === 'object' ? u._id : u)?.toString() === formik.values.unit?.toString()),
      );
      if (foundTenant) {
        setSelectedTenant(foundTenant);
        formik.setFieldValue('tenant', foundTenant._id);
      } else {
        setSelectedTenant(null);
        formik.setFieldValue('tenant', '');
      }
    } else {
      setSelectedTenant(null);
      formik.setFieldValue('tenant', '');
    }
  }, [formik.values.unit, tenant]);

  /* ── Helpers ── */
  const formatStatus = (status) => {
    if (!status) return 'Open';
    return status.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };
  const formatDate = (date) => {
    if (!date) return 'N/A';
    try { return new Date(date).toLocaleDateString(); } catch { return date; }
  };
  const toggleFormSection = (key) =>
    setFormSections((prev) => ({ ...prev, [key]: !prev[key] }));

  /* ── Stats ── */
  const stats = useMemo(() => {
    const list = maintenance || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const open = list.filter((m) => (m.status || 'OPEN').toUpperCase() === 'OPEN').length;
    const inProgress = list.filter((m) => (m.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const overdue = list.filter((m) => {
      const s = (m.status || '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      try { const d = new Date(m.scheduledDate); d.setHours(0, 0, 0, 0); return d < today; } catch { return false; }
    }).length;
    const completedThisWeek = list.filter((m) => {
      if ((m.status || '').toUpperCase() !== 'COMPLETED') return false;
      try { const d = new Date(m.updatedAt || m.scheduledDate); return d >= weekAgo; } catch { return false; }
    }).length;

    return { open, inProgress, overdue, completedThisWeek };
  }, [maintenance]);

  /* ── Filtered list ── */
  const filteredMaintenance = useMemo(() => {
    let list = maintenance || [];
    if (statusFilter !== 'All') list = list.filter((m) => (m.status || 'OPEN').toUpperCase() === statusFilter);
    if (priorityFilter !== 'All') list = list.filter((m) => (m.priority || '').toLowerCase() === priorityFilter.toLowerCase());
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) =>
        (m.title || '').toLowerCase().includes(q) ||
        (m.unit?.name || '').toLowerCase().includes(q) ||
        (m.tenant?.name || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q) ||
        (m.assignedTo?.name || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [maintenance, statusFilter, priorityFilter, searchQuery]);

  /* ── Grouped tickets for card view ── */
  const groupedTickets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const groups = { overdue: [], urgent: [], open: [], inProgress: [], completed: [] };

    filteredMaintenance.forEach((t) => {
      const status = (t.status || 'OPEN').toUpperCase();
      const priority = (t.priority || '').toUpperCase();
      const isOverdue =
        status !== 'COMPLETED' &&
        status !== 'CANCELLED' &&
        (() => {
          try {
            const d = new Date(t.scheduledDate);
            d.setHours(0, 0, 0, 0);
            return d < today;
          } catch {
            return false;
          }
        })();

      if (isOverdue) groups.overdue.push(t);
      else if (priority === 'URGENT' && status !== 'COMPLETED' && status !== 'CANCELLED') groups.urgent.push(t);
      else if (status === 'OPEN') groups.open.push(t);
      else if (status === 'IN_PROGRESS') groups.inProgress.push(t);
      else groups.completed.push(t);
    });

    return groups;
  }, [filteredMaintenance]);

  const hasAnyTickets = filteredMaintenance.length > 0;
  const hasActiveFilters = statusFilter !== 'All' || priorityFilter !== 'All' || searchQuery.trim();

  /* ── Card render helper ── */
  const renderCard = (item) => {
    const isExpanded = expandedCards.has(item._id);
    const workOrderId = `#WO-${String(item._id || '').slice(-4).toUpperCase()}`;
    const toggleExpand = () => {
      const next = new Set(expandedCards);
      if (isExpanded) next.delete(item._id);
      else next.add(item._id);
      setExpandedCards(next);
    };
    return (
      <MaintenanceCard
        key={item._id}
        maintenanceItem={item}
        isExpanded={isExpanded}
        toggleExpand={toggleExpand}
        getPriorityStyle={getPriorityStyle}
        formatStatus={formatStatus}
        formatDate={formatDate}
        workOrderId={workOrderId}
        onUpdate={fetchMaintenance}
        bankAccounts={bankAccounts}
      />
    );
  };

  // ── Header slot ─────────────────────────────────────────────────────────
  useHeaderSlot(
    () => (
      <div className="flex items-center w-full min-w-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-text-strong" />
            <span className="text-sm font-semibold whitespace-nowrap text-text-strong">
              Maintenance
            </span>
          </div>
          <div className="hidden sm:block h-4 w-px shrink-0 bg-muted-fill" />
          <nav className="flex items-center gap-1 flex-1 sm:flex-none">
            {[
              { id: 'list', label: 'List', Icon: List },
              { id: 'calendar', label: 'Calendar', Icon: Calendar },
              { id: 'generator', label: 'Generator', Icon: Zap },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors',
                  activeTab === id
                    ? 'bg-surface-raised text-text-strong'
                    : 'text-text-sub',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>

      </div>
    ),
    [activeTab],
  );

  /* ────────────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────────────── */
  return (
    <div className="pb-12">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6 bg-surface">
        {/* ════════════════ LIST TAB ════════════════ */}
        <TabsContent value="list" className="space-y-6">

          {/* ── Page Header ── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text-strong sm:text-3xl">Maintenance</h1>
              <p className="mt-1 text-sm text-text-sub">
                Manage repair requests and track maintenance tasks
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-muted-fill bg-muted-fill/50 p-0.5">
                <button
                  onClick={() => setViewMode('cards')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'cards'
                      ? 'bg-surface-raised text-text-strong shadow-sm'
                      : 'text-text-sub hover:text-text-body',
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Cards
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'table'
                      ? 'bg-surface-raised text-text-strong shadow-sm'
                      : 'text-text-sub hover:text-text-body',
                  )}
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  Table
                </button>
              </div>
              <AddTaskDialog
                formik={formik}
                formSections={formSections}
                toggleFormSection={toggleFormSection}
                unit={units ?? []}
                staffs={staffs ?? []}
                selectedTenant={selectedTenant}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              {
                label: 'Open',
                value: stats.open,
                bg: 'bg-muted-fill', border: 'border-muted-fill',
                numColor: 'text-text-strong',
              },
              {
                label: 'In Progress',
                value: stats.inProgress,
                bg: 'bg-muted-fill', border: 'border-muted-fill',
                numColor: 'text-text-strong',
              },
              {
                label: 'Overdue',
                value: stats.overdue,
                bg: stats.overdue > 0 ? 'bg-muted-fill' : 'bg-muted-fill',
                border: stats.overdue > 0 ? 'border-muted-fill' : 'border-muted-fill',
                numColor: stats.overdue > 0 ? 'text-text-strong' : 'text-text-sub',
              },
              {
                label: 'Completed This Week',
                value: stats.completedThisWeek,
                bg: 'bg-muted-fill', border: 'border-muted-fill',
                numColor: 'text-text-strong',
              },
            ].map(({ label, value, bg, border, numColor }) => (
              <div key={label} className={cn('rounded-xl border p-5 shadow-sm', bg, border)}>
                <p className={cn('text-3xl font-bold tabular-nums', numColor)}>{value}</p>
                <p className="mt-1 text-xs font-medium text-text-sub">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Search ── */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-sub pointer-events-none" />
            <Input
              placeholder="Search repairs, tenants, or units..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-surface-raised border-muted-fill h-10"
            />
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Status filters */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-sub">
                Status
              </span>
              <div className="sm:hidden flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-sm bg-surface-raised border-muted-fill">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s === 'All' ? 'All' : formatStatus(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:flex items-center rounded-lg border border-gray-200 bg-gray-50/50 p-0.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                      statusFilter === s
                        ? 'bg-surface-raised text-text-strong shadow-sm'
                        : 'text-text-sub hover:text-text-body',
                    )}
                  >
                    {s === 'All' ? 'All' : formatStatus(s)}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden sm:block h-4 w-px bg-muted-fill" />

            {/* Priority filters */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-sub">
                Priority
              </span>
              <div className="sm:hidden flex-1">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-8 text-sm bg-surface-raised border-muted-fill">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_FILTERS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="hidden sm:flex items-center rounded-lg border border-muted-fill bg-muted-fill/50 p-0.5">
                {PRIORITY_FILTERS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityFilter(p)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      priorityFilter === p
                        ? 'bg-surface-raised text-text-strong shadow-sm'
                        : 'text-text-sub hover:text-text-body',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Result count */}
            {hasActiveFilters && (
              <span className="ml-auto text-xs text-text-sub">
                {filteredMaintenance.length} result{filteredMaintenance.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* ── Content ── */}
          {hasAnyTickets ? (
            viewMode === 'cards' ? (
              <div className="space-y-8">
                {SECTION_CONFIG.map(({ key, label, dot, textColor }) => {
                  const items = groupedTickets[key];
                  if (!items || items.length === 0) return null;
                  return (
                    <div key={key}>
                      <div className="flex items-center gap-2.5 mb-4">
                        <div className={cn('h-2 w-2 rounded-full', dot)} />
                        <h3 className={cn('text-sm font-semibold', textColor)}>{label}</h3>
                        <span className="text-xs text-text-sub tabular-nums">{items.length}</span>
                        <div className="flex-1 border-t border-gray-100" />
                      </div>
                      <div className="space-y-4">
                        {items.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <MaintenanceTable
                data={filteredMaintenance}
                formatStatus={formatStatus}
                formatDate={formatDate}
                onUpdate={fetchMaintenance}
                bankAccounts={bankAccounts}
              />
            )
          ) : (
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <Empty>
                <EmptyTitle className="text-text-sub">
                  {maintenance.length === 0
                    ? "No maintenance tasks yet"
                    : "No tasks match the current filters"}
                </EmptyTitle>
              </Empty>

              {maintenance.length === 0 && (
                <AddTaskDialog
                  formik={formik}
                  formSections={formSections}
                  toggleFormSection={toggleFormSection}
                  unit={units ?? []}
                  staffs={staffs ?? []}
                  selectedTenant={selectedTenant}
                  isLoading={isLoading}
                  label="Create First Repair"
                />
              )}
            </div>
          )}
        </TabsContent>

        {/* ════════════════ CALENDAR TAB ════════════════ */}
        <TabsContent value="calendar">
          <MaintenanceCalendar maintenance={maintenance} />
        </TabsContent>

        {/* ════════════════ GENERATOR TAB ════════════════ */}
        <TabsContent value="generator">
          <GeneratorPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Add Task Dialog ─────────────────────────────────────────────────────── */
function AddTaskDialog({
  formik, formSections, toggleFormSection,
  unit, staffs, selectedTenant, isLoading,
  compact = false, label,
}) {
  const buttonLabel = label || '+ New Repair';
  return (
    <Dialog>
      <DialogTrigger asChild>
        {compact ? (
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-primary text-white hover:bg-primary/80 shadow-sm">
            <Plus className="mr-1.5 h-4 w-4" /> {buttonLabel}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl bg-white text-black max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-text-strong">
            Add Maintenance Task
          </DialogTitle>
          <DialogDescription className="text-text-sub">
            Log new repair or upkeep request
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="mt-4">
          <div className="space-y-4">
            <FormSection
              title="General Information"
              open={formSections.general}
              toggle={() => toggleFormSection('general')}
            >
              <div>
                <Label htmlFor="title" className="text-gray-700">Task Title</Label>
                <Input
                  id="title" name="title"
                  placeholder="e.g., AC Repair or Leaking Faucet"
                  value={formik.values.title} onChange={formik.handleChange}
                  className="mt-1.5 bg-surface-raised border-muted-fill"
                />
              </div>
              <div>
                <Label className="text-text-strong">Task Description</Label>
                <Input
                  name="description" placeholder="Enter description"
                  value={formik.values.description} onChange={formik.handleChange}
                  className="mt-1.5 bg-surface-raised border-muted-fill"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-text-strong">Category</Label>
                  <Select value={formik.values.category} onValueChange={(v) => formik.setFieldValue('category', v)}>
                    <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-text-strong">Status</Label>
                  <Select value={formik.values.status} onValueChange={(v) => formik.setFieldValue('status', v)}>
                    <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-text-strong">Priority Level</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map(({ value, dot, label: lbl }) => (
                    <Button
                      key={value} type="button" variant="outline"
                      onClick={() => formik.setFieldValue('priority', value)}
                      className={cn(
                        'rounded-full text-sm font-medium transition',
                        formik.values.priority === value
                          ? 'border-text-strong bg-text-strong text-white'
                          : 'border-muted-fill bg-surface-raised text-text-sub hover:bg-surface-hover',
                      )}
                    >
                      <span className={cn('mr-1.5 h-2 w-2 rounded-full', dot)} />{lbl}
                    </Button>
                  ))}
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Property & Tenant"
              open={formSections.property}
              toggle={() => toggleFormSection('property')}
            >
              <div>
                <Label className="text-text-strong">Unit Number</Label>
                <Select value={formik.values.unit} onValueChange={(v) => formik.setFieldValue('unit', v)}>
                  <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(unit ?? []).map((u) => (
                      <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTenant && (
                <div className="rounded-md border border-muted-fill bg-surface-raised p-4">
                  <p className="mb-2 text-sm font-medium text-text-strong">Tenant Details</p>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-text-sub">Name</span>
                      <p className="font-medium text-text-strong">{selectedTenant.name || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-sub">Email</span>
                      <p className="text-text-strong">{selectedTenant.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-text-sub">Phone</span>
                      <p className="text-text-strong">{selectedTenant.phone || 'N/A'}</p>
                    </div>
                    {selectedTenant.address && (
                      <div className="sm:col-span-2">
                        <span className="text-text-sub">Address</span>
                        <p className="text-text-strong">{selectedTenant.address}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </FormSection>

            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection
                title="Assign To"
                open={formSections.assign}
                toggle={() => toggleFormSection('assign')}
              >
                <div>
                  <Label className="text-text-strong">Assign To Staff</Label>
                  <Select
                    value={formik.values.assignTo || ''}
                    onValueChange={(v) => formik.setFieldValue('assignTo', v)}
                    disabled={(staffs ?? []).length === 0}
                  >
                    <SelectTrigger className="mt-1.5 bg-surface-raised border-muted-fill">
                      <SelectValue placeholder={(staffs ?? []).length === 0 ? 'No staff available' : 'Select staff'} />
                    </SelectTrigger>
                    {(staffs ?? []).length > 0 && (
                      <SelectContent>
                        {(staffs ?? []).map((s) => (
                          <SelectItem key={s._id} value={s._id}>
                            {s.name || s.email || 'Unnamed'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    )}
                  </Select>
                </div>
                <div>
                  <Label className="text-text-strong">Estimated Cost</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-sub">₹</span>
                    <Input
                      name="estimatedCost" type="number"
                      value={formik.values.estimatedCost}
                      onChange={formik.handleChange}
                      className="pl-8 bg-surface-raised border-muted-fill"
                    />
                  </div>
                </div>
              </FormSection>

              <FormSection
                title="Timing & Documentation"
                open={formSections.timing}
                toggle={() => toggleFormSection('timing')}
              >
                <Label className="text-text-strong">Scheduled Date (English/Nepali)</Label>
                <div className="mt-1.5">
                  <DualCalendarTailwind
                    value={formik.values.scheduledDate || ''}
                    onChange={(englishDate, nepaliDateStr) => {
                      formik.setFieldValue('scheduledDate', englishDate);
                      if (nepaliDateStr) {
                        const { nepaliMonth, nepaliYear } = parseNepaliFields(englishDate);
                        formik.setFieldValue('scheduledNepaliDate', nepaliDateStr);
                        formik.setFieldValue('scheduledNepaliMonth', nepaliMonth);
                        formik.setFieldValue('scheduledNepaliYear', nepaliYear);
                      }
                    }}
                  />
                </div>
              </FormSection>
            </div>
          </div>

          <DialogFooter className="mt-6 flex gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
            </DialogClose>
            {isLoading
              ? <Spinner className="h-4 w-4 animate-spin" />
              : <Button type="submit" className="bg-primary text-white hover:bg-primary/80">Save</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Collapsible form section ──────────────────────────────────────────── */
function FormSection({ title, open, toggle, children }) {
  return (
    <div className="rounded-lg border border-muted-fill bg-muted-fill/50">
      <button
        type="button" onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-text-strong"
      >
        {title}
        {open
          ? <ChevronUp className="h-4 w-4 text-text-sub" />
          : <ChevronDown className="h-4 w-4 text-text-sub" />}
      </button>
      {open && (
        <div className="space-y-4 border-t border-muted-fill px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}
