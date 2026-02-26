import { Plus, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "../shared/Pill";
import { CHECK_STATUS_STYLE, fmt } from "../constants/constant";

// ─── Tab helpers ──────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
    return (
        <div className="flex border-b border-gray-100 bg-gray-50 overflow-x-auto">
            {tabs.map(t => (
                <button key={t.key} onClick={() => onChange(t.key)}
                    className={`flex-1 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors whitespace-nowrap px-3
                        ${active === t.key
                            ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                            : "text-gray-400 hover:text-gray-600"}`}>
                    {t.label}
                </button>
            ))}
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ gen, checks, services }) {
    const last7Checks = [...checks].reverse().slice(-7);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Fuel trend */}
            <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2">
                    Fuel Trend (last {Math.min(last7Checks.length, 7)} checks)
                </p>
                {last7Checks.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No checks yet</p>
                ) : (
                    <div className="flex items-end gap-1.5 h-14">
                        {last7Checks.map((c, i) => {
                            const p = c.fuelPercent ?? 0;
                            const color =
                                p <= (gen.criticalFuelThresholdPercent ?? 10) ? "bg-red-500"
                                    : p <= (gen.lowFuelThresholdPercent ?? 20) ? "bg-amber-400"
                                        : "bg-green-500";
                            return (
                                <div key={i} title={`${p}% — ${fmt.date(c.date)}`}
                                    className="flex-1 flex flex-col items-center gap-0.5 group cursor-default">
                                    <span className="text-[8px] text-gray-400 group-hover:text-gray-600">{p}%</span>
                                    <div className={`w-full rounded-t ${color}`}
                                        style={{ height: `${Math.max(4, (p / 100) * 40)}px` }} />
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
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-0.5">
                        <p className="text-sm font-semibold text-purple-800">{services[0].type}</p>
                        <p className="text-xs text-purple-600">{fmt.date(services[0].date)}</p>
                        {services[0].technician && (
                            <p className="text-xs text-purple-500">Tech: {services[0].technician}</p>
                        )}
                        {services[0].costPaisa > 0 && (
                            <p className="text-xs text-purple-500">Cost: {fmt.rupees(services[0].costPaisa)}</p>
                        )}
                        {services[0].nextServiceDate && (
                            <p className="text-xs text-purple-400">Next: {fmt.date(services[0].nextServiceDate)}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Checks Tab ───────────────────────────────────────────────────────────────

function ChecksTab({ gen, checks, onAddCheck }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-gray-600">Daily Check Log</p>
                <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
                    onClick={onAddCheck}>
                    <Plus className="w-3.5 h-3.5" /> Add
                </Button>
            </div>
            {checks.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">No checks recorded yet</p>
            ) : (
                <div className="space-y-2">
                    {checks.map((c, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 bg-gray-50/60">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold
                                ${(c.fuelPercent ?? 0) <= (gen.criticalFuelThresholdPercent ?? 10) ? "bg-red-100 text-red-600"
                                    : (c.fuelPercent ?? 0) <= (gen.lowFuelThresholdPercent ?? 20) ? "bg-amber-100 text-amber-700"
                                        : "bg-green-100 text-green-700"}`}>
                                {c.fuelPercent ?? 0}%
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
                                {c.notes && <p className="text-xs text-gray-500 mt-0.5 truncate">{c.notes}</p>}
                            </div>
                            <p className="text-[10px] text-gray-400 shrink-0">{fmt.time(c.date)}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Refills Tab ──────────────────────────────────────────────────────────────

function RefillsTab({ refills, onAddRefill }) {
    return (
        <div>
            <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-gray-600">Fuel Refill Log</p>
                <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1"
                    onClick={onAddRefill}>
                    <Plus className="w-3.5 h-3.5" /> Add
                </Button>
            </div>
            {refills.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">No refills recorded yet</p>
            ) : (
                <div className="space-y-2">
                    {refills.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-orange-100 p-2.5 bg-orange-50/30">
                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                                <span className="text-xs font-bold text-orange-600">{r.litersAdded}L</span>
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
                                    {/* Expense linked badge */}
                                    {r.costPaisa > 0 && (
                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">
                                            ✦ Expense posted
                                        </span>
                                    )}
                                </div>
                                {r.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{r.notes}</p>}
                            </div>
                            <p className="text-[10px] text-gray-400 shrink-0">{fmt.time(r.date)}</p>
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
            <div className="flex justify-between items-center mb-3">
                <p className="text-xs font-semibold text-gray-600">Service History</p>
                <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white gap-1"
                    onClick={onAddService}>
                    <Plus className="w-3.5 h-3.5" /> Add
                </Button>
            </div>
            {services.length === 0 ? (
                <p className="text-xs text-gray-400 italic text-center py-8">No service records yet</p>
            ) : (
                <div className="space-y-2">
                    {services.map((s, i) => (
                        <div key={i} className="rounded-lg border border-gray-200 p-3 bg-white">
                            <div className="flex items-start gap-2 flex-wrap">
                                <div className="flex-1 min-w-0">
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
                                    {s.description && <p className="text-xs text-gray-600 mt-0.5">{s.description}</p>}
                                    <div className="flex gap-3 mt-1 flex-wrap text-xs text-gray-400">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />{fmt.date(s.date)}
                                        </span>
                                        {s.technician && <span>Tech: {s.technician}</span>}
                                        {s.nextServiceDate && <span>Next: {fmt.date(s.nextServiceDate)}</span>}
                                        {s.nextServiceHours && <span>Next at {s.nextServiceHours} hrs</span>}
                                    </div>
                                    {s.notes && <p className="text-xs text-gray-400 mt-1 italic">{s.notes}</p>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── GenaratorCardDetail (main export) ───────────────────────────────────────

/**
 * Props:
 *   gen           {object}
 *   tab           {string}          — "overview" | "checks" | "refills" | "services"
 *   onTabChange   {(key)=>void}
 *   onAddCheck    {()=>void}
 *   onAddRefill   {()=>void}
 *   onAddService  {()=>void}
 */
export function GeneratorCardDetail({ gen, tab, onTabChange, onAddCheck, onAddRefill, onAddService }) {
    // Newest-first slices — display only, no business logic
    const checks = [...(gen.dailyChecks || [])].reverse().slice(0, 15);
    const refills = [...(gen.fuelRefills || [])].reverse().slice(0, 15);
    const services = [...(gen.serviceLogs || [])].reverse().slice(0, 15);

    const tabs = [
        { key: "overview", label: "Overview" },
        { key: "checks", label: `Checks (${gen.dailyChecks?.length ?? 0})` },
        { key: "refills", label: `Refills (${gen.fuelRefills?.length ?? 0})` },
        { key: "services", label: `Services (${gen.serviceLogs?.length ?? 0})` },
    ];

    return (
        <div className="border-t border-gray-200">
            <TabBar tabs={tabs} active={tab} onChange={onTabChange} />

            <div className="p-4 space-y-3">
                {tab === "overview" && (
                    <OverviewTab gen={gen} checks={checks} services={services} />
                )}
                {tab === "checks" && (
                    <ChecksTab gen={gen} checks={checks} onAddCheck={onAddCheck} />
                )}
                {tab === "refills" && (
                    <RefillsTab refills={refills} onAddRefill={onAddRefill} />
                )}
                {tab === "services" && (
                    <ServicesTab services={services} onAddService={onAddService} />
                )}
            </div>
        </div>
    );
}