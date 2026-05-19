/**
 * OrganizationTab.jsx
 *
 * The "Organization" tab in Admin Settings.
 * Owns the useOwnership hook and passes data down via props to:
 *   - EntityCard / EntityFormDialog   (entity management)
 *   - BlockCard / BlockDetailPanel    (block overview)
 *   - MigrationWizard                 (ownership migration)
 *   - Audit log row                   (via GET /api/migration/audit-log)
 *
 * Props: none — this component is fully self-contained.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import api from "../../../plugins/axios";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, RefreshCw, AlertCircle, Building2 } from "lucide-react";

import { useOwnership } from "../../Settings/hooks/useOwnership";
import { EntityBadge } from "./EntityBadge";
import { EntityCard } from "./EntityCard";
import { EntityFormDialog } from "./EntityFormDialog";
import { BlockCard } from "./BlockCard";
import { BlockDetailPanel } from "./BlockDetailPanel";
import { MigrationWizard } from "./MigrationWizard";

const fmtPaisa = (p) =>
    p != null
        ? "रू " + (p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 })
        : "—";

// ─── KPI strip ───────────────────────────────────────────────────────────────
function KpiStrip({ blocks }) {
    const totalRevenue = blocks.reduce((s, b) => s + (b.monthlyRevenuePaisa ?? b.revenuePaisa ?? 0), 0);
    const totalOutstanding = blocks.reduce((s, b) => s + (b.outstandingPaisa ?? 0), 0);
    const totalTenants = blocks.reduce((s, b) => s + (b.activeTenants ?? b.tenants ?? 0), 0);
    const hasDue = totalOutstanding > 0;

    const kpis = [
        { label: "Monthly Revenue", value: fmtPaisa(totalRevenue), sub: "All entities" },
        { label: "Outstanding", value: fmtPaisa(totalOutstanding), sub: "Across blocks", danger: hasDue },
        { label: "Total Tenants", value: totalTenants, sub: "Active leases" },
        { label: "Buildings", value: blocks.length, sub: "Registered" },
    ];

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {kpis.map((kpi) => (
                <div key={kpi.label}
                    className={`rounded-xl border px-4 py-3 bg-[var(--color-surface)] ${kpi.danger
                        ? "border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5"
                        : "border-[var(--color-border)]"}`}>
                    <p className="text-[10px] font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-1">{kpi.label}</p>
                    <p className={`text-base font-bold  ${kpi.danger ? "text-[var(--color-danger)]" : "text-[var(--color-text-body)]"}`}>
                        {kpi.value}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-sub)] mt-0.5">{kpi.sub}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Audit log ────────────────────────────────────────────────────────────────
function AuditLog() {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/migration/audit-log")
            .then((res) => setEvents(res.data?.data ?? []))
            .catch(() => setEvents([]))
            .finally(() => setLoading(false));
    }, []);

    const fmtDate = (d) => {
        if (!d) return "—";
        return new Date(d).toLocaleString("en-IN", {
            day: "2-digit", month: "short", year: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    };

    return (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="pb-3 border-b border-[var(--color-border)] px-4 pt-4">
                <h3 className="text-sm font-semibold text-[var(--color-text-body)] flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-white" />
                    </div>
                    Migration Audit Log
                </h3>
            </div>
            <div className="p-4">
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
                    </div>
                ) : events.length === 0 ? (
                    <div className="py-8 text-center">
                        <Clock className="w-7 h-7 text-[var(--color-text-sub)]/30 mx-auto mb-2" />
                        <p className="text-xs text-[var(--color-text-sub)]">No migration events recorded yet.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-[var(--color-border)]">
                        {events.map((ev, i) => {
                            const blockName = ev.blockId?.name ?? ev.snapshotData?.blockName ?? "Unknown block";
                            const fromName = ev.fromEntityId?.name ?? "—";
                            const toName = ev.toEntityId?.name ?? "—";
                            const toType = ev.toEntityId?.type;
                            const byName = ev.migratedBy?.name ?? "System";
                            const date = fmtDate(ev.completedAt ?? ev.createdAt);
                            const statusColor = ev.status === "rolled_back"
                                ? "bg-amber-500" : ev.status === "completed"
                                    ? "bg-emerald-500" : "bg-[var(--color-text-sub)]";

                            return (
                                <div key={ev._id ?? i} className="flex items-start gap-3 py-3">
                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${statusColor}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-[var(--color-text-body)] truncate">
                                            <span className="font-semibold">{blockName}</span>
                                            {" "}
                                            {ev.status === "rolled_back" ? "rolled back to" : "migrated from"}{" "}
                                            <span className="font-semibold">{fromName}</span>
                                            {" → "}
                                            <span className="font-semibold">{toName}</span>
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-sub)]  mt-0.5">
                                            {date} · by {byName}
                                        </p>
                                        {ev.snapshotData && (
                                            <p className="text-[10px] text-[var(--color-text-sub)] mt-0.5">
                                                {ev.snapshotData.tenantCount ?? 0} tenants · {ev.snapshotData.rentCount ?? 0} open rents
                                                {ev.snapshotData.outstandingPaisa > 0
                                                    ? ` · ${fmtPaisa(ev.snapshotData.outstandingPaisa)} outstanding`
                                                    : ""}
                                            </p>
                                        )}
                                    </div>
                                    {toType && <EntityBadge type={toType} />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── OrganizationTab (main) ───────────────────────────────────────────────────
export function OrganizationTab() {
    const { entities, loading: entitiesLoading, error: entitiesError, refresh: refreshEntities, createEntity, updateEntity } = useOwnership();
    const [blocks, setBlocks] = useState([]);
    const [blocksLoading, setBlocksLoading] = useState(true);
    const [blocksError, setBlocksError] = useState(null);

    const fetchBlocks = useCallback(async () => {
        setBlocksLoading(true);
        setBlocksError(null);
        try {
            const res = await api.get("/api/blocks/get-allblocks");
            const list = res.data?.data ?? [];

            const entityMap = Object.fromEntries(entities.map((e) => [e._id, e]));
            const enriched = list.map((b) => ({
                ...b,
                ownershipEntity: b.ownershipEntity ?? entityMap[b.ownershipEntityId] ?? null,
            }));
            setBlocks(enriched);
        } catch (e) {
            setBlocksError(e?.response?.data?.message ?? "Failed to load blocks");
            setBlocks([]);
        } finally {
            setBlocksLoading(false);
        }
    }, [entities]);

    useEffect(() => {
        fetchBlocks();
    }, [fetchBlocks]);

    const loading = entitiesLoading || blocksLoading;
    const error = entitiesError ?? blocksError;

    const [selectedBlockId, setSelectedBlockId] = useState(null);
    const [wizardBlock, setWizardBlock] = useState(null);
    const [entityDialogOpen, setEntityDialogOpen] = useState(false);
    const [entityToEdit, setEntityToEdit] = useState(null);
    const [syncActive, setSyncActive] = useState(false);
    const [syncLeft, setSyncLeft] = useState(0);
    const syncRef = useRef(null);

    const selectedBlock = blocks.find((b) => b._id === selectedBlockId);

    // Post-migration sync indicator
    const startSync = useCallback(() => {
        setSyncActive(true);
        setSyncLeft(60);
        syncRef.current = setInterval(() => {
            setSyncLeft((t) => {
                if (t <= 1) { clearInterval(syncRef.current); setSyncActive(false); return 0; }
                return t - 1;
            });
        }, 1000);
    }, []);

    useEffect(() => () => clearInterval(syncRef.current), []);

    const handleEntitySave = async (data) => {
        if (entityToEdit) {
            await updateEntity(entityToEdit._id, data);
        } else {
            await createEntity(data);
        }
    };

    const blockCountForEntity = (entityId) =>
        blocks.filter((b) => b.ownershipEntityId === entityId || b.ownershipEntity?._id === entityId).length;

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                <Skeleton className="h-40 rounded-xl" />
                <Skeleton className="h-60 rounded-xl" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
                <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" />
                <p className="text-sm font-semibold text-[var(--color-text-body)]">{error}</p>
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={refreshEntities}>
                    <RefreshCw className="w-3.5 h-3.5" />Retry
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            {/* Sync indicator */}
            {syncActive && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Syncing ledger — {syncLeft}s remaining
                    <div className="flex-1 max-w-28 h-1 bg-amber-200 rounded-full overflow-hidden ml-2">
                        <div
                            className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                            style={{ width: `${Math.round(((60 - syncLeft) / 60) * 100)}%` }}
                        />
                    </div>
                </div>
            )}

            {/* KPI strip */}
            <KpiStrip blocks={blocks} />

            {/* Entities */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="flex items-center justify-between px-4 pt-4 pb-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-body)] flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
                            <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        Ownership Entities
                        <Badge variant="secondary" className="text-[11px] font-semibold">{entities.length}</Badge>
                    </h3>
                    {/* New Entity hidden — single-entity mode */}
                </div>
                <div className="p-4">
                    {entities.length === 0 ? (
                        <div className="text-center py-10 border-2 border-dashed border-[var(--color-border)] rounded-xl">
                            <Building2 className="w-8 h-8 text-[var(--color-text-sub)]/30 mx-auto mb-2" />
                            <p className="text-sm font-medium text-[var(--color-text-sub)]">No active entity</p>
                            <p className="text-xs text-[var(--color-text-sub)]/60 mt-1">
                                Contact your administrator to activate an entity.
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {entities.map((ent) => (
                                <EntityCard
                                    key={ent._id}
                                    entity={ent}
                                    blockCount={blockCountForEntity(ent._id)}
                                    onEdit={() => { setEntityToEdit(ent); setEntityDialogOpen(true); }}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Block cards */}
            {blocks.length > 0 && (
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-[var(--color-text-sub)] uppercase tracking-widest">
                        Buildings — select to view details or migrate
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {blocks.map((block) => (
                            <BlockCard
                                key={block._id}
                                block={block}
                                selected={selectedBlockId === block._id}
                                onSelect={() => setSelectedBlockId(selectedBlockId === block._id ? null : block._id)}
                                onMigrate={() => setWizardBlock(block)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Block detail panel */}
            {selectedBlock && (
                <BlockDetailPanel
                    block={selectedBlock}
                    onClose={() => setSelectedBlockId(null)}
                    onMigrate={() => setWizardBlock(selectedBlock)}
                />
            )}

            {/* Audit log */}
            <AuditLog />

            {/* Entity form dialog */}
            <EntityFormDialog
                open={entityDialogOpen}
                onOpenChange={setEntityDialogOpen}
                entity={entityToEdit}
                onSave={handleEntitySave}
            />

            {/* Migration wizard */}
            {wizardBlock && (
                <MigrationWizard
                    block={wizardBlock}
                    entities={entities}
                    onClose={() => setWizardBlock(null)}
                    onDone={() => {
                        setWizardBlock(null);
                        setSelectedBlockId(null);
                        startSync();
                        refreshEntities();
                        fetchBlocks();
                        toast.success("Migration complete. Ledger syncing…");
                    }}
                />
            )}
        </div>
    );
}
