import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { List, Calendar, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormik } from 'formik';
import { toast } from 'sonner';
import api from '../../plugins/axios';
import { useUnits } from '../hooks/use-units';
import { useBankAccounts } from '../Accounts/hooks/useAccounting';
import { parseNepaliFields } from '@/hooks/useNepaliDate';
import MaintenanceCard from './components/MaintenanceCard';
import MaintenanceCalendar from './components/MaintenanceCalendar';
import GeneratorPanel from '../Generators/Generator';
import { MaintenanceHeader } from './components/MaintenanceHeader';
import { MaintenanceStats } from './components/MaintenanceStats';
import { MaintenanceFilters } from './components/MaintenanceFilters';
import { MaintenanceList } from './components/MaintenanceList';
import { AddMaintenanceDialog } from './components/AddMaintenanceDialog';
import { useMaintenance } from './hooks/useMaintenance';
import { useMaintenanceFilters } from './hooks/useMaintenanceFilters';
import {
  calculateMaintenanceStats,
  formatStatus,
  formatDate,
  generateWorkOrderId,
} from './utils/maintenance.utils';
import { getPriorityStyle, CATEGORY_MAP } from './constants/maintenance.constants';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function MaintenancePage() {
  const { units = [] } = useUnits();
  const { bankAccounts = [] } = useBankAccounts();

  const {
    maintenance,
    staffs,
    tenants,
    fetchMaintenance,
    updateMaintenanceItem,
    isLoading,
    setIsLoading,
  } = useMaintenance();

  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    filteredMaintenance,
    groupedTickets,
    hasActiveFilters,
    clearFilters,
  } = useMaintenanceFilters(maintenance);

  const [expandedCards, setExpandedCards] = useState(new Set());
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [activeTab, setActiveTab] = useState('list');
  const [viewMode, setViewMode] = useState('table');

  const stats = useMemo(() => calculateMaintenanceStats(maintenance), [maintenance]);

  // ── Form ────────────────────────────────────────────────────────────────────
  const formik = useFormik({
    initialValues: {
      title: '',
      category: '',
      priority: '',
      status: '',
      scope: 'UNIT',   // new field
      unit: '',
      tenant: '',
      assignTo: '',
      estimatedCost: '',
      description: '',
      scheduledDate: '',
      scheduledNepaliDate: '',
      scheduledNepaliMonth: null,
      scheduledNepaliYear: null,
      // contractor (optional)
      contractorName: '',
      contractorPhone: '',
      contractorType: 'CONTRACTOR',
    },
    onSubmit: async (values) => {
      try {
        setIsLoading(true);

        const maintenanceData = {
          title: values.title,
          description: values.description,
          type: values.category
            ? CATEGORY_MAP[values.category.toLowerCase()] || 'Maintenance'
            : 'Maintenance',
          priority: values.priority || 'Medium',
          status: values.status || 'OPEN',
          scope: values.scope || 'UNIT',
          unit: values.unit || undefined,
          tenant: values.tenant || undefined,
          assignedTo: values.assignTo || undefined,
          amount: values.estimatedCost ? parseFloat(values.estimatedCost) : 0,
          scheduledDate: values.scheduledDate
            ? new Date(values.scheduledDate)
            : new Date(),
          ...parseNepaliFields(
            values.scheduledDate || new Date().toISOString().slice(0, 10),
          ),
        };

        // Contractor — only include if name provided
        if (values.contractorName?.trim()) {
          maintenanceData.contractor = {
            name: values.contractorName.trim(),
            phone: values.contractorPhone?.trim() || undefined,
            type: values.contractorType || 'CONTRACTOR',
          };
        }

        const response = await api.post('/api/maintenance/create', maintenanceData);

        if (response.data.success) {

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

  // Auto-fill tenant from selected unit
  useEffect(() => {
    if (formik.values.unit) {
      const foundTenant = tenants.find((t) =>
        t.units?.some(
          (u) =>
            (typeof u === 'object' ? u._id : u)?.toString() ===
            formik.values.unit?.toString(),
        ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.unit, tenants]);

  // ── Card renderer ───────────────────────────────────────────────────────────
  const renderCard = useCallback(
    (item) => {
      const isExpanded = expandedCards.has(item._id);
      const workOrderId = generateWorkOrderId(item);

      const toggleExpand = () => {
        setExpandedCards((prev) => {
          const next = new Set(prev);
          if (next.has(item._id)) {
            next.delete(item._id);
          } else {
            next.add(item._id);
          }
          return next;
        });
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
          onUpdate={updateMaintenanceItem}
          bankAccounts={bankAccounts}
          staffs={staffs}
        />
      );
    },
    [expandedCards, bankAccounts, staffs, updateMaintenanceItem],
  );

  const hasAnyTickets = filteredMaintenance.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 sm:px-6 font-sans">

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full  p-2">
        <div className="border-b border-muted-fill ">
          <TabsList className=" h-auto  gap-2">
            {[
              { id: "list", label: "List", Icon: List },
              { id: "calendar", label: "Calendar", Icon: Calendar },
              { id: "generator", label: "Generator", Icon: Zap },
            ].map(({ id, label, Icon }) => (
              <TabsTrigger
                key={id}
                value={id}
                className="flex items-center gap-2  font-medium "
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>
      {/* List Tab */}
      {activeTab === 'list' && (
        <div className="space-y-6">
          <MaintenanceHeader
            viewMode={viewMode}
            setViewMode={setViewMode}
            rightContent={
              <AddMaintenanceDialog
                formik={formik}
                units={units}
                staffs={staffs}
                selectedTenant={selectedTenant}
                isLoading={isLoading}
              />
            }
          />

          <MaintenanceStats stats={stats} />

          <MaintenanceFilters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            priorityFilter={priorityFilter}
            setPriorityFilter={setPriorityFilter}
            hasActiveFilters={hasActiveFilters}
            clearFilters={clearFilters}
            filteredCount={filteredMaintenance.length}
          />

          <MaintenanceList
            viewMode={viewMode}
            groupedTickets={groupedTickets}
            filteredMaintenance={filteredMaintenance}
            renderCard={renderCard}
            formatStatus={formatStatus}
            formatDate={formatDate}
            onUpdate={updateMaintenanceItem}
            bankAccounts={bankAccounts}
            staffs={staffs}
            hasAnyTickets={hasAnyTickets}
            totalMaintenanceCount={maintenance.length}
            emptyAction={
              <AddMaintenanceDialog
                formik={formik}
                units={units}
                staffs={staffs}
                selectedTenant={selectedTenant}
                isLoading={isLoading}
                label="Create First Repair"
              />
            }
          />
        </div>
      )}

      {/* Calendar Tab */}
      {activeTab === 'calendar' && (
        <MaintenanceCalendar maintenance={maintenance} />
      )}

      {/* Generator Tab */}
      {activeTab === 'generator' && <GeneratorPanel />}
    </div>
  );
}