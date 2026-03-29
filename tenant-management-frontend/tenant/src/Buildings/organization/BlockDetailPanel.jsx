/**
 * BlockDetailPanel.jsx
 *
 * Shows expanded details for the currently selected block.
 * Appears below the block card grid.
 *
 * Props:
 *   block       Block (enriched)
 *   onClose     () => void
 *   onMigrate   () => void
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EntityBadge } from "./EntityBadge";
import { ArrowLeftRight, X } from "lucide-react";

const fmtPaisa = (p) =>
    p != null
        ? "रू " + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })
        : "—";

export function BlockDetailPanel({ block, onClose, onMigrate }) {
    const short = (block.name ?? "BL").replace(/\s+/g, "").slice(0, 2).toUpperCase();
    const totalUnits = block.totalUnits ?? block.units ?? 0;
    const occupiedUnits = block.occupiedUnits ?? block.occupied ?? 0;
    const outstanding = block.outstandingPaisa ?? 0;

    const fields = [
        { k: "Total Units", v: totalUnits },
        { k: "Occupied", v: occupiedUnits },
        { k: "Vacant", v: totalUnits - occupiedUnits },
        { k: "Active Tenants", v: block.activeTenants ?? block.tenants ?? "—" },
        { k: "Monthly Revenue", v: fmtPaisa(block.monthlyRevenuePaisa ?? block.revenuePaisa) },
        { k: "Outstanding", v: outstanding > 0 ? fmtPaisa(outstanding) : "—" },
        { k: "Entity", v: block.ownershipEntity?.name ?? "None" },
        { k: "Last Migrated", v: block.lastMigrated ?? "Never" },
    ];

    return (
        <Card className="border-border">
            <CardHeader className="pb-3 border-b border-border">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-white text-[10px] font-bold">
                            {short}
                        </div>
                        <CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider">
                            {block.name} — Detail
                        </CardTitle>
                        <EntityBadge type={block.ownershipEntity?.type ?? "private"} />
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="pt-4">
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {fields.map(({ k, v }) => (
                        <div key={k} className="rounded-lg bg-secondary border border-border px-3 py-2">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{k}</p>
                            <p className="text-xs font-bold text-foreground font-mono capitalize truncate">{v}</p>
                        </div>
                    ))}
                </div>

                {/* Migration history */}
                {block.migrationHistory?.length > 0 && (
                    <div className="mb-4">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Migration History</p>
                        <div className="space-y-1">
                            {block.migrationHistory.map((h, i) => (
                                <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground py-1.5 border-b border-border/50 last:border-0">
                                    <span className="font-mono text-[10px]">{h.migratedAt}</span>
                                    <span className="text-border">·</span>
                                    <span>→</span>
                                    <span className="font-semibold text-foreground">{h.notes || "No notes"}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer CTA */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                    <p className="text-[11px] text-muted-foreground">
                        {block.migrationHistory?.length
                            ? `${block.migrationHistory.length} prior migration(s)`
                            : "No migration history"}
                    </p>
                    <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={onMigrate}>
                        <ArrowLeftRight className="w-3.5 h-3.5" />Initiate Migration
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}