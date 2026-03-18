/**
 * BlockCard.jsx
 *
 * Displays a single Block with its entity assignment and stats.
 * Clicking selects the block; if already selected shows the "Migrate" CTA.
 *
 * Props:
 *   block       Block (enriched with .ownershipEntity)
 *   selected    boolean
 *   onSelect    () => void
 *   onMigrate   () => void
 */

import { EntityBadge } from "./EntityBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";

const fmtPaisa = (p) =>
    p != null
        ? "रू " + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })
        : "—";

export function BlockCard({ block, selected, onSelect, onMigrate }) {
    const totalUnits = block.totalUnits ?? block.units ?? 0;
    const occupiedUnits = block.occupiedUnits ?? block.occupied ?? 0;
    const occupancy = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;
    const short = (block.name ?? "BL").replace(/\s+/g, "").slice(0, 2).toUpperCase();
    const entityType = block.ownershipEntity?.type ?? "private";
    const outstanding = block.outstandingPaisa ?? 0;

    return (
        <button
            onClick={onSelect}
            className={[
                "w-full text-left rounded-xl border-2 p-5 bg-card transition-all duration-200",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                selected
                    ? "border-foreground shadow-lg scale-[1.005]"
                    : "border-border hover:border-muted-foreground/50 hover:shadow-md",
            ].join(" ")}
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                        {short}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{block.name}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            {block.floors ?? "—"} floors · {totalUnits} units
                        </p>
                    </div>
                </div>
                <EntityBadge type={entityType} />
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="rounded-lg bg-secondary px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Revenue</p>
                    <p className="text-xs font-bold text-foreground font-mono leading-tight">
                        {fmtPaisa(block.monthlyRevenuePaisa ?? block.revenuePaisa)}
                    </p>
                </div>
                <div className="rounded-lg bg-secondary px-2.5 py-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Tenants</p>
                    <p className="text-xs font-bold text-foreground font-mono">
                        {block.activeTenants ?? block.tenants ?? "—"}
                    </p>
                </div>
                <div className={`rounded-lg px-2.5 py-2 ${outstanding > 0 ? "bg-destructive/10" : "bg-secondary"}`}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Due</p>
                    <p className={`text-xs font-bold font-mono ${outstanding > 0 ? "text-destructive" : "text-foreground"}`}>
                        {outstanding > 0 ? fmtPaisa(outstanding) : "—"}
                    </p>
                </div>
            </div>

            {/* Occupancy bar */}
            <div className="mb-4">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">
                    <span>Occupancy</span>
                    <span className="font-mono">{occupiedUnits}/{totalUnits} · {occupancy}%</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-foreground rounded-full transition-all duration-700"
                        style={{ width: `${occupancy}%` }}
                    />
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-[11px] text-muted-foreground truncate">
                    {block.ownershipEntity?.name ?? "No entity assigned"}
                </p>
                {selected && (
                    <Button
                        size="sm"
                        className="h-7 text-[11px] px-3 gap-1 ml-2 shrink-0"
                        onClick={(e) => { e.stopPropagation(); onMigrate(); }}
                    >
                        <ArrowLeftRight className="w-3 h-3" />Migrate
                    </Button>
                )}
            </div>
        </button>
    );
}