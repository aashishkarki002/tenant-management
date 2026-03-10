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


export function GeneratorCard({ gen, onRefresh, bankAccounts = [] }) {
    const [tab, setTab] = useState("overview");
    const [expanded, setExpanded] = useState(false);
    const [checkOpen, setCheckOpen] = useState(false);
    const [refillOpen, setRefillOpen] = useState(false);
    const [serviceOpen, setServiceOpen] = useState(false);

    const isFault = gen.status === "FAULT";
    const isMaintenance = gen.status === "MAINTENANCE";

    const expandToggle = (
        <button onClick={() => setExpanded(e => !e)}
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg hover:bg-muted-fill active:bg-muted-fill transition-colors text-text-sub">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
    );

    return (
        <>
            <DailyCheckDialog gen={gen} open={checkOpen} onClose={() => setCheckOpen(false)} onDone={onRefresh} />
            <FuelRefillDialog gen={gen} open={refillOpen} onClose={() => setRefillOpen(false)} onDone={onRefresh} bankAccounts={bankAccounts} />
            <ServiceLogDialog gen={gen} open={serviceOpen} onClose={() => setServiceOpen(false)} onDone={onRefresh} bankAccounts={bankAccounts} />

            <div className={`rounded-xl border bg-surface-raised shadow-sm overflow-hidden
                ${isFault ? "border-danger" : isMaintenance ? "border-warning" : "border-muted-fill"}`}>

                <GeneratorCardHeader
                    gen={gen}
                    onCheckClick={() => setCheckOpen(true)}
                    onRefillClick={() => setRefillOpen(true)}
                    onServiceClick={() => setServiceOpen(true)}
                    expandToggle={expandToggle}
                />

                {/* Stats strip: 2-col mobile, 4-col desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-muted-fill bg-muted-fill/60">
                    {[
                        { label: "Last Check", value: fmt.date(gen.lastCheckedAt) },
                        { label: "Daily Checks", value: gen.dailyChecks?.length ?? 0 },
                        { label: "Refills", value: gen.fuelRefills?.length ?? 0 },
                        { label: "Service Logs", value: gen.serviceLogs?.length ?? 0 },
                    ].map(({ label, value }, i) => (
                        <div key={label}
                            className={`flex flex-col items-center py-2.5 px-2
                                ${i === 0 ? "border-r border-muted-fill" : ""}
                                ${i === 1 ? "border-b sm:border-b-0" : ""}
                                ${i === 0 ? "border-b sm:border-b-0" : ""}
                                sm:border-r sm:[&:last-child]:border-r-0 border-muted-fill`}>
                            <span className="text-[9px] uppercase tracking-widest text-text-sub font-semibold text-center leading-tight">{label}</span>
                            <span className="text-sm font-bold text-text-strong mt-0.5">{value}</span>
                        </div>
                    ))}
                </div>

                {/* Thresholds row */}
                <div className="flex gap-2 px-3 sm:px-4 py-2 border-t border-muted-fill bg-surface-raised flex-wrap items-center">
                    <span className="text-[10px] text-text-sub">Thresholds:</span>
                    <Pill className="bg-muted-fill text-text-strong border-muted-fill">Low ≤ {gen.lowFuelThresholdPercent}%</Pill>
                    <Pill className="bg-danger text-text-strong border-danger">Critical ≤ {gen.criticalFuelThresholdPercent}%</Pill>
                    {gen.nextServiceDate && (
                        <Pill className="bg-muted-fill text-text-strong border-muted-fill ml-auto">
                            <Calendar className="w-3 h-3" /> Next service {fmt.date(gen.nextServiceDate)}
                        </Pill>
                    )}
                </div>

                {expanded && (
                    <GeneratorCardDetail
                        gen={gen} tab={tab} onTabChange={setTab}
                        onAddCheck={() => setCheckOpen(true)}
                        onAddRefill={() => setRefillOpen(true)}
                        onAddService={() => setServiceOpen(true)}
                    />
                )}
            </div>
        </>
    );
}