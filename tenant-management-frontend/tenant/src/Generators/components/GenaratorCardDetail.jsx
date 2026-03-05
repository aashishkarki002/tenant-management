import { useState, useEffect, useCallback } from "react";
import { Plus, Calendar, Zap, TrendingDown, AlertCircle } from "lucide-react";
import { Pill } from "../shared/Pill";
import { CHECK_STATUS_STYLE, fmt } from "../constants/constant";
import api from "../../../plugins/axios";

// ─── Shared sub-components ────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
    return (
        <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {tabs.map(t => (
                <button key={t.key} onClick={() => onChange(t.key)}
                    className={`shrink-0 flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wide transition-colors whitespace-nowrap px-3 min-w-[72px]
                        ${active === t.key
                            ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                            : "text-gray-400 hover:text-gray-600"}`}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

function SectionHeader({ title, onAdd, btnColor }) {
    return (
        <div className="flex justify-between items-center mb-3">
            <p className="text-xs font-semibold text-gray-600">{title}</p>
            {onAdd && (
                <button onClick={onAdd}
                    className={`flex items-center gap-1 text-xs h-7 px-3 rounded-md font-semibold text-white transition-colors ${btnColor}`}>
                    <Plus className="w-3.5 h-3.5" /> Add
                </button>
            )}
        </div>
    );
}

function EmptyState({ text }) {
    return <p className="text-xs text-gray-400 italic text-center py-10">{text}</p>;
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ gen, checks, services }) {
    const last7 = [...checks].reverse().slice(-7);
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fuel trend */}
            <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
                    Fuel Trend (last {Math.min(last7.length, 7)} checks)
                </p>
                {last7.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No checks yet</p>
                ) : (
                    <div className="flex items-end gap-1 h-16 w-full">
                        {last7.map((c, i) => {
                            const p = c.fuelPercent ?? 0;
                            const color = p <= (gen.criticalFuelThresholdPercent ?? 10)
                                ? "bg-red-500"
                                : p <= (gen.lowFuelThresholdPercent ?? 20)
                                    ? "bg-amber-400"
                                    : "bg-green-500";
                            return (
                                <div key={i} title={`${p}% — ${fmt.date(c.date)}`}
                                    className="flex-1 flex flex-col items-center gap-0.5 group cursor-default min-w-0">
                                    <span className="text-[8px] text-gray-400 group-hover:text-gray-600 leading-none">{p}%</span>
                                    <div className={`w-full rounded-t ${color}`}
                                        style={{ height: `${Math.max(4, (p / 100) * 44)}px` }} />
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Latest service */}
            <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Latest Service</p>
                {services.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No service logs yet</p>
                ) : (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-0.5">
                        <p className="text-sm font-semibold text-purple-800">{services[0].type}</p>
                        <p className="text-xs text-purple-600">{fmt.date(services[0].date)}</p>
                        {services[0].technician && <p className="text-xs text-purple-500">Tech: {services[0].technician}</p>}
                        {services[0].costPaisa > 0 && <p className="text-xs text-purple-500">Cost: {fmt.rupees(services[0].costPaisa)}</p>}
                        {services[0].nextServiceDate && <p className="text-xs text-purple-400">Next: {fmt.date(services[0].nextServiceDate)}</p>}
                    </div>
                )}
            </div>

            {/* Sub-meter info */}
            {gen.subMeter && (
                <div className="col-span-full">
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">Grid Sub-Meter</p>
                    <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                        <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-yellow-800">{gen.subMeter.name}</p>
                            <p className="text-[10px] text-yellow-600 mt-0.5">
                                Last reading: {gen.subMeter.lastReading?.value != null
                                    ? `${gen.subMeter.lastReading.value} kWh`
                                    : "No readings yet"}
                                {gen.subMeter.lastReading?.readingDate && (
                                    <> · {fmt.date(gen.subMeter.lastReading.readingDate)}</>
                                )}
                            </p>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                            ${gen.subMeter.isActive
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                            {gen.subMeter.isActive ? "Active" : "Inactive"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Checks Tab ───────────────────────────────────────────────────────────────

function ChecksTab({ gen, checks, onAddCheck }) {
    return (
        <div>
            <SectionHeader title="Daily Check Log" onAdd={onAddCheck}
                btnColor="bg-blue-600 hover:bg-blue-700 active:bg-blue-800" />
            {checks.length === 0 ? <EmptyState text="No checks recorded yet" /> : (
                <div className="space-y-2">
                    {checks.map((c, i) => {
                        const pct = c.fuelPercent ?? 0;
                        const circleColor = pct <= (gen.criticalFuelThresholdPercent ?? 10)
                            ? "bg-red-100 text-red-600"
                            : pct <= (gen.lowFuelThresholdPercent ?? 20)
                                ? "bg-amber-100 text-amber-700"
                                : "bg-green-100 text-green-700";
                        return (
                            <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 bg-gray-50/60">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${circleColor}`}>
                                    {pct}%
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex gap-1.5 items-center flex-wrap">
                                        {c.status && (
                                            <Pill className={CHECK_STATUS_STYLE[c.status] || CHECK_STATUS_STYLE.NORMAL}>
                                                {c.status.replace(/_/g, " ")}
                                            </Pill>
                                        )}
                                        {c.runningHours != null && (
                                            <span className="text-[11px] text-gray-400">{c.runningHours} hrs</span>
                                        )}
                                        {c.checkedBy?.name && (
                                            <span className="text-[11px] text-gray-400">by {c.checkedBy.name}</span>
                                        )}
                                    </div>
                                    {c.notes && <p className="text-xs text-gray-500 mt-1 leading-snug">{c.notes}</p>}
                                    <p className="text-[10px] text-gray-400 mt-1">{fmt.time(c.date)}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Refills Tab ──────────────────────────────────────────────────────────────

function RefillsTab({ refills, onAddRefill }) {
    return (
        <div>
            <SectionHeader title="Fuel Refill Log" onAdd={onAddRefill}
                btnColor="bg-orange-500 hover:bg-orange-600 active:bg-orange-700" />
            {refills.length === 0 ? <EmptyState text="No refills recorded yet" /> : (
                <div className="space-y-2">
                    {refills.map((r, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl border border-orange-100 p-3 bg-orange-50/30">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-orange-600 leading-none">{r.litersAdded}L</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex gap-2 flex-wrap items-center">
                                    {r.fuelLevelAfterPercent != null && (
                                        <span className="text-xs text-gray-600">→ {r.fuelLevelAfterPercent}% after</span>
                                    )}
                                    {r.costPaisa > 0 && (
                                        <span className="text-xs font-semibold text-gray-700">{fmt.rupees(r.costPaisa)}</span>
                                    )}
                                    {r.supplier && <span className="text-xs text-gray-500">{r.supplier}</span>}
                                    {r.invoiceRef && <span className="text-xs text-gray-400">#{r.invoiceRef}</span>}
                                    {r.costPaisa > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                            ✦ Expense posted
                                        </span>
                                    )}
                                </div>
                                {r.notes && <p className="text-xs text-gray-400 mt-1 leading-snug">{r.notes}</p>}
                                <p className="text-[10px] text-gray-400 mt-1">{fmt.time(r.date)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({ services, onAddService }) {
    return (
        <div>
            <SectionHeader title="Service History" onAdd={onAddService}
                btnColor="bg-purple-600 hover:bg-purple-700 active:bg-purple-800" />
            {services.length === 0 ? <EmptyState text="No service records yet" /> : (
                <div className="space-y-2">
                    {services.map((s, i) => (
                        <div key={i} className="rounded-xl border border-gray-200 p-3 bg-white">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-semibold text-gray-800">{s.type}</p>
                                {s.costPaisa > 0 && (
                                    <span className="text-xs font-medium text-gray-500">{fmt.rupees(s.costPaisa)}</span>
                                )}
                                {s.costPaisa > 0 && (
                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                        ✦ Expense posted
                                    </span>
                                )}
                            </div>
                            {s.description && <p className="text-xs text-gray-600 mt-1 leading-snug">{s.description}</p>}
                            <div className="flex gap-x-3 gap-y-0.5 mt-1.5 flex-wrap text-xs text-gray-400">
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmt.date(s.date)}</span>
                                {s.technician && <span>Tech: {s.technician}</span>}
                                {s.nextServiceDate && <span>Next: {fmt.date(s.nextServiceDate)}</span>}
                                {s.nextServiceHours && <span>Next at {s.nextServiceHours} hrs</span>}
                            </div>
                            {s.notes && <p className="text-xs text-gray-400 mt-1 italic leading-snug">{s.notes}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Electricity Tab ──────────────────────────────────────────────────────────
// Fetched lazily on first open — follows the "load on demand" pattern to avoid
// over-fetching on cards the user never expands.

function ElectricityTab({ gen }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchReadings = useCallback(async () => {
        if (!gen.subMeter) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.get(`/api/maintenance/generator/${gen._id}/electricity`);
            setData(res.data);
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to load electricity data");
        } finally {
            setLoading(false);
        }
    }, [gen._id, gen.subMeter]);

    useEffect(() => { fetchReadings(); }, [fetchReadings]);

    if (!gen.subMeter) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <AlertCircle className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-xs text-gray-400 font-medium">No sub-meter linked</p>
                <p className="text-[11px] text-gray-400 mt-1">This generator was created before sub-meter auto-provisioning was enabled.</p>
            </div>
        );
    }

    if (loading) {
        return <p className="text-xs text-gray-400 text-center py-10 animate-pulse">Loading electricity readings…</p>;
    }

    if (error) {
        return (
            <div className="text-center py-8">
                <p className="text-xs text-red-500 mb-2">{error}</p>
                <button onClick={fetchReadings}
                    className="text-xs text-blue-600 underline">Retry</button>
            </div>
        );
    }

    const readings = data?.data?.readings ?? [];
    const summary = data?.data?.summary ?? {};

    // Summary strip
    const totalUnits = summary.totalUnits ?? readings.reduce((s, r) => s + (r.consumption ?? 0), 0);
    const totalAmount = summary.totalAmount ?? readings.reduce((s, r) => s + (r.totalAmount ?? 0), 0);

    return (
        <div>
            <SectionHeader title="Grid Electricity Readings" />

            {/* Summary strip */}
            {readings.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                        { label: "Readings", value: readings.length },
                        { label: "Total Units", value: `${totalUnits.toFixed(1)} kWh` },
                        { label: "Total Cost", value: fmt.rupees(totalAmount * 100) },
                    ].map(({ label, value }) => (
                        <div key={label} className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
                            <p className="text-[9px] uppercase tracking-widest text-yellow-600 font-semibold">{label}</p>
                            <p className="text-xs font-bold text-yellow-800 mt-0.5">{value}</p>
                        </div>
                    ))}
                </div>
            )}

            {readings.length === 0 ? (
                <EmptyState text="No electricity readings yet. Add one via Daily Check." />
            ) : (
                <div className="space-y-2">
                    {[...readings].reverse().slice(0, 15).map((r, i) => (
                        <div key={i} className="flex items-start gap-3 rounded-xl border border-yellow-100 p-3 bg-yellow-50/30">
                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center shrink-0">
                                <Zap className="w-4 h-4 text-yellow-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex gap-2 flex-wrap items-center">
                                    <span className="text-xs font-semibold text-gray-700">
                                        {r.currentReading} kWh
                                    </span>
                                    {r.consumption != null && (
                                        <span className="flex items-center gap-0.5 text-xs text-gray-500">
                                            <TrendingDown className="w-3 h-3" />
                                            {r.consumption} units used
                                        </span>
                                    )}
                                    {r.totalAmount > 0 && (
                                        <span className="text-xs font-medium text-yellow-700">
                                            {fmt.rupees(r.totalAmount * 100)}
                                        </span>
                                    )}
                                    {r.status && (
                                        <Pill className={
                                            r.status === "paid" ? "bg-green-50 text-green-700 border-green-200"
                                                : r.status === "cancelled" ? "bg-gray-100 text-gray-400 border-gray-200"
                                                    : "bg-blue-50 text-blue-600 border-blue-200"
                                        }>{r.status}</Pill>
                                    )}
                                </div>
                                {r.notes && <p className="text-xs text-gray-400 mt-1 leading-snug">{r.notes}</p>}
                                <p className="text-[10px] text-gray-400 mt-1">{fmt.time(r.readingDate)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function GeneratorCardDetail({ gen, tab, onTabChange, onAddCheck, onAddRefill, onAddService }) {
    const checks = [...(gen.dailyChecks || [])].reverse().slice(0, 15);
    const refills = [...(gen.fuelRefills || [])].reverse().slice(0, 15);
    const services = [...(gen.serviceLogs || [])].reverse().slice(0, 15);

    const tabs = [
        { key: "overview", label: "Overview" },
        { key: "checks", label: `Checks (${gen.dailyChecks?.length ?? 0})` },
        { key: "refills", label: `Refills (${gen.fuelRefills?.length ?? 0})` },
        { key: "services", label: `Services (${gen.serviceLogs?.length ?? 0})` },
        // Only show Electricity tab when a sub-meter is provisioned
        ...(gen.subMeter ? [{ key: "electricity", label: "⚡ Grid" }] : []),
    ];

    return (
        <div className="border-t border-gray-200">
            <TabBar tabs={tabs} active={tab} onChange={onTabChange} />
            <div className="p-3 sm:p-4 space-y-3">
                {tab === "overview" && <OverviewTab gen={gen} checks={checks} services={services} />}
                {tab === "checks" && <ChecksTab gen={gen} checks={checks} onAddCheck={onAddCheck} />}
                {tab === "refills" && <RefillsTab refills={refills} onAddRefill={onAddRefill} />}
                {tab === "services" && <ServicesTab services={services} onAddService={onAddService} />}
                {tab === "electricity" && <ElectricityTab gen={gen} />}
            </div>
        </div>
    );
}