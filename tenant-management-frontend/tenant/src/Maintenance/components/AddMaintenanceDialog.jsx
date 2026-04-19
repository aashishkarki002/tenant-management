import React, { useMemo, useState } from 'react';
import { Plus, ChevronDown, ChevronUp, Wrench } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

import DualCalendarTailwind from '@/components/dualDate';
import { parseNepaliFields } from '@/hooks/useNepaliDate';
import { UnitCombobox } from '@/components/UnitComboBox';

import {
  PRIORITY_OPTIONS,
  CATEGORY_OPTIONS,
  STATUS_OPTIONS,
  SCOPE_OPTIONS,
  CONTRACTOR_TYPE_OPTIONS,
  SCHEDULE_PRESETS,
} from '../constants/maintenance.constants';

import { transformUnitsToOptions } from '../utils/maintenance.utils';
import { cn } from '@/lib/utils';
import { addDays, format } from 'date-fns';

// ── Scope pill selector ───────────────────────────────────────────────────────
function ScopePills({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SCOPE_OPTIONS.map(({ value: v, label, description }) => (
        <button
          key={v}
          type="button"
          title={description}
          onClick={() => onChange(v)}
          className={cn(
            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
            value === v
              ? 'bg-primary text-white border-primary'
              : 'bg-white border-muted-fill hover:bg-muted-fill text-text-body',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
const resolvePresetDate = (days) =>
  format(addDays(new Date(), days), "yyyy-MM-dd");
// ── Collapsible contractor section ────────────────────────────────────────────
function ContractorSection({ formik }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-muted-fill overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-text-body hover:bg-muted-fill/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-text-sub">
          <Wrench className="h-4 w-4" />
          Contractor (optional)
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-text-sub" />
          : <ChevronDown className="h-4 w-4 text-text-sub" />}
      </button>

      {open && (
        <div className="border-t border-muted-fill px-4 pb-4 pt-3 space-y-4">
          <p className="text-xs text-text-sub">
            Optionally record who will perform the work. Can be updated at settlement time.
          </p>

          {/* Name */}
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              name="contractorName"
              placeholder="Contractor or vendor name"
              value={formik.values.contractorName || ''}
              onChange={formik.handleChange}
              className="mt-1.5 h-9 text-sm"
            />
          </div>

          {/* Phone */}
          <div>
            <Label className="text-xs">Phone</Label>
            <Input
              name="contractorPhone"
              placeholder="98XXXXXXXX"
              value={formik.values.contractorPhone || ''}
              onChange={formik.handleChange}
              className="mt-1.5 h-9 text-sm"
            />
          </div>

          {/* Type */}
          <div>
            <Label className="text-xs">Type</Label>
            <Select
              value={formik.values.contractorType || 'CONTRACTOR'}
              onValueChange={(v) => formik.setFieldValue('contractorType', v)}
            >
              <SelectTrigger className="mt-1.5 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACTOR_TYPE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────
export const AddMaintenanceDialog = ({
  formik,
  units = [],
  blocks = [],
  staffs = [],
  selectedTenant = null,
  isLoading = false,
  compact = false,
  label,
}) => {
  const buttonLabel = label || 'New Repair';
  const unitOptions = useMemo(() => transformUnitsToOptions(units), [units]);
  const currentScope = formik?.values?.scope || 'UNIT';

  if (!formik) return null;

  return (
    <Dialog>
      {/* Trigger */}
      <DialogTrigger asChild>
        {compact ? (
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <Plus className="h-4 w-4" />
          </Button>
        ) : (
          <Button className="bg-primary text-white hover:bg-primary/90 shadow-sm">
            <Plus className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="
          p-0 w-[95vw] max-w-4xl max-h-[90vh]
          overflow-hidden flex flex-col
        "
      >
        {/* Header */}
        <div className="border-b px-4 sm:px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Maintenance Task</h2>
          <p className="text-sm text-gray-500">Log a repair or maintenance request</p>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* ── LEFT COLUMN: Task info ─────────────────────────────── */}
              <div className="space-y-6">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Task Information
                </p>

                {/* Title */}
                <div>
                  <Label>Task Title</Label>
                  <Input
                    autoFocus
                    name="title"
                    placeholder="AC repair, leaking pipe…"
                    value={formik.values.title}
                    onChange={formik.handleChange}
                    className="mt-2 h-10"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label>Description</Label>
                  <Input
                    name="description"
                    placeholder="Short description"
                    value={formik.values.description}
                    onChange={formik.handleChange}
                    className="mt-2 h-10"
                  />
                </div>

                {/* Category */}
                <div>
                  <Label>Category</Label>
                  <Select
                    value={formik.values.category}
                    onValueChange={(v) => formik.setFieldValue('category', v)}
                  >
                    <SelectTrigger className="mt-2 h-10">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status */}
                <div>
                  <Label>Initial Status</Label>
                  <Select
                    value={formik.values.status}
                    onValueChange={(v) => formik.setFieldValue('status', v)}
                  >
                    <SelectTrigger className="mt-2 h-10">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Only OPEN and IN_PROGRESS make sense at creation */}
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Priority */}
                <div>
                  <Label>Priority</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {PRIORITY_OPTIONS.map(({ value, dot, label: pLabel }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => formik.setFieldValue('priority', value)}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 text-sm rounded-full border transition',
                          formik.values.priority === value
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white border-gray-200 hover:bg-gray-50',
                        )}
                      >
                        <span className={cn('h-2 w-2 rounded-full', dot)} />
                        {pLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contractor (optional, collapsible) */}
                <ContractorSection formik={formik} />
              </div>

              {/* ── RIGHT COLUMN: Property & Assignment ───────────────── */}
              <div className="space-y-6">
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Property & Assignment
                </p>

                {/* ── Scope ─────────────────────────────────────────────── */}
                <div>
                  <Label>Scope</Label>
                  <p className="text-xs text-text-sub mb-2 mt-0.5">
                    What area does this task cover?
                  </p>
                  <ScopePills
                    value={currentScope}
                    onChange={(v) => formik.setFieldValue('scope', v)}
                  />
                </div>

                {/* Block — shown when scope is BLOCK */}
                {currentScope === 'BLOCK' && (
                  <div>
                    <Label>Block</Label>
                    <Select
                      value={formik.values.block || ''}
                      onValueChange={(v) => formik.setFieldValue('block', v)}
                      disabled={blocks.length === 0}
                    >
                      <SelectTrigger className="mt-2 h-10">
                        <SelectValue placeholder={blocks.length === 0 ? 'No blocks available' : 'Select block'} />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name || 'Unnamed block'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Property — shown when scope is PROPERTY or COMMON_AREA */}
                {(currentScope === 'PROPERTY' || currentScope === 'COMMON_AREA') && blocks.length > 0 && (
                  <div>
                    <Label>Block / Building</Label>
                    <Select
                      value={formik.values.block || ''}
                      onValueChange={(v) => formik.setFieldValue('block', v)}
                    >
                      <SelectTrigger className="mt-2 h-10">
                        <SelectValue placeholder="Select building (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {blocks.map((b) => (
                          <SelectItem key={b._id} value={b._id}>
                            {b.name || 'Unnamed block'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Unit — shown for UNIT scope; optional for others */}
                <div>
                  <Label>
                    Unit
                    {currentScope !== 'UNIT' && (
                      <span className="ml-1 text-[10px] font-normal text-text-sub">
                        (optional for {SCOPE_OPTIONS.find((s) => s.value === currentScope)?.label})
                      </span>
                    )}
                  </Label>
                  <div className="mt-2">
                    <UnitCombobox
                      options={unitOptions}
                      value={formik.values.unit || ''}
                      onChange={(v) => formik.setFieldValue('unit', v)}
                      placeholder="Select unit"
                      loading={isLoading}
                      disabled={isLoading || unitOptions.length === 0}
                    />
                  </div>
                  {/* Common area hint */}
                  {(currentScope === 'COMMON_AREA' || currentScope === 'BLOCK' || currentScope === 'PROPERTY') && (
                    <p className="mt-1.5 text-xs text-text-sub">
                      {currentScope === 'COMMON_AREA'
                        ? 'For hallways, lobby, parking, roof — leave unit blank if not applicable.'
                        : currentScope === 'BLOCK'
                          ? 'This task covers an entire block. Unit is optional.'
                          : 'This task covers the whole property. Unit is optional.'}
                    </p>
                  )}
                </div>

                {/* Tenant (auto-detected) */}
                {selectedTenant && (
                  <div className="rounded-md border bg-surface-raised p-3 text-sm">
                    <p className="font-medium text-text-strong mb-1">Tenant</p>
                    <div className="space-y-1 text-text-sub">
                      <p>{selectedTenant.name || 'N/A'}</p>
                      <p>{selectedTenant.phone || 'N/A'}</p>
                      <p>{selectedTenant.email || 'N/A'}</p>
                    </div>
                  </div>
                )}

                {/* Assign Staff */}
                <div>
                  <Label>Assign Staff</Label>
                  <Select
                    value={formik.values.assignTo || ''}
                    onValueChange={(v) => formik.setFieldValue('assignTo', v)}
                    disabled={staffs.length === 0}
                  >
                    <SelectTrigger className="mt-2 h-10">
                      <SelectValue
                        placeholder={staffs.length === 0 ? 'No staff available' : 'Select staff'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {staffs.map((s) => (
                        <SelectItem key={s._id} value={s._id}>
                          {s.name || s.email || 'Unnamed'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Estimated Cost */}
                <div>
                  <Label>Estimated Cost</Label>
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">RS</span>
                    <Input
                      name="estimatedCost"
                      type="number"
                      placeholder="1500"
                      value={formik.values.estimatedCost}
                      onChange={formik.handleChange}
                      className="pl-7 h-10"
                    />
                  </div>
                </div>

                {/* Scheduled Date */}
                <div>
                  <Label>Scheduled Date</Label>
                  <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
                    {SCHEDULE_PRESETS.map(({ label, days, color }) => {
                      const iso = resolvePresetDate(days);
                      const isActive = formik.values.scheduledDate === iso;
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            const { nepaliMonth, nepaliYear } = parseNepaliFields(iso);
                            formik.setFieldValue('scheduledDate', iso);
                            // scheduledNepaliDate needs DualCalendar's nep string — set only what you can derive
                            formik.setFieldValue('scheduledNepaliMonth', nepaliMonth);
                            formik.setFieldValue('scheduledNepaliYear', nepaliYear);
                          }}
                          className={cn(
                            'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white border-muted-fill hover:bg-muted-fill text-text-body',
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', isActive ? 'bg-white' : color.replace('text-', 'bg-'))} />
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Manual date picker (still fully functional) */}
                  <DualCalendarTailwind
                    value={formik.values.scheduledDate || ''}
                    onChange={(eng, nep) => {
                      // clear any preset highlight when user picks manually
                      formik.setFieldValue('scheduledDate', eng);
                      if (nep) {
                        const { nepaliMonth, nepaliYear } = parseNepaliFields(eng);
                        formik.setFieldValue('scheduledNepaliDate', nep);
                        formik.setFieldValue('scheduledNepaliMonth', nepaliMonth);
                        formik.setFieldValue('scheduledNepaliYear', nepaliYear);
                      }
                    }}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Sticky Footer */}
          <div className="border-t bg-surface-raised px-4 sm:px-6 py-4 flex flex-col sm:flex-row gap-3 sm:justify-end">
            <DialogClose asChild>
              <Button variant="outline" type="button" disabled={isLoading} className="w-full sm:w-auto">
                Cancel
              </Button>
            </DialogClose>

            {isLoading ? (
              <Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <Button
                type="submit"
                className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto"
              >
                Save Task
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog >
  );
};