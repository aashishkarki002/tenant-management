import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Landmark,
    Settings2,
    ShieldCheck,
    ChevronRight,
    ChevronLeft,
} from "lucide-react";
import { NAV_GROUPS, getGroupForTab } from "./accountingNavConfig";

// Map iconName strings → Lucide components (avoids dynamic require)
const ICON_MAP = {
    LayoutDashboard,
    TrendingUp,
    TrendingDown,
    Landmark,
    Settings2,
    ShieldCheck,
};

export default function AccountingSidebar({ activeTab, onTabSelect, ledgerCount = 0 }) {
    const activeGroupId = getGroupForTab(activeTab);

    const [openGroups, setOpenGroups] = useState(() => new Set([activeGroupId]));
    const [collapsed, setCollapsed] = useState(false);

    const toggleGroup = useCallback((groupId) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    }, []);

    const handleTabClick = useCallback((tabId, groupId) => {
        onTabSelect(tabId);
        setOpenGroups(prev => {
            if (prev.has(groupId)) return prev;
            return new Set([...prev, groupId]);
        });
    }, [onTabSelect]);

    return (
        <aside
            className={cn(
                "no-print flex-shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-bg)]",
                "transition-all duration-200 ease-in-out overflow-hidden",
                collapsed ? "w-14" : "w-52",
            )}
        >
            {/* Collapse toggle */}
            <div className="flex items-center justify-end px-2 py-2 border-b border-[var(--color-border)]">
                <button
                    onClick={() => setCollapsed(c => !c)}
                    className="p-1.5 rounded-lg text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-surface)] transition-colors duration-150 cursor-pointer"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                </button>
            </div>

            {/* Nav groups */}
            <nav className="flex-1 overflow-y-auto py-2">
                {NAV_GROUPS.map(group => {
                    const GroupIcon = ICON_MAP[group.iconName];
                    const isGroupActive = group.id === activeGroupId;
                    const isOpen = openGroups.has(group.id) && !collapsed;

                    return (
                        <div key={group.id}>
                            {/* Group header */}
                            <button
                                onClick={() => {
                                    if (collapsed) {
                                        setCollapsed(false);
                                        setOpenGroups(new Set([group.id]));
                                    } else {
                                        toggleGroup(group.id);
                                    }
                                }}
                                title={collapsed ? group.label : undefined}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide transition-colors duration-150 cursor-pointer",
                                    isGroupActive
                                        ? "text-[var(--color-accent)]"
                                        : "text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]",
                                )}
                            >
                                <GroupIcon
                                    size={16}
                                    className={cn(
                                        "flex-shrink-0",
                                        isGroupActive ? "text-[var(--color-accent)]" : "text-[var(--color-text-sub)]",
                                    )}
                                />
                                {!collapsed && (
                                    <>
                                        <span className="flex-1 text-left truncate">{group.label}</span>
                                        <ChevronRight
                                            size={12}
                                            className={cn(
                                                "flex-shrink-0 transition-transform duration-150",
                                                isOpen && "rotate-90",
                                            )}
                                        />
                                    </>
                                )}
                            </button>

                            {/* Active dot when collapsed */}
                            {collapsed && isGroupActive && (
                                <div className="flex justify-center mb-0.5">
                                    <span className="w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                                </div>
                            )}

                            {/* Tab items */}
                            {isOpen && (
                                <ul className="pb-1">
                                    {group.tabs.map(tab => {
                                        const isActive = tab.id === activeTab;
                                        return (
                                            <li key={tab.id} className="relative">
                                                {isActive && (
                                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-accent)] rounded-r" />
                                                )}
                                                <button
                                                    onClick={() => handleTabClick(tab.id, group.id)}
                                                    className={cn(
                                                        "w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-[12.5px] font-medium transition-colors duration-150 cursor-pointer",
                                                        isActive
                                                            ? "text-[var(--color-accent)] bg-[var(--color-accent-light)]"
                                                            : "text-[var(--color-text-sub)] hover:text-[var(--color-text-body)] hover:bg-[var(--color-surface)]",
                                                    )}
                                                >
                                                    <span className="truncate">{tab.label}</span>
                                                    {tab.id === "ledger" && ledgerCount > 0 && (
                                                        <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--color-surface)] text-[var(--color-text-sub)]">
                                                            {ledgerCount}
                                                        </span>
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    );
                })}
            </nav>
        </aside>
    );
}
