import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp, Zap, Calendar, List } from 'lucide-react';
import MaintenanceCard from './components/MaintenanceCard';
import GeneratorPanel from './components/GeneratorPanel';
import MaintenanceCalendar from './components/MaintenanceCalendar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DualCalendarTailwind from '@/components/dualDate';
import { parseNepaliFields } from '@/hooks/useNepaliDate';
import api from '../../plugins/axios';
import { useUnits } from '../hooks/use-units';
import { useBankAccounts } from '../Accounts/hooks/useAccounting';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFormik } from 'formik';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

/* ── Style helpers ────────────────────────────────────────────────────────── */
export const getPriorityStyle = (priority) => {
  const p = (priority || '').toUpperCase();
  if (p === 'URGENT') return 'bg-red-600 text-red-50';
  if (p === 'HIGH') return 'bg-orange-500 text-orange-50';
  if (p === 'MEDIUM') return 'bg-amber-500 text-amber-50';
  return 'bg-gray-500 text-gray-100';
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
      // Nepali equivalents — populated by DualCalendarTailwind's second onChange arg
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
          // Pass denormalised Nepali fields so the service can index them.
          // If the user didn't pick a date via the BS picker, derive from the
          // English date as a safe fallback.
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
        t.units?.some((u) => (typeof u === 'object' ? u._id : u)?.toString() === formik.values.unit?.toString())
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
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const open = list.filter((m) => (m.status || 'OPEN').toUpperCase() === 'OPEN').length;
    const inProgress = list.filter((m) => (m.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const overdue = list.filter((m) => {
      const s = (m.status || '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      try { const d = new Date(m.scheduledDate); d.setHours(0, 0, 0, 0); return d < today; } catch { return false; }
    }).length;
    const highPriority = list.filter((m) => ['HIGH', 'URGENT'].includes((m.priority || '').toUpperCase())).length;
    const estimated = list.reduce((s, m) => s + (Number(m.amount) || 0), 0);
    const collected = list.reduce((s, m) => s + (Number(m.paidAmount) || 0), 0);
    return { total: list.length, open, inProgress, overdue, highPriority, estimated, collected, outstanding: estimated - collected };
  }, [maintenance]);

  /* ── Filtered list ── */
  const filteredMaintenance = useMemo(() => {
    let list = maintenance || [];
    if (statusFilter !== 'All') list = list.filter((m) => (m.status || 'OPEN').toUpperCase() === statusFilter);
    if (priorityFilter !== 'All') list = list.filter((m) => (m.priority || '').toLowerCase() === priorityFilter.toLowerCase());
    return list;
  }, [maintenance, statusFilter, priorityFilter]);



  /* ────────────────────────────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────────────────────────── */
  return (
    <div className="pb-12">
      {/* ── Page title (always visible) ── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Maintenance</h1>
        <p className="mt-1 text-sm text-gray-500">Schedule repairs and manage tasks</p>
      </div>

      {/* ── Tabs — at the very top ── */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="h-10 w-full rounded-lg bg-gray-100 p-1 grid grid-cols-3 sm:flex sm:w-auto">
          <TabsTrigger value="list" className="gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <List className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">List</span>
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Calendar className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Calendar</span>
          </TabsTrigger>
          <TabsTrigger value="generator" className="gap-1.5 rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Zap className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">Generator</span>
          </TabsTrigger>
        </TabsList>

        {/* ════════════════ LIST TAB ════════════════ */}
        <TabsContent value="list" className="space-y-5">

          {/* Header row with Add button — only on list tab */}
          <div className="flex items-center justify-between gap-4">
            <div /> {/* spacer */}
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

          {/* Stats — 4 cards */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Open', value: stats.open, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
                { label: 'In Progress', value: stats.inProgress, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
                { label: 'High Priority', value: stats.highPriority, color: stats.highPriority > 0 ? 'text-orange-700' : 'text-gray-400', bg: stats.highPriority > 0 ? 'bg-orange-50' : 'bg-gray-50', border: stats.highPriority > 0 ? 'border-orange-200' : 'border-gray-200' },
                { label: 'Overdue', value: stats.overdue, color: stats.overdue > 0 ? 'text-red-700' : 'text-gray-400', bg: stats.overdue > 0 ? 'bg-red-50' : 'bg-gray-50', border: stats.overdue > 0 ? 'border-red-200' : 'border-gray-200' },
              ].map(({ label, value, color, bg, border }) => (
                <div key={label} className={cn('rounded-xl border p-4 shadow-sm', bg, border)}>
                  <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{label}</p>
                </div>
              ))}
            </div>

            {/* Financial inline */}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-1 pt-1 text-xs text-gray-400">
              <span className="font-medium text-gray-600">₹{stats.estimated.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span>estimated</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className="font-medium text-emerald-600">₹{stats.collected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span>collected</span>
              <span className="mx-1 text-gray-300">·</span>
              <span className={cn('font-medium', stats.outstanding > 0 ? 'text-amber-600' : 'text-gray-400')}>
                ₹{stats.outstanding.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              <span>outstanding</span>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">Status</span>
              <div className="sm:hidden flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-300"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_FILTERS.map((s) => <SelectItem key={s} value={s}>{s === 'All' ? 'All' : formatStatus(s)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="hidden sm:flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((s) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn('rounded-full px-3 py-1 text-xs font-medium transition',
                      statusFilter === s ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                    {s === 'All' ? 'All' : formatStatus(s)}
                  </button>
                ))}
              </div>
            </div>

            <div className="hidden sm:block h-4 w-px bg-gray-200" />

            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-400">Priority</span>
              <div className="sm:hidden flex-1">
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-8 text-sm bg-white border-gray-300"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITY_FILTERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="hidden sm:flex flex-wrap gap-1.5">
                {PRIORITY_FILTERS.map((p) => (
                  <button key={p} onClick={() => setPriorityFilter(p)}
                    className={cn('rounded-full px-3 py-1 text-xs font-medium transition',
                      priorityFilter === p ? 'bg-slate-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {(statusFilter !== 'All' || priorityFilter !== 'All') && (
              <span className="ml-auto text-xs text-gray-400">
                {filteredMaintenance.length} result{filteredMaintenance.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Cards */}
          {filteredMaintenance.length > 0 ? (
            <div className="space-y-3">
              {filteredMaintenance.map((item) => {
                const isExpanded = expandedCards.has(item._id);
                const workOrderId = `#WO-${String(item._id || '').slice(-4).toUpperCase()}`;
                const toggleExpand = () => {
                  const next = new Set(expandedCards);
                  if (isExpanded) next.delete(item._id); else next.add(item._id);
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
              })}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50">
              <Empty>
                <EmptyTitle className="text-gray-500">
                  {maintenance.length === 0 ? 'No maintenance tasks found' : 'No tasks match the current filters'}
                </EmptyTitle>
              </Empty>
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

/* ── Add Task Dialog — extracted to avoid remount-on-every-keystroke bug ─── */
function AddTaskDialog({ formik, formSections, toggleFormSection, unit, staffs, selectedTenant, isLoading }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Schedule Repair
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl bg-white text-black max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">Add Maintenance Task</DialogTitle>
          <DialogDescription className="text-gray-600">Log new repair or upkeep request</DialogDescription>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="mt-4">
          <div className="space-y-4">

            {/* General Info */}
            <FormSection title="General Information" open={formSections.general} toggle={() => toggleFormSection('general')}>
              <div>
                <Label htmlFor="title" className="text-gray-700">Task Title</Label>
                <Input id="title" name="title" placeholder="e.g., AC Repair or Leaking Faucet"
                  value={formik.values.title} onChange={formik.handleChange}
                  className="mt-1.5 bg-white border-gray-300" />
              </div>
              <div>
                <Label className="text-gray-700">Task Description</Label>
                <Input name="description" placeholder="Enter description"
                  value={formik.values.description} onChange={formik.handleChange}
                  className="mt-1.5 bg-white border-gray-300" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-gray-700">Category</Label>
                  <Select value={formik.values.category} onValueChange={(v) => formik.setFieldValue('category', v)}>
                    <SelectTrigger className="mt-1.5 bg-white border-gray-300"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repair">Repair</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="inspection">Inspection</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700">Status</Label>
                  <Select value={formik.values.status} onValueChange={(v) => formik.setFieldValue('status', v)}>
                    <SelectTrigger className="mt-1.5 bg-white border-gray-300"><SelectValue placeholder="Select status" /></SelectTrigger>
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
                <Label className="text-gray-700">Priority Level</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRIORITY_OPTIONS.map(({ value, dot, label }) => (
                    <Button key={value} type="button" variant="outline"
                      onClick={() => formik.setFieldValue('priority', value)}
                      className={cn('rounded-full text-sm font-medium transition',
                        formik.values.priority === value
                          ? 'border-gray-700 bg-gray-700 text-white'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50')}>
                      <span className={cn('mr-1.5 h-2 w-2 rounded-full', dot)} />{label}
                    </Button>
                  ))}
                </div>
              </div>
            </FormSection>

            {/* Property & Tenant */}
            <FormSection title="Property & Tenant" open={formSections.property} toggle={() => toggleFormSection('property')}>
              <div>
                <Label className="text-gray-700">Unit Number</Label>
                <Select value={formik.values.unit} onValueChange={(v) => formik.setFieldValue('unit', v)}>
                  <SelectTrigger className="mt-1.5 bg-white border-gray-300"><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{(unit ?? []).map((u) => <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {selectedTenant && (
                <div className="rounded-md border border-gray-200 bg-white p-4">
                  <p className="mb-2 text-sm font-medium text-gray-700">Tenant Details</p>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div><span className="text-gray-500">Name</span><p className="font-medium text-gray-900">{selectedTenant.name || 'N/A'}</p></div>
                    <div><span className="text-gray-500">Email</span><p className="text-gray-900">{selectedTenant.email || 'N/A'}</p></div>
                    <div><span className="text-gray-500">Phone</span><p className="text-gray-900">{selectedTenant.phone || 'N/A'}</p></div>
                    {selectedTenant.address && <div className="sm:col-span-2"><span className="text-gray-500">Address</span><p className="text-gray-900">{selectedTenant.address}</p></div>}
                  </div>
                </div>
              )}
            </FormSection>

            {/* Assign + Timing */}
            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection title="Assign To" open={formSections.assign} toggle={() => toggleFormSection('assign')}>
                <div>
                  <Label className="text-gray-700">Assign To Staff</Label>
                  <Select value={formik.values.assignTo || ''} onValueChange={(v) => formik.setFieldValue('assignTo', v)} disabled={(staffs ?? []).length === 0}>
                    <SelectTrigger className="mt-1.5 bg-white border-gray-300">
                      <SelectValue placeholder={(staffs ?? []).length === 0 ? 'No staff available' : 'Select staff'} />
                    </SelectTrigger>
                    {(staffs ?? []).length > 0 && (
                      <SelectContent>{(staffs ?? []).map((s) => <SelectItem key={s._id} value={s._id}>{s.name || s.email || 'Unnamed'}</SelectItem>)}</SelectContent>
                    )}
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-700">Estimated Cost</Label>
                  <div className="relative mt-1.5">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₹</span>
                    <Input name="estimatedCost" type="number" value={formik.values.estimatedCost}
                      onChange={formik.handleChange} className="pl-8 bg-white border-gray-300" />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Timing & Documentation" open={formSections.timing} toggle={() => toggleFormSection('timing')}>
                <Label className="text-gray-700">Scheduled Date (English/Nepali)</Label>
                <div className="mt-1.5">
                  <DualCalendarTailwind
                    value={formik.values.scheduledDate || ''}
                    onChange={(englishDate, nepaliDateStr) => {
                      formik.setFieldValue('scheduledDate', englishDate);
                      // Store the Nepali fields so the submit handler can send
                      // them to the backend without a second conversion.
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
              : <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">Save</Button>
            }
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reusable collapsible form section ───────────────────────────────────── */
function FormSection({ title, open, toggle, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/50">
      <button type="button" onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900">
        {title}
        {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
      </button>
      {open && (
        <div className="space-y-4 border-t border-gray-200 px-4 pb-4 pt-3">
          {children}
        </div>
      )}
    </div>
  );
}