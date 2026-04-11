// src/pages/rent/components/RentPageHeader.jsx
//
// Page-level header: title identity + admin operations only.
//
// Industry standard (Linear, GitHub, Notion):
//   Left  → page identity (title + live indicator)
//   Right → admin/destructive operations
//   Below → sub-navigation tabs (see usage below)
//
// Search and data filters are NOT in the header — they belong in the
// content toolbar (RentFilter), co-located with the data they filter.
//
// Usage:
//   <RentPageHeader activeTab={tab} onTabChange={setTab} onProcessSuccess={refetch} />
//   <RentFilter ... />   ← renders inside the tab panel, owns search + filters

import React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminRentAction } from "./AdminRentAction";

// ── Live indicator ────────────────────────────────────────────────────────────
// Small pulsing dot signals the data is live / auto-refreshed.
// Remove if the page is not polling.
const LiveDot = () => (
    <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
    </span>
);

// ── Main export ───────────────────────────────────────────────────────────────
export const RentPageHeader = ({
    activeTab = "rent",
    onTabChange,
    onProcessSuccess,
}) => (
    // Header sits outside the page scroll area — sticky positioning
    // is handled by the parent layout, not this component.
    <div className="border-b border-border bg-background">

        {/* ── Top bar: title + actions ─────────────────────────────────────
         *  Deliberately minimal — one concern per side.
         *  AdminRentAction handles its own alert-dialog confirmation flow.
         * ──────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 h-12">
            <div className="flex items-center gap-2">
                <LiveDot />
                <h1 className="text-sm font-medium text-foreground">
                    Rent Management
                </h1>
            </div>

            <AdminRentAction onProcessSuccess={onProcessSuccess} />
        </div>

        {/* ── Sub-navigation ────────────────────────────────────────────────
         *  Tabs are navigation, not filters — they live here, not in the
         *  toolbar. Each tab owns its own filter state.
         * ──────────────────────────────────────────────────────────────── */}
        <Tabs
            value={activeTab}
            onValueChange={onTabChange}
            className="px-4"
        >
            <TabsList className="h-auto rounded-none bg-transparent p-0 gap-0">
                <TabsTrigger
                    value="rent"
                    className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-0 text-sm font-normal text-muted-foreground
                               data-[state=active]:border-foreground data-[state=active]:text-foreground
                               data-[state=active]:font-medium data-[state=active]:shadow-none
                               hover:text-foreground transition-colors"
                >
                    Rent
                </TabsTrigger>
                <TabsTrigger
                    value="payments"
                    className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-0 text-sm font-normal text-muted-foreground
                               data-[state=active]:border-foreground data-[state=active]:text-foreground
                               data-[state=active]:font-medium data-[state=active]:shadow-none
                               hover:text-foreground transition-colors"
                >
                    Payments
                </TabsTrigger>
            </TabsList>
        </Tabs>

    </div>
);