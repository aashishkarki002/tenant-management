import { useState, useEffect, useCallback } from "react";
import { Zap, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "../../plugins/axios";
import { useBankAccounts } from "../Accounts/hooks/useAccounting";

import { GeneratorSummary } from "./components/GeneratorSummary";
import { GeneratorCard } from "./components/GeneratorCard";
import { AddGeneratorDialog } from "./components/dialogs/AddGenerator";

export default function GeneratorPanel() {
    const [generators, setGenerators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [addOpen, setAddOpen] = useState(false);
    const { bankAccounts = [] } = useBankAccounts();

    const fetchGenerators = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get("/api/maintenance/generator/all");
            setGenerators(res.data?.data || []);
        } catch { toast.error("Failed to load generators"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchGenerators(); }, [fetchGenerators]);

    const total = generators.length;

    return (
        <div className="space-y-3 sm:space-y-4">
            <GeneratorSummary generators={generators} />

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-700 shrink-0">
                    {total} Generator{total !== 1 ? "s" : ""}
                </h2>
                <div className="flex gap-2">
                    <button onClick={fetchGenerators} disabled={loading}
                        className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 active:bg-gray-100 disabled:opacity-50 transition-colors font-medium">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>
                    <button onClick={() => setAddOpen(true)}
                        className="flex items-center gap-1.5 text-xs h-8 px-3 rounded-lg bg-gray-900 text-white hover:bg-gray-700 active:bg-gray-800 transition-colors font-medium">
                        <Plus className="w-3.5 h-3.5" /> Add Generator
                    </button>
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
                    <button onClick={() => setAddOpen(true)}
                        className="mt-4 flex items-center gap-1.5 text-xs h-8 px-4 rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors font-medium">
                        <Plus className="w-3.5 h-3.5" /> Add your first generator
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {generators.map(g => (
                        <GeneratorCard key={g._id} gen={g} onRefresh={fetchGenerators} bankAccounts={bankAccounts} />
                    ))}
                </div>
            )}

            <AddGeneratorDialog open={addOpen} onClose={() => setAddOpen(false)} onDone={fetchGenerators} />
        </div>
    );
}