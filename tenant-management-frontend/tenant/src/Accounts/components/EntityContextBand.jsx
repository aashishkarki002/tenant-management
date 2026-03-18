/**
 * EntityContextBand
 *
 * A slim, persistent stripe that sits between the header slot and the tab bar
 * on the AccountingPage. It shows the current entity scope and lets super_admins
 * switch between All / Private / Company entities.
 *
 * Design decision (PM):
 *   The header slot is already full (period picker, compare, More menu).
 *   Entity scope is a *context* selector, not a period filter — it belongs in
 *   its own visual zone, not squeezed into the same row as date controls.
 *   A 36px band with a left-anchored pill row keeps it scannable and out of the way.
 *
 * Props:
 *   entities        {Array<{ _id, name, type }>}  — from GET /api/ownership
 *   activeEntityId  {string|null}                  — null = merged/All view
 *   onSelect        {(id: string|null) => void}    — callback when pill is clicked
 *   systemMode      {"private"|"company"|"merged"} — from SystemConfig
 *   loading         {boolean}
 */

import { BuildingIcon, LayersIcon } from "lucide-react";
import api from "../../../plugins/axios";

// Entity type → display config
const ENTITY_CONFIG = {
    private: {
        label: "Private",
        dot: "#16a34a",     // green
        bg: "#f0fdf4",
        bgActive: "#16a34a",
        border: "#bbf7d0",
    },
    company: {
        label: "Company",
        dot: "#1A5276",     // petrol brand color
        bg: "#eff6ff",
        bgActive: "#1A5276",
        border: "#bfdbfe",
    },
    head_office: {
        label: "Head Office",
        dot: "#7c3aed",
        bg: "#f5f3ff",
        bgActive: "#7c3aed",
        border: "#ddd6fe",
    },
};

function EntityPill({ entity, isActive, onClick }) {
    const cfg = ENTITY_CONFIG[entity.type] ?? {
        label: entity.type,
        dot: "var(--color-accent)",
        bg: "var(--color-surface)",
        bgActive: "var(--color-accent)",
        border: "var(--color-border)",
    };

    return (
        <button
            onClick={onClick}
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 10px",
                borderRadius: 20,
                border: `1.5px solid ${isActive ? cfg.bgActive : cfg.border}`,
                background: isActive ? cfg.bgActive : cfg.bg,
                color: isActive ? "#fff" : "var(--color-text-body)",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                lineHeight: 1,
            }}
        >
            <span
                style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isActive ? "rgba(255,255,255,0.75)" : cfg.dot,
                    flexShrink: 0,
                }}
            />
            {entity.name}
            <span
                style={{
                    fontSize: 10,
                    opacity: isActive ? 0.7 : 0.55,
                    fontWeight: 500,
                }}
            >
                {cfg.label}
            </span>
        </button>
    );
}

export default function EntityContextBand({
    entities = [],
    activeEntityId,
    onSelect,
    systemMode = "private",
    loading = false,
}) {
    // In private mode with no entities yet, nothing to show
    if (systemMode === "private" && entities.length <= 1) return null;
    // If entities haven't loaded yet, show a skeleton row
    if (loading) {
        return (
            <div
                style={{
                    padding: "5px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                }}
            >
                <div
                    style={{
                        height: 24,
                        width: 280,
                        borderRadius: 12,
                        background: "var(--color-surface-alt, #f3f4f6)",
                        animation: "pulse 1.5s infinite",
                    }}
                />
            </div>
        );
    }

    const isAll = activeEntityId === null;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "5px 16px",
                borderBottom: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                overflowX: "auto",
                scrollbarWidth: "none",
            }}
        >
            {/* "Scope:" label */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--color-text-sub)",
                    flexShrink: 0,
                    marginRight: 2,
                }}
            >
                <LayersIcon size={11} />
                Scope
            </div>

            {/* All / Merged pill */}
            <button
                onClick={() => onSelect(null)}
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 20,
                    border: `1.5px solid ${isAll ? "var(--color-accent)" : "var(--color-border)"}`,
                    background: isAll ? "var(--color-accent)" : "transparent",
                    color: isAll ? "#fff" : "var(--color-text-body)",
                    fontSize: 12,
                    fontWeight: isAll ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                }}
            >
                <LayersIcon size={10} style={{ opacity: isAll ? 0.75 : 0.5 }} />
                All Entities
            </button>

            {/* Divider */}
            <div
                style={{
                    width: 1,
                    height: 16,
                    background: "var(--color-border)",
                    flexShrink: 0,
                    margin: "0 2px",
                }}
            />

            {/* Per-entity pills */}
            {entities
                .filter((e) => e.type !== "head_office") // Head Office excluded per spec
                .map((entity) => (
                    <EntityPill
                        key={entity._id}
                        entity={entity}
                        isActive={activeEntityId === entity._id}
                        onClick={() => onSelect(entity._id)}
                    />
                ))}

            {/* Right: context hint when a specific entity is active */}
            {!isAll && (
                <div
                    style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        color: "var(--color-text-sub)",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                    }}
                >
                    <BuildingIcon size={10} />
                    Filtered view — totals reflect this entity only
                </div>
            )}
        </div>
    );
}