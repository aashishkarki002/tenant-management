import { Zap, BarChart3, Fuel, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FuelGauge } from "../shared/FuelGauge";
import { Pill } from "../shared/Pill";
import { StatusDot } from "../shared/StatusDot";
import { GEN_STATUS_STYLE } from "../constants/constant";

/**
 * GeneratorCardHeader
 *
 * Props:
 *   gen            {object}
 *   onCheckClick   {()=>void}
 *   onRefillClick  {()=>void}
 *   onServiceClick {()=>void}
 *   expandToggle   {ReactNode}  — the chevron button rendered by the card
 */
export function GeneratorCardHeader({ gen, onCheckClick, onRefillClick, onServiceClick, expandToggle }) {
    const statusStyle = GEN_STATUS_STYLE[gen.status] || GEN_STATUS_STYLE.IDLE;
    const fuelPct = gen.currentFuelPercent ?? 0;

    return (
        <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-4 flex-wrap sm:flex-nowrap">
            {/* Icon */}
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusStyle.pill}`}>
                <Zap className="w-4 h-4" />
            </div>

            {/* Name + meta */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm text-gray-900 truncate">{gen.name}</h3>
                    <Pill className={statusStyle.pill}>
                        <StatusDot status={gen.status} />
                        {gen.status?.replace(/_/g, " ")}
                    </Pill>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-400">
                    {gen.model && <span>{gen.model}</span>}
                    {gen.capacityKva && <span>{gen.capacityKva} kVA</span>}
                    {gen.fuelType && <span>{gen.fuelType}</span>}
                    {gen.tankCapacityLiters && <span>Tank {gen.tankCapacityLiters}L</span>}
                    {gen.serialNumber && <span>S/N {gen.serialNumber}</span>}
                    {gen.property?.name && <span>{gen.property.name}</span>}
                </div>
            </div>

            {/* Gauge */}
            <FuelGauge pct={fuelPct} size={80} />

            {/* Action buttons */}
            <div className="flex sm:flex-col gap-1.5 shrink-0">
                <Button size="sm" variant="outline" onClick={onCheckClick}
                    className="text-xs h-7 gap-1 border-blue-200 text-blue-600 hover:bg-blue-50 px-2">
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Check</span>
                </Button>
                <Button size="sm" variant="outline" onClick={onRefillClick}
                    className="text-xs h-7 gap-1 border-orange-200 text-orange-600 hover:bg-orange-50 px-2">
                    <Fuel className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Refill</span>
                </Button>
                <Button size="sm" variant="outline" onClick={onServiceClick}
                    className="text-xs h-7 gap-1 border-purple-200 text-purple-600 hover:bg-purple-50 px-2">
                    <Wrench className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Service</span>
                </Button>
            </div>

            {expandToggle}
        </div>
    );
}