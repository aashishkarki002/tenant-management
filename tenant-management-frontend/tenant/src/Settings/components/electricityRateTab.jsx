import { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon, PlusIcon, ClockIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";
import api from "../../../plugins/axios";
import { METER_TYPE_META } from "./constants";
import RateFormDialog from "./RateFormDialog";

// All four meter types that can have per-type rate overrides,
// ordered from most common (unit tenant billing) to infrastructure.
const PER_TYPE_FIELDS = [
    { key: "unit", label: "Unit (Tenant)", meta: METER_TYPE_META.unit },
    { key: "common_area", label: "Common Area", meta: METER_TYPE_META.common_area },
    { key: "parking", label: "Parking", meta: METER_TYPE_META.parking },
    { key: "sub_meter", label: "Sub-Meter", meta: METER_TYPE_META.sub_meter },
];

function ElectricityRateTab({ propertyId }) {
    const [rateData, setRateData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);

    const loadRate = useCallback(async () => {
        if (!propertyId) return;
        setLoading(true);
        try {
            const res = await api.get(`/api/electricity/rate/${propertyId}`);
            if (res.data.success) setRateData(res.data.data);
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to load rate config");
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => {
        loadRate();
    }, [loadRate]);

    // True if at least one per-type override is set (including "unit")
    const hasAnyOverride = PER_TYPE_FIELDS.some(
        ({ key }) => rateData?.meterTypeRates?.[key] != null,
    );

    return (
        <div className="mt-4">

            {/* ── Current rate card ─────────────────────────────────────────── */}
            <div className="space-y-5">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ZapIcon className="w-4 h-4 text-blue-500" />
                                Electricity Rate
                            </CardTitle>
                            <Button
                                onClick={() => setDialogOpen(true)}
                                className="flex items-center gap-2  text-white h-9 px-4 text-sm"
                            >
                                <PlusCircleIcon className="w-4 h-4" />
                                {rateData?.configured ? "Update Rate" : "Set Rate"}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {!rateData?.configured ? (
                            /* Not configured yet */
                            <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl">
                                <ZapIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">No rate configured yet</p>
                                <p className="text-sm text-gray-400 mt-1 mb-4">
                                    Set a rate before recording electricity readings
                                </p>
                                <Button
                                    onClick={() => setDialogOpen(true)}
                                    variant="outline"
                                    className="gap-2"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    Set Rate Now
                                </Button>
                            </div>
                        ) : (
                            /* Configured — show default rate + per-type breakdown */
                            <div className="space-y-4">
                                {/* Default rate hero */}
                                <div className="flex items-center gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                                    <div className="p-3 bg-blue-100 rounded-xl">
                                        <ZapIcon className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-blue-500 font-medium uppercase tracking-wide mb-0.5">
                                            Default Rate (fallback for all meter types)
                                        </p>
                                        <p className="text-3xl font-bold text-blue-700">
                                            Rs {rateData.currentRatePerUnit?.toFixed(2)}
                                            <span className="text-base font-normal text-blue-400 ml-1">/ kWh</span>
                                        </p>
                                    </div>
                                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                        Active
                                    </span>
                                </div>

                                {/* Per-type overrides grid — 2 columns to fit all four types */}
                                {hasAnyOverride && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                            Per-Type Overrides
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {PER_TYPE_FIELDS.map(({ key, label, meta }) => {
                                                const override = rateData.meterTypeRates?.[key];
                                                const Icon = meta.icon;
                                                return (
                                                    <div
                                                        key={key}
                                                        className={`p-3 rounded-xl border ${meta.border} ${meta.bg}`}
                                                    >
                                                        <div className={`flex items-center gap-1.5 text-xs font-medium mb-1.5 ${meta.text}`}>
                                                            <Icon className="w-3.5 h-3.5" />
                                                            {label}
                                                        </div>
                                                        <p className={`text-lg font-bold ${meta.text}`}>
                                                            {override != null
                                                                ? `Rs ${override.toFixed(2)}`
                                                                : <span className="text-gray-400 text-sm font-normal">Default</span>}
                                                        </p>
                                                        {override != null && (
                                                            <p className="text-xs text-gray-400 mt-0.5">/ kWh</p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Rate history */}
                {rateData?.rateHistory?.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <ClockIcon className="w-4 h-4 text-gray-400" />
                                Rate History
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {[...rateData.rateHistory].reverse().map((r) => (
                                    <div
                                        key={r._id}
                                        className="flex items-center justify-between p-2 border-b border-gray-100 last:border-0"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm text-gray-500">
                                                {new Date(r.updatedAt).toLocaleDateString()}
                                            </span>
                                            {r.note && (
                                                <span className="text-xs text-gray-400 italic">
                                                    ({r.note})
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
                                            <span className="font-medium text-gray-700">
                                                Rs {r.ratePerUnit.toFixed(2)}
                                            </span>
                                            {r.meterTypeRates &&
                                                Object.entries(r.meterTypeRates)
                                                    .filter(([, val]) => val != null)
                                                    .map(([type, val]) => {
                                                        const meta = METER_TYPE_META[type];
                                                        if (!meta) return null;
                                                        return (
                                                            <span
                                                                key={type}
                                                                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badge}`}
                                                            >
                                                                {meta.label}: Rs {(val / 100).toFixed(2)}
                                                            </span>
                                                        );
                                                    })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* ── Dialog ──────────────────────────────────────────────────────── */}
            {dialogOpen && (
                <RateFormDialog
                    propertyId={propertyId}
                    rateData={rateData}
                    onClose={() => setDialogOpen(false)}
                    onSaved={loadRate}
                />
            )}
        </div>
    );
}

export default ElectricityRateTab;