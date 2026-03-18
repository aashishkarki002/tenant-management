/**
 * EntityCard.jsx
 *
 * Displays a single OwnershipEntity with its key fields.
 * Shows how many blocks are assigned to it.
 *
 * Props:
 *   entity        OwnershipEntity
 *   blockCount    number   (blocks assigned to this entity)
 *   onEdit        () => void
 */

import { Building2, Mail, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";
import { EntityBadge } from "./EntityBadge";

export function EntityCard({ entity, blockCount = 0, onEdit }) {
    const isCompany = entity.type === "company";

    return (
        <div className="flex flex-col rounded-xl border border-border bg-card hover:border-muted-foreground/40 transition-colors overflow-hidden">
            {/* Header stripe */}
            <div className={`h-1 w-full ${isCompany ? "bg-sky-400" : "bg-emerald-400"}`} />

            <div className="px-4 py-4 flex flex-col gap-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0
              ${isCompany ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                            {entity.chartOfAccountsPrefix || (isCompany ? "CO" : "PVT")}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{entity.name}</p>
                            {entity.pan && (
                                <p className="text-[11px] text-muted-foreground font-mono">PAN {entity.pan}</p>
                            )}
                        </div>
                    </div>
                    <EntityBadge type={entity.type} />
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    {entity.contactEmail && (
                        <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />{entity.contactEmail}
                        </span>
                    )}
                    {isCompany && entity.vatNumber && (
                        <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />VAT {entity.vatNumber}
                        </span>
                    )}
                    {isCompany && entity.registrationNo && (
                        <span className="flex items-center gap-1 font-mono">
                            Reg. {entity.registrationNo}
                        </span>
                    )}
                </div>

                {/* Address */}
                {entity.address?.city && (
                    <p className="text-[11px] text-muted-foreground">
                        {[entity.address.street, entity.address.city, entity.address.district, entity.address.province]
                            .filter(Boolean).join(", ")}
                    </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Building2 className="w-3 h-3" />
                        <span>{blockCount} building{blockCount !== 1 ? "s" : ""} assigned</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-[11px]" onClick={onEdit}>
                        <Pencil className="w-3 h-3" />Edit
                    </Button>
                </div>
            </div>
        </div>
    );
}