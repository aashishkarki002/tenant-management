import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Circle, ChevronDown, ChevronUp, Zap, ChevronRight, Wrench, Calendar, List, DollarSign, AlertCircle } from 'lucide-react';
import MaintenanceCard from './components/MaintenanceCard';
import GeneratorPanel from './components/GeneratorPanel';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DualCalendarTailwind from '@/components/dualDate';
import api from '../../plugins/axios';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useFormik } from 'formik';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import FullCalendarView from '../components/fullCalendar';
import { Empty, EmptyTitle } from '@/components/ui/empty';
import { cn } from '@/lib/utils';

/* ── Shared style helpers (consistent across dashboard and cards) ─────────── */
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

export default function Maintenance() {
  const [tenant, setTenant] = useState([]);
  const [unit, setUnit] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [staffs, setStaffs] = useState([]);

  /* Form section collapse state – General Info expanded, others collapsed */
  const [formSections, setFormSections] = useState({
    general: true,
    property: false,
    assign: false,
    timing: false,
  });

  /* Filters */
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  useEffect(() => {
    const getTenants = async () => {
      const response = await api.get('/api/tenant/get-tenants');
      setTenant(response.data.tenants);

      const occupiedUnits = [];
      response.data.tenants.forEach((t) => {
        if (t.units && Array.isArray(t.units)) {
          t.units.forEach((u) => {
            if (u && !occupiedUnits.find((x) => x._id === u._id)) {
              occupiedUnits.push(u);
            }
          });
        }
      });

      const unitResponse = await api.get('/api/unit/get-units');
      const unoccupiedUnits = unitResponse.data.units || [];
      const allUnits = [...occupiedUnits];
      unoccupiedUnits.forEach((u) => {
        if (!allUnits.find((x) => x._id === u._id)) allUnits.push(u);
      });
      setUnit(allUnits);
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

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const formik = useFormik({
    initialValues: {
      title: '',
      category: '',
      priority: '',
      status: '',
      unit: '',
      tenant: '',
      assignTo: '',
      estimatedCost: '',
      description: '',
      scheduledDate: '',
    },
    onSubmit: async (values) => {
      try {
        setIsLoading(true);
        const categoryMap = {
          repair: 'Repair',
          maintenance: 'Maintenance',
          inspection: 'Inspection',
          other: 'Other',
        };
        const mappedType = values.category
          ? categoryMap[values.category.toLowerCase()] || 'Maintenance'
          : 'Maintenance';

        const maintenanceData = {
          title: values.title,
          description: values.description,
          type: mappedType,
          priority: values.priority || 'Medium',
          status: values.status || 'OPEN',
          unit: values.unit,
          tenant: values.tenant || undefined,
          assignedTo: values.assignTo || undefined,
          amount: values.estimatedCost ? parseFloat(values.estimatedCost) : 0,
          scheduledDate: values.scheduledDate ? new Date(values.scheduledDate) : new Date(),
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
        console.error('Error creating maintenance:', error);
        toast.error(error.response?.data?.message || 'Failed to create maintenance task');
      } finally {
        formik.resetForm();
        setIsLoading(false);
      }
    },
  });

  useEffect(() => {
    if (formik.values.unit) {
      const unitId = formik.values.unit;
      const foundTenant = tenant.find((t) => {
        if (t.units && Array.isArray(t.units)) {
          return t.units.some((u) => {
            const tenantUnitId = typeof u === 'object' ? u._id : u;
            return tenantUnitId?.toString() === unitId?.toString();
          });
        }
        return false;
      });
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

  const formatStatus = (status) => {
    if (!status) return 'Open';
    return status.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return date;
    }
  };

  const toggleFormSection = (key) => {
    setFormSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /* ── Stats (computed from maintenance) ─────────────────────────────────── */
  const stats = useMemo(() => {
    const list = maintenance || [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const open = list.filter((m) => (m.status || 'OPEN').toUpperCase() === 'OPEN').length;
    const inProgress = list.filter((m) => (m.status || '').toUpperCase() === 'IN_PROGRESS').length;
    const completed = list.filter((m) => (m.status || '').toUpperCase() === 'COMPLETED').length;
    const cancelled = list.filter((m) => (m.status || '').toUpperCase() === 'CANCELLED').length;
    const overdue = list.filter((m) => {
      const s = (m.status || '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      try {
        const d = new Date(m.scheduledDate);
        d.setHours(0, 0, 0, 0);
        return d < today;
      } catch {
        return false;
      }
    }).length;
    const highPriority = list.filter((m) => {
      const p = (m.priority || '').toUpperCase();
      return p === 'HIGH' || p === 'URGENT';
    }).length;

    const estimated = list.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
    const collected = list.reduce((sum, m) => sum + (Number(m.paidAmount) || 0), 0);
    const outstanding = estimated - collected;

    return {
      total: list.length,
      open,
      inProgress,
      completed,
      cancelled,
      overdue,
      highPriority,
      estimated,
      collected,
      outstanding,
    };
  }, [maintenance]);

  /* ── Filtered list for List tab ───────────────────────────────────────── */
  const filteredMaintenance = useMemo(() => {
    let list = maintenance || [];
    if (statusFilter !== 'All') {
      list = list.filter((m) => (m.status || 'OPEN').toUpperCase() === statusFilter);
    }
    if (priorityFilter !== 'All') {
      list = list.filter(
        (m) => (m.priority || '').toLowerCase() === priorityFilter.toLowerCase()
      );
    }
    return list;
  }, [maintenance, statusFilter, priorityFilter]);

  return (
    <div className="space-y-8 pb-12">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Maintenance</h1>
          <p className="mt-1 text-sm text-gray-500">Schedule repairs and manage tasks</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow">
              <Plus className="mr-2 h-4 w-4" />
              Schedule Repair
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl lg:max-w-3xl bg-white text-black max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gray-900">
                Add Maintenance Task
              </DialogTitle>
              <DialogDescription className="text-gray-600">
                Log new repair or upkeep request
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={formik.handleSubmit} className="mt-4">
              <div className="space-y-4">
                {/* General Info (expandable, default open) */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => toggleFormSection('general')}
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900"
                  >
                    General Information
                    {formSections.general ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {formSections.general && (
                    <div className="space-y-4 border-t border-gray-200 px-4 pb-4 pt-3">
                      <div>
                        <Label htmlFor="title" className="text-gray-700">Task Title</Label>
                        <Input
                          id="title"
                          name="title"
                          placeholder="e.g., AC Repair or Leaking Faucet"
                          value={formik.values.title}
                          onChange={formik.handleChange}
                          className="mt-1.5 bg-white border-gray-300"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-700">Task Description</Label>
                        <Input
                          name="description"
                          placeholder="Enter description"
                          value={formik.values.description}
                          onChange={formik.handleChange}
                          className="mt-1.5 bg-white border-gray-300"
                        />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <Label className="text-gray-700">Category</Label>
                          <Select
                            value={formik.values.category}
                            onValueChange={(v) => formik.setFieldValue('category', v)}
                          >
                            <SelectTrigger className="mt-1.5 bg-white border-gray-300">
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
                          <Label className="text-gray-700">Status</Label>
                          <Select
                            value={formik.values.status}
                            onValueChange={(v) => formik.setFieldValue('status', v)}
                          >
                            <SelectTrigger className="mt-1.5 bg-white border-gray-300">
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
                        <Label className="text-gray-700">Priority Level</Label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {PRIORITY_OPTIONS.map(({ value, dot, label }) => (
                            <Button
                              key={value}
                              type="button"
                              variant="outline"
                              onClick={() => formik.setFieldValue('priority', value)}
                              className={cn(
                                'rounded-full text-sm font-medium transition',
                                formik.values.priority === value
                                  ? 'border-gray-700 bg-gray-700 text-white'
                                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                              )}
                            >
                              <span className={cn('mr-1.5 h-2 w-2 rounded-full', dot)} />
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Property & Tenant (collapsed by default) */}
                <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => toggleFormSection('property')}
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900"
                  >
                    Property & Tenant
                    {formSections.property ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  {formSections.property && (
                    <div className="space-y-4 border-t border-gray-200 px-4 pb-4 pt-3">
                      <div>
                        <Label className="text-gray-700">Unit Number</Label>
                        <Select
                          value={formik.values.unit}
                          onValueChange={(v) => formik.setFieldValue('unit', v)}
                        >
                          <SelectTrigger className="mt-1.5 bg-white border-gray-300">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {unit.map((u) => (
                              <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedTenant && (
                        <div className="rounded-md border border-gray-200 bg-white p-4">
                          <p className="mb-2 text-sm font-medium text-gray-700">Tenant Details</p>
                          <div className="grid gap-2 text-sm sm:grid-cols-2">
                            <div><span className="text-gray-500">Name</span><p className="font-medium text-gray-900">{selectedTenant.name || 'N/A'}</p></div>
                            <div><span className="text-gray-500">Email</span><p className="text-gray-900">{selectedTenant.email || 'N/A'}</p></div>
                            <div><span className="text-gray-500">Phone</span><p className="text-gray-900">{selectedTenant.phone || 'N/A'}</p></div>
                            {selectedTenant.address && (
                              <div className="sm:col-span-2"><span className="text-gray-500">Address</span><p className="text-gray-900">{selectedTenant.address}</p></div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Assign To + Timing – two columns on desktop */}
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                    <button
                      type="button"
                      onClick={() => toggleFormSection('assign')}
                      className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900"
                    >
                      Assign To
                      {formSections.assign ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {formSections.assign && (
                      <div className="space-y-4 border-t border-gray-200 px-4 pb-4 pt-3">
                        <div>
                          <Label className="text-gray-700">Assign To Staff</Label>
                          <Select
                            value={formik.values.assignTo || ''}
                            onValueChange={(v) => formik.setFieldValue('assignTo', v)}
                            disabled={staffs.length === 0}
                          >
                            <SelectTrigger className="mt-1.5 bg-white border-gray-300">
                              <SelectValue placeholder={staffs.length === 0 ? 'No staff available' : 'Select staff'} />
                            </SelectTrigger>
                            {staffs.length > 0 && (
                              <SelectContent>
                                {staffs.map((s) => (
                                  <SelectItem key={s._id} value={s._id}>
                                    {s.name || s.email || 'Unnamed Staff'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            )}
                          </Select>
                        </div>
                        <div>
                          <Label className="text-gray-700">Estimated Cost</Label>
                          <div className="relative mt-1.5">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600">₹</span>
                            <Input
                              name="estimatedCost"
                              type="number"
                              value={formik.values.estimatedCost}
                              onChange={formik.handleChange}
                              className="pl-8 bg-white border-gray-300"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50/50">
                    <button
                      type="button"
                      onClick={() => toggleFormSection('timing')}
                      className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900"
                    >
                      Timing & Documentation
                      {formSections.timing ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {formSections.timing && (
                      <div className="border-t border-gray-200 px-4 pb-4 pt-3">
                        <Label className="text-gray-700">Scheduled Date (English/Nepali)</Label>
                        <div className="mt-1.5">
                          <DualCalendarTailwind
                            value={formik.values.scheduledDate || ''}
                            onChange={(englishDate) => formik.setFieldValue('scheduledDate', englishDate)}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter className="mt-6 flex gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" disabled={isLoading}>
                    Cancel
                  </Button>
                </DialogClose>
                {isLoading ? (
                  <Spinner className="h-4 w-4 animate-spin" />
                ) : (
                  <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
                    Save
                  </Button>
                )}
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Stats section ─────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, icon: Wrench, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800' },
            { label: 'Open', value: stats.open, icon: Circle, bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-800' },
            { label: 'In Progress', value: stats.inProgress, icon: ChevronRight, bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
            { label: 'Completed', value: stats.completed, icon: Circle, bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
            { label: 'Cancelled', value: stats.cancelled, icon: Circle, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
            { label: 'Overdue', value: stats.overdue, icon: AlertCircle, bg: stats.overdue > 0 ? 'bg-amber-50' : 'bg-gray-50', border: stats.overdue > 0 ? 'border-amber-200' : 'border-gray-200', text: stats.overdue > 0 ? 'text-amber-800' : 'text-gray-700' },
            { label: 'High Priority', value: stats.highPriority, icon: AlertCircle, bg: stats.highPriority > 0 ? 'bg-orange-50' : 'bg-gray-50', border: stats.highPriority > 0 ? 'border-orange-200' : 'border-gray-200', text: stats.highPriority > 0 ? 'text-orange-800' : 'text-gray-700' },
          ].map(({ label, value, icon: Icon, bg, border, text }) => (
            <div
              key={label}
              className={cn(
                'rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                bg,
                border,
                text
              )}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                  <Icon className="h-5 w-5 opacity-80" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value}</p>
                  <p className="text-sm font-medium opacity-80">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Financial cards – visually distinct row */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Estimated', value: stats.estimated, prefix: '₹', bg: 'bg-slate-100', border: 'border-slate-300' },
            { label: 'Collected', value: stats.collected, prefix: '₹', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'Outstanding', value: stats.outstanding, prefix: '₹', bg: stats.outstanding > 0 ? 'bg-amber-50' : 'bg-gray-50', border: stats.outstanding > 0 ? 'border-amber-200' : 'border-gray-200' },
          ].map(({ label, value, prefix, bg, border }) => (
            <div
              key={label}
              className={cn(
                'rounded-xl border p-4 shadow-sm transition hover:shadow-md',
                bg,
                border
              )}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-600">{label}</span>
              </div>
              <p className="mt-1 text-xl font-bold text-gray-900">
                {prefix}{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="list" className="mt-8">
        <TabsList className="flex h-11 w-full rounded-lg bg-gray-100 p-1 sm:w-auto">
          <TabsTrigger value="list" className="flex-1 gap-2 rounded-md sm:flex-initial">
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex-1 gap-2 rounded-md sm:flex-initial">
            <Calendar className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="generator" className="flex-1 gap-2 rounded-md sm:flex-initial">
            <Zap className="h-4 w-4" />
            Generator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          {/* Filters */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center text-sm font-medium text-gray-600">Status:</span>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition',
                    statusFilter === s
                      ? 'bg-slate-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {s === 'All' ? 'All' : formatStatus(s)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center text-sm font-medium text-gray-600">Priority:</span>
              {PRIORITY_FILTERS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition',
                    priorityFilter === p
                      ? 'bg-slate-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {filteredMaintenance.length > 0 ? (
            <div className="space-y-4">
              {filteredMaintenance.map((item) => {
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
                  />
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50/50">
              <Empty>
                <EmptyTitle className="text-gray-500">
                  {maintenance.length === 0
                    ? 'No maintenance tasks found'
                    : 'No tasks match the current filters'}
                </EmptyTitle>
              </Empty>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <FullCalendarView maintenance={maintenance} />
          </div>
        </TabsContent>

        <TabsContent value="generator" className="mt-6">
          <GeneratorPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
