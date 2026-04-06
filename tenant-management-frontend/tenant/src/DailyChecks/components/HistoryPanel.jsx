import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import api from "../../../plugins/axios";
import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";
import {
    ALL_CATEGORIES,
    CHECKLIST_HISTORY_FETCH_LIMIT,
    CHECKLIST_HISTORY_DAY_SLICE,
} from "../constants/dailyChecksConstants";
import { ProgressBar } from "./ProgressBar";

export function HistoryPanel({ propertyId, onClose, onSelectDay }) {
    const [days, setDays] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const controller = new AbortController();
        (async () => {
            try {
                const res = await api.get("/api/checklists/results", {
                    params: { propertyId, limit: CHECKLIST_HISTORY_FETCH_LIMIT },
                    signal: controller.signal,
                });
                const rows = res.data?.data ?? [];

                const byDate = {};
                for (const r of rows) {
                    if (!r.nepaliDate) continue;
                    (byDate[r.nepaliDate] ??= []).push(r);
                }

                const sorted = Object.entries(byDate)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, CHECKLIST_HISTORY_DAY_SLICE)
                    .map(([date, results]) => {
                        const [y, m, d] = date.split("-").map(Number);
                        return {
                            nepaliDate: date,
                            label: `${d} ${NEPALI_MONTH_NAMES[(m ?? 1) - 1]} ${y}`,
                            total: ALL_CATEGORIES.length,
                            done: results.filter((r) => r.status === "COMPLETED").length,
                            hasIssues: results.some((r) => r.hasIssues),
                        };
                    });

                setDays(sorted);
            } catch (err) {
                const e = err;
                if (e?.name === "CanceledError" || e?.name === "AbortError") return;
            } finally {
                setLoading(false);
            }
        })();
        return () => controller.abort();
    }, [propertyId]);

    return (
        <div className="flex flex-col min-h-full">
            <div className="sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="w-11 h-11 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-[var(--color-text-body)]" />
                    </button>
                    <div className="flex items-center gap-2">
                        <History className="w-5 h-5 text-[var(--color-accent)]" />
                        <h2 className="text-base font-bold text-[var(--color-text-strong)]">Check History</h2>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {loading ? (
                    Array.from({ length: 7 }, (_, i) => (
                        <div key={i} className="h-16 rounded-2xl animate-pulse bg-[var(--color-surface-raised)]" />
                    ))
                ) : days.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                        <div className="text-3xl opacity-30">📋</div>
                        <p className="text-sm text-[var(--color-text-sub)]">No past checks found.</p>
                    </div>
                ) : (
                    days.map((day) => {
                        const allDone = day.done === day.total;
                        const pct = Math.round((day.done / day.total) * 100);
                        return (
                            <button
                                key={day.nepaliDate}
                                onClick={() => { onSelectDay(day.nepaliDate); onClose(); }}
                                className="w-full text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3.5 hover:bg-[var(--color-accent-light)] transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <p className="text-sm font-bold text-[var(--color-text-strong)]">{day.label} BS</p>
                                        <p className="text-xs text-[var(--color-text-weak)]">{day.done}/{day.total} categories done</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {day.hasIssues && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Issues</span>
                                        )}
                                        {allDone && !day.hasIssues && (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">All Clear</span>
                                        )}
                                        <span className="text-sm font-bold text-[var(--color-text-sub)]">{pct}%</span>
                                        <ChevronRight className="w-4 h-4 text-[var(--color-text-weak)]" />
                                    </div>
                                </div>
                                <ProgressBar
                                    value={day.done}
                                    max={day.total}
                                    color={day.hasIssues ? "#f59e0b" : allDone ? "#10b981" : "var(--color-accent)"}
                                />
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
