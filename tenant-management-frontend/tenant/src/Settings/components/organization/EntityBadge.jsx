/**
 * EntityBadge.jsx
 *
 * Displays a colour-coded badge for an OwnershipEntity type.
 * Props:
 *   type   "private" | "company" | "head_office"
 *   size   "sm" (default) | "md"
 */

import { Badge } from "@/components/ui/badge";

const CONFIG = {
    private: { label: "Private", dot: "bg-emerald-500", cls: "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-50" },
    company: { label: "Company", dot: "bg-sky-500", cls: "bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-50" },
    head_office: { label: "Head Office", dot: "bg-violet-500", cls: "bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-50" },
};

export function EntityBadge({ type, size = "sm" }) {
    const cfg = CONFIG[type] ?? CONFIG.private;
    return (
        <Badge className={`gap-1.5 font-semibold ${size === "md" ? "text-xs px-2.5 py-1" : "text-[11px] px-2 py-0.5"} ${cfg.cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${cfg.dot}`} />
            {cfg.label}
        </Badge>
    );
}