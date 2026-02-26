import { useState } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "../shared/Pill"
import { GeneratorCardHeader } from "./GeneratorCardHeader";
import { GeneratorCardDetail } from "./GenaratorCardDetail";
import { DailyCheckDialog } from "./dialogs/DailyCheckDialog";
import { FuelRefillDialog } from "./dialogs/FuelRefillDialog";
import { ServiceLogDialog } from "./dialogs/ServiceLogDialog";
import { fmt } from "../constants/constant";

/**
 * GeneratorCard
 *
 * Props:
 *   gen           {object}   — generator document from the API
 *   onRefresh     {()=>void} — triggers re-fetch in the parent
 *   bankAccounts  {Array}    — [{ _id, name, accountCode }] passed down from panel
 */
export function GeneratorCard({ gen, onRefresh, bankAccounts = [] }) {
    const [tab, setTab] = useState("overview");
    const [expanded, setExpanded] = useState(false);
    const [checkOpen, setCheckOpen] = useState(false);
    const [refillOpen, setRefillOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);

    const isFault = gen.status === "FAULT";
    const isMaintenance = gen.status === "MAINTENANCE";

    const expandToggle = (
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
            onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
    );

    return (
        <>
            {/* Dialogs — receive bankAccounts for accounting fields */}
            <DailyCheckDialog
                gen={gen} open={checkOpen}
                onClose={() => setCheckOpen(false)} onDone={onRefresh}
            />
            <FuelRefillDialog
                gen={gen} open={refillOpen}
                onClose={() => setRefillOpen(false)} onDone={onRefresh}
                bankAccounts={bankAccounts}
            />
            <ServiceLogDialog
                gen={gen} open={serviceOpen}
                onClose={() => setServiceOpen(false)} onDone={onRefresh}
                bankAccounts={bankAccounts}
            />

            <div className={`rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md overflow-hidden
                ${isFault ? "border-red-300" : isMaintenance ? "border-amber-300" : "border-gray-200"}`}>

                {/* ── Header ── */}
                <GeneratorCardHeader
                    gen={gen}
                    onCheckClick={() => setCheckOpen(true)}
                    onRefillClick={() => setRefillOpen(true)}
                    onServiceClick={() => setServiceOpen(true)}
                    expandToggle={expandToggle}
                />

                {/* ── Stats strip ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 bg-gray-50/50 divide-x divide-gray-100">
                    {[
                        { label: "Last Check", value: fmt.date(gen.lastCheckedAt) },
                        { label: "Daily Checks", value: gen.dailyChecks?.length ?? 0 },
                        { label: "Refills", value: gen.fuelRefills?.length ?? 0 },
                        { label: "Service Logs", value: gen.serviceLogs?.length ?? 0 },
                    ].map(({ label, value }) => (
                        <div key={label} className="flex flex-col items-center py-2.5 px-2 border-b sm:border-b-0 border-gray-100">
                            <span className="text-[9px] uppercase tracking-widest text-gray-400 font-semibold">{label}</span>
                            <span className="text-sm font-bold text-gray-700 mt-0.5">{value}</span>
                        </div>
                    ))}
                </div>

                {/* ── Thresholds + next service ── */}
                <div className="flex gap-2 px-4 py-2 border-t border-gray-100 bg-white flex-wrap items-center">
                    <span className="text-[10px] text-gray-400">Thresholds:</span>
                    <Pill className="bg-amber-50 text-amber-700 border-amber-200">
                        Low ≤ {gen.lowFuelThresholdPercent}%
                    </Pill>
                    <Pill className="bg-red-50 text-red-700 border-red-200">
                        Critical ≤ {gen.criticalFuelThresholdPercent}%
                    </Pill>
                    {gen.nextServiceDate && (
                        <Pill className="bg-purple-50 text-purple-700 border-purple-200 ml-auto">
                            <Calendar className="w-3 h-3" /> Next service {fmt.date(gen.nextServiceDate)}
                        </Pill>
                    )}
                </div>

                {/* ── Expanded detail ── */}
                {expanded && (
                    <GeneratorCardDetail
                        gen={gen}
                        tab={tab}
                        onTabChange={setTab}
                        onAddCheck={() => setCheckOpen(true)}
                        onAddRefill={() => setRefillOpen(true)}
                        onAddService={() => setServiceOpen(true)}
                    />
                )}
            </div>
        </>
    );
}