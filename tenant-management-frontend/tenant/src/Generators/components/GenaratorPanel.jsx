import { useState, useEffect, useCallback } from "react";
import { Zap, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "../../../plugins/axios";

import { GeneratorSummaryStrip } from "./GeneratorSummaryStrip";
import { GeneratorCard } from "./GeneratorCard";
import { AddGeneratorDialog } from "./dialogs/AddGeneratorDialog";

/**
 * GeneratorPanel
 *
 * Top-level component. Owns:
 *   - generators list (fetched from API)
 *   - bankAccounts list (fetched once for accounting fields)
 *   - addOpen modal state
 *
 * All child components receive data via props — no internal fetching below this level.
 */
export default function GeneratorPanel() {
    const [generators, setGenerators] = useState([]);
    const [bankAccounts, setBankAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);

    // ── Fetch generators ────────────────────────────────────────────────────
    const fetchGenerators = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/maintenance/generator/all");
            setGenerators(res.data?.data || []);
        } catch {
            toast.error("Failed to load generators");
        } finally {
            setLoading(false);
        }
    }, []);

    // ── Fetch bank accounts (for accounting fields in dialogs) ───────────────
    const fetchBankAccounts = useCallback(async () => {
        try {
            const res = await api.get("/api/banks/all");
            setBankAccounts(res.data?.data || []);
        } catch {
            console.warn("Could not fetch bank accounts; accounting dropdowns will be empty");
        }
    }, []);

    useEffect(() => {
        fetchGenerators();
        fetchBankAccounts();
    }, [fetchGenerators, fetchBankAccounts]);

    const total = generators.length;

    return (
        <div className="space-y-4">
            {/* Summary tiles */}
            <GeneratorSummaryStrip generators={generators} />

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700">
                    {total} Generator{total !== 1 ? "s" : ""}
                </h2>
                <div className="flex gap-2">
                    <Button
                        variant="outline" size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={fetchGenerators}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </Button>
                    <Button
                        size="sm"
                        className="h-8 text-xs gap-1.5 text-white"
                        onClick={() => setAddOpen(true)}
                    >
                        <Plus className="w-3.5 h-3.5" /> Add Generator
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-16 text-sm text-gray-400 gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading generators…
                </div>
            ) : total === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    <Zap className="w-10 h-10 mb-3 opacity-25" />
                    <p className="text-sm font-medium">No generators added yet</p>
                    <Button size="sm" className="mt-4 text-white" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add your first generator
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {generators.map(g => (
                        <GeneratorCard
                            key={g._id}
                            gen={g}
                            onRefresh={fetchGenerators}
                        />
                    ))}
                </div>
            )}

            <AddGeneratorDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                onDone={fetchGenerators}
                bankAccounts={bankAccounts}
            />
        </div>
    );
}