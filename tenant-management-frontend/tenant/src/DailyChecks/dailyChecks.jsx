/**
 * DailyChecklistPage.jsx
 *
 * Staff-facing daily inspection — fully internationalised.
 *
 * i18n rules applied:
 *  - CATEGORY_META stores i18n key references, never display strings.
 *  - Sub-components defined outside the main component scope receive `t` as
 *    a prop (hooks can't be called there). Components that are genuine React
 *    components (rendered by JSX, not called as functions) use useTranslation().
 *  - Every piece of UI text is routed through t() with an English fallback.
 *  - Active locale is driven by LanguageContext → i18next; this page has no
 *    locale state — useTranslation() re-renders automatically on change.
 *
 * Tech: React + Tailwind + shadcn + react-router. NO inline styles.
 */

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    ClipboardList,
    Flame,
    Droplets,
    Zap,
    Camera,
    Car,
    Waves,
    LayoutGrid,
    MessageSquare,
    Loader2,
    ArrowLeft,
    PartyPopper,
    Wrench,
    RefreshCw,
    Check,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";

// ─── Category config ──────────────────────────────────────────────────────────
// labelKey / descKey map to checklist.categories.* and checklist.categoryDesc.*
// in i18n.js — never hardcode display strings in this object.

const CATEGORY_META = {
    FIRE: {
        icon: Flame,
        labelKey: "checklist.categories.FIRE",
        descKey: "checklist.categoryDesc.FIRE",
        urgency: "critical",
        iconBg: "bg-red-50",
        iconColor: "text-red-600",
    },
    WATER_TANK: {
        icon: Droplets,
        labelKey: "checklist.categories.WATER_TANK",
        descKey: "checklist.categoryDesc.WATER_TANK",
        urgency: "high",
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
    },
    ELECTRICAL: {
        icon: Zap,
        labelKey: "checklist.categories.ELECTRICAL",
        descKey: "checklist.categoryDesc.ELECTRICAL",
        urgency: "high",
        iconBg: "bg-yellow-50",
        iconColor: "text-yellow-600",
    },
    CCTV: {
        icon: Camera,
        labelKey: "checklist.categories.CCTV",
        descKey: "checklist.categoryDesc.CCTV",
        urgency: null,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-600",
    },
    PARKING: {
        icon: Car,
        labelKey: "checklist.categories.PARKING",
        descKey: "checklist.categoryDesc.PARKING",
        urgency: null,
        iconBg: "bg-stone-100",
        iconColor: "text-stone-600",
    },
    SANITARY: {
        icon: Waves,
        labelKey: "checklist.categories.SANITARY",
        descKey: "checklist.categoryDesc.SANITARY",
        urgency: null,
        iconBg: "bg-cyan-50",
        iconColor: "text-cyan-600",
    },
    COMMON_AREA: {
        icon: LayoutGrid,
        labelKey: "checklist.categories.COMMON_AREA",
        descKey: "checklist.categoryDesc.COMMON_AREA",
        urgency: null,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
    },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META);
const OWNERSHIP_ENTITY_ID = "69b11f16ce3a098bb6ba5424";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
    return new Date().toISOString().split("T")[0];
}

function countIssues(sections) {
    return sections.reduce(
        (acc, sec) => acc + sec.items.filter((it) => !it.isOk).length,
        0,
    );
}

function countTotal(sections) {
    return sections.reduce((acc, sec) => acc + sec.items.length, 0);
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max, className = "" }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className={`h-2 rounded-full bg-[var(--color-muted)] overflow-hidden ${className}`}>
            <div
                className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

// ─── CategoryPicker ───────────────────────────────────────────────────────────
// `t` received as prop — this function is defined at module scope so hooks
// cannot be called here.

function CategoryPicker({ checklists, onSelect, completedCategories, loading, t }) {
    if (loading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-24 rounded-2xl animate-pulse bg-[var(--color-surface)]" />
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ALL_CATEGORIES.map((cat) => {
                const meta = CATEGORY_META[cat];
                const Icon = meta.icon;
                const isDone = completedCategories.includes(cat);
                const checklist = checklists.find((c) => c.category === cat);

                return (
                    <button
                        key={cat}
                        onClick={() => onSelect(cat, checklist)}
                        aria-label={t(meta.labelKey)}
                        className={`
              group flex items-center gap-4 p-4 rounded-2xl border-2 text-left
              transition-all duration-150 active:scale-[0.98]
              ${isDone
                                ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
                                : "border-[var(--color-border)] bg-[var(--color-surface-raised)] hover:border-[var(--color-accent-mid)] hover:bg-[var(--color-accent-light)]"
                            }
            `}
                    >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isDone ? "bg-[var(--color-success-bg)]" : meta.iconBg}`}>
                            {isDone
                                ? <CheckCircle2 className="w-6 h-6 text-[var(--color-success)]" />
                                : <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                            }
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className={`text-sm font-bold ${isDone ? "text-[var(--color-success)]" : "text-[var(--color-text-strong)]"}`}>
                                    {t(meta.labelKey)}
                                </p>
                                {meta.urgency === "critical" && !isDone && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 uppercase tracking-wide">
                                        {t("checklist.urgencyLabel.critical")}
                                    </span>
                                )}
                            </div>
                            <p className={`text-xs mt-0.5 truncate ${isDone ? "text-[var(--color-success)]" : "text-[var(--color-text-sub)]"}`}>
                                {isDone ? `${t("checklist.doneToday")} ✓` : t(meta.descKey)}
                            </p>
                        </div>

                        {!isDone && (
                            <ChevronRight className="w-5 h-5 text-[var(--color-text-weak)] shrink-0 group-hover:text-[var(--color-accent)] transition-colors" />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── CheckItem ────────────────────────────────────────────────────────────────
// `t` received as prop.

function CheckItem({ item, sectionKey, onChange, t }) {
    const [showNote, setShowNote] = useState(!item.isOk && item.notes !== "");

    function handleOk() {
        setShowNote(false);
        onChange(sectionKey, item._id, { isOk: true, notes: "" });
    }

    function handleIssue() {
        setShowNote(true);
        onChange(sectionKey, item._id, { isOk: false });
    }

    return (
        <div className={`
      rounded-xl border-2 overflow-hidden transition-all duration-200
      ${item.isOk === false
                ? "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]"
                : item.isOk === true
                    ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
                    : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
            }
    `}>
            <div className="flex items-center gap-3 p-3">
                {/* Status dot */}
                <div className={`
          w-2 h-2 rounded-full shrink-0 mt-0.5
          ${item.isOk === false
                        ? "bg-[var(--color-warning)]"
                        : item.isOk === true
                            ? "bg-[var(--color-success)]"
                            : "bg-[var(--color-muted)]"
                    }
        `} />

                {/* Label + qty */}
                <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium leading-snug ${item.isOk === false ? "text-[var(--color-warning)]" : "text-[var(--color-text-body)]"}`}>
                        {item.label}
                    </p>
                    {item.quantity != null && (
                        <p className="text-xs text-[var(--color-text-weak)] mt-0.5">
                            {t("checklist.qty", { n: item.quantity })}
                        </p>
                    )}
                </div>

                {/* OK / Issue */}
                <div className="flex gap-2 shrink-0">
                    <button
                        onClick={handleOk}
                        aria-pressed={item.isOk === true}
                        className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
              transition-all duration-150 active:scale-95
              ${item.isOk === true
                                ? "bg-[var(--color-success)] text-white shadow-sm"
                                : "bg-white border-2 border-[var(--color-success-border)] text-[var(--color-success)] hover:bg-[var(--color-success-bg)]"
                            }
            `}
                    >
                        <Check className="w-3.5 h-3.5" />
                        <span>{t("checklist.okButton")}</span>
                    </button>

                    <button
                        onClick={handleIssue}
                        aria-pressed={item.isOk === false}
                        className={`
              flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
              transition-all duration-150 active:scale-95
              ${item.isOk === false
                                ? "bg-[var(--color-warning)] text-white shadow-sm"
                                : "bg-white border-2 border-[var(--color-warning-border)] text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]"
                            }
            `}
                    >
                        <X className="w-3.5 h-3.5" />
                        <span>{t("checklist.issueButton")}</span>
                    </button>
                </div>
            </div>

            {/* Note textarea — expands only on Issue tap */}
            {showNote && (
                <div className="px-3 pb-3">
                    <textarea
                        autoFocus
                        value={item.notes}
                        onChange={(e) => onChange(sectionKey, item._id, { notes: e.target.value })}
                        placeholder={t("checklist.issuePlaceholder")}
                        rows={2}
                        className="
              w-full text-xs rounded-lg px-3 py-2 resize-none
              border border-[var(--color-warning-border)]
              bg-white placeholder:text-[var(--color-text-weak)]
              text-[var(--color-text-body)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]
            "
                    />
                </div>
            )}
        </div>
    );
}

// ─── SectionGroup ─────────────────────────────────────────────────────────────
// `t` received as prop, forwarded to CheckItem.

function SectionGroup({ section, onChange, t }) {
    const total = section.items.length;
    const passed = section.items.filter((it) => it.isOk === true).length;
    const issues = section.items.filter((it) => it.isOk === false).length;

    return (
        <div>
            <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-bold text-[var(--color-text-strong)]">
                    {section.sectionLabel}
                </h3>
                <div className="flex items-center gap-2">
                    {issues > 0 && (
                        <span className="text-xs font-semibold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full border border-[var(--color-warning-border)]">
                            {t("checklist.issueCount", { n: issues })}
                        </span>
                    )}
                    <span className="text-xs text-[var(--color-text-weak)]">
                        {t("checklist.itemsProgress", { checked: passed, total })}
                    </span>
                </div>
            </div>

            <div className="space-y-2">
                {section.items.map((item) => (
                    <CheckItem
                        key={item._id}
                        item={item}
                        sectionKey={section.sectionKey}
                        onChange={onChange}
                        t={t}
                    />
                ))}
            </div>
        </div>
    );
}

// ─── ChecklistView ────────────────────────────────────────────────────────────
// A real React component — uses useTranslation() directly.

function ChecklistView({ category, checklist, onBack, onSubmitSuccess }) {
    const meta = CATEGORY_META[category];
    const Icon = meta.icon;
    const { t } = useTranslation();

    const [sections, setSections] = useState(() =>
        checklist?.data?.sections
            ? JSON.parse(JSON.stringify(checklist.data.sections))
            : [],
    );
    const [overallNotes, setOverallNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const totalItems = countTotal(sections);
    const issueCount = countIssues(sections);

    function handleItemChange(sectionKey, itemId, patch) {
        setSections((prev) =>
            prev.map((sec) =>
                sec.sectionKey !== sectionKey
                    ? sec
                    : {
                        ...sec,
                        items: sec.items.map((it) =>
                            String(it._id) !== String(itemId) ? it : { ...it, ...patch },
                        ),
                    },
            ),
        );
    }

    async function handleSubmit() {
        if (submitting) return;
        setSubmitting(true);
        try {
            const res = await api.patch(
                `/api/checklists/${checklist.data._id}/submit`,
                { sections, overallNotes, status: "COMPLETED" },
            );
            onSubmitSuccess(res.data);
        } catch (err) {
            toast.error(err?.response?.data?.message ?? t("common.retry"));
        } finally {
            setSubmitting(false);
        }
    }

    if (!checklist?.data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
                <p className="text-sm text-[var(--color-text-sub)]">{t("checklist.selectLabel")}</p>
                <button onClick={onBack} className="text-sm font-semibold text-[var(--color-accent)] underline">
                    {t("common.back")}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        aria-label={t("common.back")}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text-body)]" />
                    </button>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                        <Icon className={`w-5 h-5 ${meta.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text-strong)] truncate">
                            {t(meta.labelKey)}
                        </p>
                        <p className="text-xs text-[var(--color-text-sub)]">
                            {t("checklist.itemsProgress", { checked: totalItems, total: totalItems })}
                        </p>
                    </div>

                    {issueCount > 0 && (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                            {issueCount} ⚠
                        </span>
                    )}
                </div>

                <ProgressBar
                    value={sections.reduce(
                        (acc, s) => acc + s.items.filter((i) => i.isOk !== undefined).length,
                        0,
                    )}
                    max={totalItems}
                    className="mt-2.5"
                />
            </div>

            {/* Scrollable sections + overall notes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {sections.map((sec) => (
                    <SectionGroup
                        key={sec.sectionKey}
                        section={sec}
                        onChange={handleItemChange}
                        t={t}
                    />
                ))}

                <div>
                    <label className="block text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-2">
                        <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
                        {t("checklist.overallNotesLabel")}
                    </label>
                    <textarea
                        value={overallNotes}
                        onChange={(e) => setOverallNotes(e.target.value)}
                        placeholder={t("checklist.overallNotesPlaceholder")}
                        rows={3}
                        className="
              w-full text-sm rounded-xl px-4 py-3 resize-none
              border-2 border-[var(--color-border)]
              bg-[var(--color-surface-raised)]
              placeholder:text-[var(--color-text-weak)]
              text-[var(--color-text-body)]
              focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:border-[var(--color-accent)]
            "
                    />
                </div>
            </div>

            {/* Sticky submit footer */}
            <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-4">
                {issueCount > 0 && (
                    <p className="text-xs text-center text-[var(--color-warning)] mb-3 font-medium">
                        ⚠ {t("checklist.submitWithIssues", { count: issueCount })}
                    </p>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className={`
            w-full py-4 rounded-2xl text-sm font-bold tracking-wide
            flex items-center justify-center gap-2
            transition-all duration-150 active:scale-[0.98]
            ${submitting ? "opacity-60 cursor-not-allowed" : ""}
            ${issueCount > 0
                            ? "bg-[var(--color-warning)] text-white hover:opacity-90"
                            : "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]"
                        }
          `}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t("checklist.submitting")}
                        </>
                    ) : issueCount > 0 ? (
                        t("checklist.submitWithIssues", { count: issueCount })
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            {t("checklist.submitAllClear")}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

// ─── ResultScreen ─────────────────────────────────────────────────────────────

function ResultScreen({ result, onNewCheck, onBack }) {
    const { data, autoCreatedTasks = [] } = result;
    const hasIssues = data.hasIssues;
    const { t } = useTranslation();
    const passRate = data.passRate ?? Math.round((data.passedItems / data.totalItems) * 100);

    return (
        <div className="flex flex-col items-center px-6 py-10 gap-6 text-center">

            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${hasIssues ? "bg-[var(--color-warning-bg)]" : "bg-[var(--color-success-bg)]"}`}>
                {hasIssues
                    ? <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
                    : <PartyPopper className="w-10 h-10 text-[var(--color-success)]" />
                }
            </div>

            <div>
                <h2 className="text-xl font-bold text-[var(--color-text-strong)]">
                    {hasIssues ? t("checklist.resultTitle_issues") : t("checklist.resultTitle_clear")}
                </h2>
                <p className="text-sm text-[var(--color-text-sub)] mt-1.5">
                    {hasIssues
                        ? t("checklist.resultSub_issues", { count: autoCreatedTasks.length })
                        : t("checklist.resultSub_clear")
                    }
                </p>
            </div>

            <div className={`
        px-5 py-2 rounded-full text-sm font-bold border
        ${hasIssues
                    ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]"
                    : "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]"
                }
      `}>
                {t("checklist.passRate", { n: passRate })}
            </div>

            {autoCreatedTasks.length > 0 && (
                <div className="w-full rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-4 text-left">
                    <p className="text-xs font-bold text-[var(--color-warning)] uppercase tracking-wider mb-3">
                        {t("checklist.autoTasksTitle")}
                    </p>
                    <div className="space-y-2">
                        {autoCreatedTasks.map((task) => (
                            <div key={task._id} className="flex items-center gap-2.5">
                                <Wrench className="w-4 h-4 text-[var(--color-warning)] shrink-0" />
                                <p className="text-sm text-[var(--color-text-body)] truncate">{task.title}</p>
                                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-white text-[var(--color-warning)] border border-[var(--color-warning-border)] shrink-0">
                                    {task.priority}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="w-full flex flex-col gap-3 mt-2">
                <button
                    onClick={onNewCheck}
                    className="w-full py-4 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                    {t("checklist.btnNewCheck")}
                </button>
                <button
                    onClick={onBack}
                    className="w-full py-4 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-body)] text-sm font-bold hover:bg-[var(--color-accent-light)] transition-colors"
                >
                    {t("checklist.btnDashboard")}
                </button>
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DailyChecklistPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [view, setView] = useState("picker");
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [activeChecklist, setActiveChecklist] = useState(null);
    const [submitResult, setSubmitResult] = useState(null);
    const [todaysChecklists, setTodaysChecklists] = useState([]);
    const [loadingChecklists, setLoadingChecklists] = useState(true);
    const [creating, setCreating] = useState(false);

    const propertyId = OWNERSHIP_ENTITY_ID;

    useEffect(() => {
        if (!propertyId) { setLoadingChecklists(false); return; }
        const controller = new AbortController();

        async function load() {
            try {
                setLoadingChecklists(true);
                const today = todayISO();
                const res = await api.get("/api/checklists", {
                    params: { propertyId, startDate: today, endDate: today, limit: 50 },
                    signal: controller.signal,
                });
                setTodaysChecklists(res.data?.data ?? []);
            } catch (err) {
                if (err.name === "CanceledError" || err.name === "AbortError") return;
                console.error("[DailyChecklistPage] load failed:", err);
            } finally {
                setLoadingChecklists(false);
            }
        }

        load();
        return () => controller.abort();
    }, [OWNERSHIP_ENTITY_ID]);

    const completedCategories = useMemo(
        () => todaysChecklists.filter((c) => c.status === "COMPLETED").map((c) => c.category),
        [todaysChecklists],
    );
    const doneCount = completedCategories.length;
    const totalCount = ALL_CATEGORIES.length;

    async function handleCategorySelect(cat, existing) {
        setSelectedCategory(cat);
        if (existing && existing.status !== "COMPLETED") {
            try {
                const res = await api.get(`/api/checklists/${existing._id}`);
                setActiveChecklist(res.data);
                setView("checklist");
            } catch { toast.error(t("common.retry")); }
            return;
        }
        if (existing?.status === "COMPLETED") {
            toast.info(t("checklist.checklistSubmitted"));
            return;
        }
        setCreating(true);
        try {
            const res = await api.post("/api/checklists/create", {
                propertyId: OWNERSHIP_ENTITY_ID, category: cat, checklistType: "DAILY",
                checkDate: new Date().toISOString(),
            });
            const fullRes = await api.get(`/api/checklists/${res.data.data._id}`);
            setActiveChecklist(fullRes.data);
            setView("checklist");
        } catch (err) {
            toast.error(err?.response?.data?.message ?? t("common.retry"));
        } finally { setCreating(false); }
    }

    function handleSubmitSuccess(result) {
        setSubmitResult(result);
        setTodaysChecklists((prev) => {
            const existing = prev.find((c) => c._id === result.data._id);
            return existing
                ? prev.map((c) => (c._id === result.data._id ? result.data : c))
                : [...prev, result.data];
        });
        setView("result");
    }

    function handleNewCheck() {
        setView("picker");
        setSelectedCategory(null);
        setActiveChecklist(null);
        setSubmitResult(null);
    }

    // Time-aware greeting — keys should be added to i18n.js; fallbacks ensure
    // nothing renders blank if they aren't yet present.
    const hour = new Date().getHours();
    const greeting = t(
        hour < 12 ? "dashboard.greetingMorning" : hour < 17 ? "dashboard.greetingAfternoon" : "dashboard.greetingEvening",
        hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening",
    );

    if (!propertyId && !loadingChecklists) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
                <p className="text-sm font-semibold text-[var(--color-text-body)]">
                    {t("dashboard.noProperty", "No property assigned to your account.")}
                </p>
                <p className="text-xs text-[var(--color-text-sub)]">
                    {t("dashboard.contactAdmin", "Please contact your administrator.")}
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)] flex flex-col max-w-2xl mx-auto">

            {/* ── Page header — picker screen only ───────────────────────────────── */}
            {view === "picker" && (
                <div className="px-4 pt-5 pb-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            aria-label={t("common.back")}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-[var(--color-text-body)]" />
                        </button>

                        <div>
                            <h1 className="text-lg font-bold text-[var(--color-text-strong)]">
                                {t("checklist.pageTitle")}
                            </h1>
                            <p className="text-xs text-[var(--color-text-sub)]">
                                {t("checklist.pageSubtitle")}
                            </p>
                        </div>

                        <button
                            onClick={() => window.location.reload()}
                            aria-label={t("common.refresh")}
                            className="ml-auto w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-[var(--color-text-sub)]" />
                        </button>
                    </div>

                    {/* Greeting banner */}
                    <div className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 flex items-center gap-3 mb-4">
                        <div>
                            <p className="text-white/80 text-xs">{greeting}</p>
                            <p className="text-white font-bold text-sm">
                                {user?.name ?? t("sidebar.staff", "Staff")}
                            </p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-white font-bold text-2xl tabular-nums">{doneCount}/{totalCount}</p>
                            <p className="text-white/70 text-xs">{t("checklist.doneToday")}</p>
                        </div>
                    </div>

                    {/* Progress strip */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-semibold text-[var(--color-text-sub)]">
                                {t("dashboard.progressTitle")}
                            </p>
                            <p className="text-xs font-bold text-[var(--color-accent)]">
                                {doneCount === totalCount
                                    ? `${t("common.allClear")} 🎉`
                                    : t("dashboard.progressRemaining", { n: totalCount - doneCount })
                                }
                            </p>
                        </div>
                        <ProgressBar value={doneCount} max={totalCount} />
                    </div>
                </div>
            )}

            {/* ── Content ────────────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col">

                {/* Creating overlay */}
                {creating && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                        <div className="bg-[var(--color-surface-raised)] rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                            <p className="text-sm font-semibold text-[var(--color-text-body)]">
                                {t("common.loading")}
                            </p>
                        </div>
                    </div>
                )}

                {view === "picker" && (
                    <div className="px-4 py-4">
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)] mb-4">
                            <ClipboardList className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                            <p className="text-xs text-[var(--color-accent)] font-medium">
                                {t("checklist.selectLabel")}
                            </p>
                        </div>

                        {/* t passed as prop — CategoryPicker is outside hook scope */}
                        <CategoryPicker
                            checklists={todaysChecklists}
                            onSelect={handleCategorySelect}
                            completedCategories={completedCategories}
                            loading={loadingChecklists}
                            t={t}
                        />
                    </div>
                )}

                {view === "checklist" && activeChecklist && (
                    <ChecklistView
                        category={selectedCategory}
                        checklist={activeChecklist}
                        onBack={() => setView("picker")}
                        onSubmitSuccess={handleSubmitSuccess}
                    />
                )}

                {view === "result" && submitResult && (
                    <ResultScreen
                        result={submitResult}
                        onNewCheck={handleNewCheck}
                        onBack={() => navigate(-1)}
                    />
                )}
            </div>
        </div>
    );
}