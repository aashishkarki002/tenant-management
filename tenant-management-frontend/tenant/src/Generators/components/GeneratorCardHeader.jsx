import { Zap, BarChart3, Fuel, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FuelGauge } from "../shared/FuelGauge";
import { Pill } from "../shared/Pill";
import { StatusDot } from "../shared/StatusDot";
import { GEN_STATUS_STYLE } from "../constants/constant";



export function GeneratorCardHeader({ gen, onCheckClick, onRefillClick, onServiceClick, expandToggle }) {
    const statusStyle = GEN_STATUS_STYLE[gen.status] || GEN_STATUS_STYLE.IDLE;
    const fuelPct = gen.currentFuelPercent ?? 0;

    const metaChips = [
        gen.model,
        gen.capacityKva ? `${gen.capacityKva} kVA` : null,
        gen.fuelType,
        gen.tankCapacityLiters ? `Tank ${gen.tankCapacityLiters}L` : null,
        gen.serialNumber ? `S/N ${gen.serialNumber}` : null,
        gen.property?.name,
        // Show sub-meter linkage status — useful for ops team to confirm metering
        gen.subMeter ? ` ${gen.subMeter.name ?? "Sub-meter linked"}` : " No sub-meter",
    ].filter(Boolean);

    return (
        <div className="px-3 py-3 sm:px-5 sm:py-4">

            {/* Top row: always visible */}
            <div className="flex items-center gap-2.5 sm:gap-3">

                {/* Status icon */}
                <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0 ${statusStyle.pill}`}>
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>

                {/* Name + pill + (desktop) meta */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-text-strong truncate leading-tight">{gen.name}</h3>
                        <Pill className={statusStyle.pill}>
                            <StatusDot status={gen.status} />
                            {gen.status?.replace(/_/g, " ")}
                        </Pill>
                    </div>
                    {/* Meta: desktop only */}
                    {metaChips.length > 0 && (
                        <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
                            {metaChips.map((chip, i) => <span key={i}>{chip}</span>)}
                        </div>
                    )}
                </div>

                {/* Desktop: gauge + 3 action buttons column */}
                <div className="hidden sm:flex items-center gap-3">
                    <FuelGauge pct={fuelPct} size={76} />
                    <div className="flex flex-col gap-1.5">
                        {[
                            { label: "Check", icon: <BarChart3 className="w-3.5 h-3.5" />, onClick: onCheckClick, cls: "border-blue-200 text-blue-600 hover:bg-blue-50 active:bg-blue-100" },
                            { label: "Refill", icon: <Fuel className="w-3.5 h-3.5" />, onClick: onRefillClick, cls: "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100" },
                            { label: "Service", icon: <Wrench className="w-3.5 h-3.5" />, onClick: onServiceClick, cls: "border-purple-200 text-purple-600 hover:bg-purple-50 active:bg-purple-100" },
                        ].map(({ label, icon, onClick, cls }) => (
                            <button key={label} onClick={onClick}
                                className={`flex items-center gap-1.5 text-xs h-7 px-2.5 rounded-md border transition-colors font-medium ${cls}`}>
                                {icon} {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Expand chevron */}
                {expandToggle}
            </div>

            {/* Mobile: meta chips */}
            {metaChips.length > 0 && (
                <div className="flex sm:hidden flex-wrap gap-x-2.5 gap-y-0.5 mt-1.5 pl-[42px] text-[11px] text-gray-400">
                    {metaChips.map((chip, i) => <span key={i}>{chip}</span>)}
                </div>
            )}

            {/* Mobile: gauge + 3 action buttons row */}
            <div className="flex sm:hidden items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <FuelGauge pct={fuelPct} size={70} />
                <div className="flex gap-2 flex-1">
                    {[
                        { label: "Check", icon: <BarChart3 className="w-4 h-4" />, onClick: onCheckClick, cls: "border-blue-200 text-blue-600 hover:bg-blue-50 active:bg-blue-100" },
                        { label: "Refill", icon: <Fuel className="w-4 h-4" />, onClick: onRefillClick, cls: "border-orange-200 text-orange-600 hover:bg-orange-50 active:bg-orange-100" },
                        { label: "Service", icon: <Wrench className="w-4 h-4" />, onClick: onServiceClick, cls: "border-purple-200 text-purple-600 hover:bg-purple-50 active:bg-purple-100" },
                    ].map(({ label, icon, onClick, cls }) => (
                        <button key={label} onClick={onClick}
                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-colors ${cls}`}>
                            {icon}
                            <span className="text-[10px] font-semibold leading-none">{label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}