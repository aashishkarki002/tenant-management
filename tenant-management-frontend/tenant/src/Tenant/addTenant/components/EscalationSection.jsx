/**
 * EscalationSection.jsx
 *
 * PM DECISION — why this lives in FinancialTab, not a new wizard step:
 *   - Escalation terms are written into the lease contract at signing.
 *     The admin has the data upfront alongside rent/CAM figures.
 *   - Not all leases have escalation clauses — a new step would add friction
 *     to every tenant registration unnecessarily.
 *   - Industry standard (AppFolio, Buildium): optional collapsible section
 *     inside the Financial step, toggle-disabled by default.
 *
 * MULTI-TIER SUPPORT:
 *   The model supports a `scheduled` array, allowing different escalation
 *   rules per time window (e.g. +5% for first 3 years, then +7% thereafter).
 *   Each tier is one entry in the array.
 *
 * FORMIK CONTRACT:
 *   formik.values.escalationEnabled         Boolean
 *   formik.values.escalationStartDate       "YYYY-MM-DD" AD  (optional, defaults to leaseStartDate)
 *   formik.values.escalationStartDateNepali "YYYY-MM-DD" BS
 *   formik.values.escalationSchedule        Array<EscalationTier>
 *
 * EscalationTier shape (mirrors Tenant.Model.js rentEscalation.scheduled):
 *   { intervalMonths, type, value, label, appliesTo }
 */

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TrendingUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import DualCalendarTailwind from "../../../components/dualDate";

// ── Constants ────────────────────────────────────────────────────────────────

export const ESCALATION_TYPES = {
    PERCENTAGE: "percentage",
    FIXED_AMOUNT: "fixed_amount",
    FIXED_PER_SQFT: "fixed_per_sqft",
    ABSOLUTE: "absolute",
};

export const ESCALATION_APPLIES_TO = {
    RENT_ONLY: "rent_only",
    CAM_ONLY: "cam_only",
    BOTH: "both",
};

const ESCALATION_TYPE_LABELS = {
    [ESCALATION_TYPES.PERCENTAGE]: "Percentage (%)",
    [ESCALATION_TYPES.FIXED_AMOUNT]: "Fixed amount (Rs)",
    [ESCALATION_TYPES.FIXED_PER_SQFT]: "Per sqft (Rs)",
    [ESCALATION_TYPES.ABSOLUTE]: "Absolute rent (Rs)",
};

const ESCALATION_APPLIES_LABELS = {
    [ESCALATION_APPLIES_TO.RENT_ONLY]: "Rent only",
    [ESCALATION_APPLIES_TO.CAM_ONLY]: "CAM only",
    [ESCALATION_APPLIES_TO.BOTH]: "Rent + CAM",
};

/** Default values for a newly added escalation tier */
const newTier = () => ({
    _id: crypto.randomUUID(),
    intervalMonths: 12,
    type: ESCALATION_TYPES.PERCENTAGE,
    value: 5,
    label: "Annual rent escalation",
    appliesTo: ESCALATION_APPLIES_TO.RENT_ONLY,
});

// ── Sub-components ───────────────────────────────────────────────────────────

/**
 * One escalation tier row.
 * Uses a grid layout that collapses gracefully on smaller screens.
 */
function EscalationTierRow({ tier, index, onChange, onRemove, showRemove }) {
    const update = (field, value) => onChange({ ...tier, [field]: value });

    return (
        <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Tier {index + 1}
                </span>
                {showRemove && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        aria-label="Remove tier"
                    >
                        <Trash2Icon className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Row 1: label + interval */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Label</Label>
                    <Input
                        value={tier.label}
                        onChange={(e) => update("label", e.target.value)}
                        placeholder="e.g. Annual escalation"
                        className="h-8 text-sm"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-xs">Every (months)</Label>
                    <Input
                        type="number"
                        min={1}
                        max={120}
                        value={tier.intervalMonths}
                        onChange={(e) => update("intervalMonths", parseInt(e.target.value, 10) || 1)}
                        className="h-8 text-sm"
                    />
                </div>
            </div>

            {/* Row 2: type + value + appliesTo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                    <Label className="text-xs">Escalation type</Label>
                    <Select
                        value={tier.type}
                        onValueChange={(v) => update("type", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(ESCALATION_TYPE_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">
                        {tier.type === ESCALATION_TYPES.PERCENTAGE ? "Value (%)" : "Value (Rs)"}
                    </Label>
                    <Input
                        type="number"
                        step="0.01"
                        value={tier.value}
                        onChange={(e) => update("value", parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs">Applies to</Label>
                    <Select
                        value={tier.appliesTo}
                        onValueChange={(v) => update("appliesTo", v)}
                    >
                        <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {Object.entries(ESCALATION_APPLIES_LABELS).map(([val, label]) => (
                                <SelectItem key={val} value={val}>{label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Inline hint for absolute type */}
            {tier.type === ESCALATION_TYPES.ABSOLUTE && (
                <p className="text-xs text-amber-600">
                    Absolute: this value replaces the total rent entirely (in Rupees). Use only for
                    fixed-amount lease renewals.
                </p>
            )}
        </div>
    );
}

/**
 * Read-only preview of the full schedule. Helps the admin spot errors
 * before saving — same pattern as FinancialTotalsDisplay.
 */
function EscalationPreview({ schedule, startDateNepali }) {
    if (!schedule || schedule.length === 0) return null;

    const typeUnit = {
        [ESCALATION_TYPES.PERCENTAGE]: "%",
        [ESCALATION_TYPES.FIXED_AMOUNT]: " Rs fixed",
        [ESCALATION_TYPES.FIXED_PER_SQFT]: " Rs/sqft",
        [ESCALATION_TYPES.ABSOLUTE]: " Rs (absolute)",
    };

    return (
        <div className="rounded-lg border bg-blue-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-blue-900">Schedule preview</p>
            {schedule.map((tier, i) => (
                <div key={tier._id} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0 font-medium text-blue-700 w-12">Tier {i + 1}</span>
                    <span className="text-gray-700">
                        +{tier.value}{typeUnit[tier.type]} on{" "}
                        <strong>{ESCALATION_APPLIES_LABELS[tier.appliesTo]}</strong> every{" "}
                        <strong>{tier.intervalMonths} months</strong>
                        {startDateNepali && i === 0 && (
                            <span className="text-gray-400"> starting {startDateNepali} (BS)</span>
                        )}
                        {tier.label && <span className="text-gray-400"> — "{tier.label}"</span>}
                    </span>
                </div>
            ))}
        </div>
    );
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * @param {{ formik: import("formik").FormikProps<any> }} props
 */
export function EscalationSection({ formik }) {
    const enabled = formik.values.escalationEnabled ?? false;
    const schedule = formik.values.escalationSchedule ?? [];

    const setEnabled = (val) => {
        formik.setFieldValue("escalationEnabled", val);
        // Auto-seed one tier when the user first enables escalation
        if (val && schedule.length === 0) {
            formik.setFieldValue("escalationSchedule", [newTier()]);
        }
    };

    const setSchedule = (updated) => formik.setFieldValue("escalationSchedule", updated);

    const handleTierChange = (index, updatedTier) => {
        const next = [...schedule];
        next[index] = updatedTier;
        setSchedule(next);
    };

    const handleAddTier = () => setSchedule([...schedule, newTier()]);

    const handleRemoveTier = (index) => {
        setSchedule(schedule.filter((_, i) => i !== index));
    };

    const handleDateChange = (adDate, bsDate) => {
        formik.setFieldValue("escalationStartDate", adDate ?? "");
        formik.setFieldValue("escalationStartDateNepali", bsDate ?? "");
    };

    return (
        <div className="border rounded-lg overflow-hidden">
            {/* ── Toggle header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-4 py-3 bg-white">
                <div className="flex items-center gap-2.5">
                    <TrendingUpIcon className="w-4 h-4 text-gray-500" />
                    <div>
                        <p className="text-sm font-semibold text-gray-800">Rent Escalation</p>
                        <p className="text-xs text-gray-500">
                            {enabled
                                ? `${schedule.length} tier${schedule.length !== 1 ? "s" : ""} configured`
                                : "Optional — enable to schedule automatic increases"}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{enabled ? "On" : "Off"}</span>
                    <Switch
                        checked={enabled}
                        onCheckedChange={setEnabled}
                        aria-label="Enable rent escalation"
                    />
                </div>
            </div>

            {/* ── Expanded body ─────────────────────────────────────────────── */}
            {enabled && (
                <div className="border-t px-4 py-4 space-y-4 bg-white">
                    {/* Start date — optional, defaults to lease start on the backend */}
                    <div className="space-y-1.5">
                        <Label className="text-sm">
                            Escalation start date
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                                (optional — defaults to lease start date)
                            </span>
                        </Label>
                        <DualCalendarTailwind
                            value={formik.values.escalationStartDate}
                            onChange={handleDateChange}
                        />
                    </div>

                    {/* Tiers */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-sm">Escalation schedule</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleAddTier}
                                className="h-7 px-2.5 text-xs gap-1"
                            >
                                <PlusIcon className="w-3 h-3" />
                                Add tier
                            </Button>
                        </div>

                        {schedule.length === 0 && (
                            <p className="text-sm text-muted-foreground py-2 text-center">
                                No tiers yet — click "Add tier" to get started.
                            </p>
                        )}

                        <div className="space-y-2">
                            {schedule.map((tier, index) => (
                                <EscalationTierRow
                                    key={tier._id}
                                    tier={tier}
                                    index={index}
                                    onChange={(updated) => handleTierChange(index, updated)}
                                    onRemove={() => handleRemoveTier(index)}
                                    showRemove={schedule.length > 1}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <EscalationPreview
                        schedule={schedule}
                        startDateNepali={formik.values.escalationStartDateNepali}
                    />
                </div>
            )}
        </div>
    );
}