/**
 * DailyChecklistPage.jsx  – Exception-based model
 *
 * UX overhaul: staff only acts on exceptions, not on normality.
 *  - Items default to isOk: null ("not yet walked")
 *  - Section-level "All Clear ✓" bulk action = 1 tap per section
 *  - Individual "Issue" button per item (no OK button needed)
 *  - 3 visual states: unreviewed (gray) / cleared (green) / issue (amber)
 *  - Submit gate: null treated as OK on submit (no backend change required)
 *  - Audit trail preserved: null ≠ true (supervisor can see what was explicitly walked)
 *
 * Backend: zero changes. Submit delta logic already treats null → true.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
    Image,
    Plus,
    AlertCircle,
    Calendar,
    Trash2,
    Upload,
    ShieldCheck,
    Eye,
    EyeOff,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import api from "../../plugins/axios";
import { useAuth } from "../context/AuthContext";
import { getTodayNepali, NEPALI_MONTH_NAMES, NEPALI_MONTH_NAMES_NP } from "../../utils/nepaliDate";

function getNepaliTodayClient() {
    const today = getTodayNepali();
    return {
        bsYear: today.year,
        bsMonth: today.month,
        bsDay: today.day,
        nepaliISO: today.isoString,
        monthName: today.monthName,
        monthNameNp: today.monthNameNp,
    };
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_META = {
    FIRE: {
        icon: Flame,
        labelKey: "checklist.categories.FIRE",
        descKey: "checklist.categoryDesc.FIRE",
        urgency: "critical",
        iconBg: "bg-red-50",
        iconColor: "text-red-600",
        color: "#ef4444",
    },
    WATER_TANK: {
        icon: Droplets,
        labelKey: "checklist.categories.WATER_TANK",
        descKey: "checklist.categoryDesc.WATER_TANK",
        urgency: "high",
        iconBg: "bg-blue-50",
        iconColor: "text-blue-600",
        color: "#3b82f6",
    },
    ELECTRICAL: {
        icon: Zap,
        labelKey: "checklist.categories.ELECTRICAL",
        descKey: "checklist.categoryDesc.ELECTRICAL",
        urgency: "high",
        iconBg: "bg-yellow-50",
        iconColor: "text-yellow-600",
        color: "#f59e0b",
    },
    CCTV: {
        icon: Camera,
        labelKey: "checklist.categories.CCTV",
        descKey: "checklist.categoryDesc.CCTV",
        urgency: null,
        iconBg: "bg-purple-50",
        iconColor: "text-purple-600",
        color: "#8b5cf6",
    },
    PARKING: {
        icon: Car,
        labelKey: "checklist.categories.PARKING",
        descKey: "checklist.categoryDesc.PARKING",
        urgency: null,
        iconBg: "bg-stone-100",
        iconColor: "text-stone-600",
        color: "#78716c",
    },
    SANITARY: {
        icon: Waves,
        labelKey: "checklist.categories.SANITARY",
        descKey: "checklist.categoryDesc.SANITARY",
        urgency: null,
        iconBg: "bg-cyan-50",
        iconColor: "text-cyan-600",
        color: "#06b6d4",
    },
    COMMON_AREA: {
        icon: LayoutGrid,
        labelKey: "checklist.categories.COMMON_AREA",
        descKey: "checklist.categoryDesc.COMMON_AREA",
        urgency: null,
        iconBg: "bg-emerald-50",
        iconColor: "text-emerald-600",
        color: "#10b981",
    },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_META);
const OWNERSHIP_ENTITY_ID = "69b11f16ce3a098bb6ba5424";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
    return new Date().toISOString().split("T")[0];
}

function isChecklistFromToday(checklist) {
    if (!checklist?.checkDate) return false;
    const today = todayISO();
    const checkDate = new Date(checklist.checkDate).toISOString().split("T")[0];
    return checkDate === today;
}

function isCompletedToday(checklist) {
    if (!checklist || checklist.status !== "COMPLETED") return false;
    return isChecklistFromToday(checklist);
}

// Issues = explicitly marked false
function countIssues(sections) {
    return sections.reduce((acc, sec) => acc + sec.items.filter((it) => it.isOk === false).length, 0);
}

function countTotal(sections) {
    return sections.reduce((acc, sec) => acc + sec.items.length, 0);
}

// Reviewed = explicitly walked (true OR false), NOT null
function countReviewed(sections) {
    return sections.reduce(
        (acc, sec) => acc + sec.items.filter((it) => it.isOk === true || it.isOk === false).length,
        0,
    );
}

// Section is fully walked when every item is non-null
function isSectionReviewed(section) {
    return section.items.every((it) => it.isOk !== null);
}

function countReviewedSections(sections) {
    return sections.filter(isSectionReviewed).length;
}

// ─── ProgressBar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, max, className = "", color }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className={`h-1.5 rounded-full bg-[var(--color-muted)] overflow-hidden ${className}`}>
            <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, background: color ?? "var(--color-accent)" }}
            />
        </div>
    );
}

// ─── NepaliDateBadge ──────────────────────────────────────────────────────────

function NepaliDateBadge({ bsYear, bsMonth, bsDay, monthName }) {
    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)]">
            <Calendar className="w-3 h-3 text-[var(--color-accent)]" />
            <span className="text-xs font-semibold text-[var(--color-accent)]">
                {bsDay} {monthName} {bsYear} BS
            </span>
        </div>
    );
}

// ─── IssueDialog ──────────────────────────────────────────────────────────────

function IssueDialog({ item, onConfirm, onCancel }) {
    const [description, setDescription] = useState(item.notes ?? "");
    const [photos, setPhotos] = useState(item.photos ?? []);
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        setTimeout(() => textareaRef.current?.focus(), 100);
    }, []);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    function handleAddPhotos(files) {
        const remaining = 3 - photos.length;
        const toProcess = Array.from(files).slice(0, remaining);
        toProcess.forEach((file) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                setPhotos((prev) => prev.length < 3 ? [...prev, { uri: e.target.result, name: file.name, type: file.type }] : prev);
            };
            reader.readAsDataURL(file);
        });
    }

    function handleRemovePhoto(idx) {
        setPhotos((prev) => prev.filter((_, i) => i !== idx));
    }

    function handleConfirm() {
        if (!description.trim()) {
            textareaRef.current?.focus();
            textareaRef.current?.classList.add("ring-2", "ring-red-400");
            setTimeout(() => textareaRef.current?.classList.remove("ring-2", "ring-red-400"), 1200);
            return;
        }
        onConfirm({ notes: description.trim(), photos, isOk: false });
    }

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                className="bg-[var(--color-surface)] rounded-t-3xl max-h-[92dvh] flex flex-col overflow-hidden"
                style={{ animation: "slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1) both" }}
            >
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-10 h-1 rounded-full bg-[var(--color-border)]" />
                </div>

                <div className="px-5 pb-4 pt-2 flex items-start gap-3 shrink-0 border-b border-[var(--color-border)]">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text-strong)] leading-snug">
                            Report Issue
                        </p>
                        <p className="text-xs text-[var(--color-text-sub)] mt-0.5 line-clamp-2 break-words">
                            {item.label}
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-raised)] hover:bg-[var(--color-muted)] transition-colors shrink-0"
                        aria-label="Cancel"
                    >
                        <X className="w-4 h-4 text-[var(--color-text-sub)]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-2">
                            Issue Description <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe what's wrong… e.g. '2 bulbs fused, right side of corridor dark'"
                            rows={4}
                            className="
                                w-full text-sm rounded-xl px-4 py-3 resize-none
                                border-2 border-[var(--color-border)]
                                bg-[var(--color-surface-raised)]
                                placeholder:text-[var(--color-text-weak)]
                                text-[var(--color-text-body)]
                                focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100
                                transition-all
                            "
                        />
                        {!description.trim() && (
                            <p className="text-xs text-[var(--color-text-weak)] mt-1.5 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Description is required to log this issue
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-2">
                            Photos <span className="text-[var(--color-text-weak)] font-normal normal-case tracking-normal">({photos.length}/3)</span>
                        </label>

                        <div className="flex gap-2.5 flex-wrap">
                            {photos.map((photo, idx) => (
                                <div
                                    key={idx}
                                    className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-muted)] shrink-0"
                                    style={{ animation: `fadeIn 0.2s ease both` }}
                                >
                                    <img src={photo.uri} alt={`Issue photo ${idx + 1}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => handleRemovePhoto(idx)}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500 transition-colors"
                                        aria-label="Remove photo"
                                    >
                                        <Trash2 className="w-3 h-3 text-white" />
                                    </button>
                                </div>
                            ))}

                            {photos.length < 3 && (
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="
                                            w-24 h-24 rounded-xl border-2 border-dashed border-[var(--color-border)]
                                            bg-[var(--color-surface-raised)] hover:border-[var(--color-accent-mid)]
                                            hover:bg-[var(--color-accent-light)] transition-all
                                            flex flex-col items-center justify-center gap-1.5 shrink-0
                                        "
                                        aria-label="Take photo"
                                    >
                                        <Camera className="w-5 h-5 text-[var(--color-accent)]" />
                                        <span className="text-[10px] font-semibold text-[var(--color-text-sub)]">Camera</span>
                                    </button>

                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="
                                            w-24 h-24 rounded-xl border-2 border-dashed border-[var(--color-border)]
                                            bg-[var(--color-surface-raised)] hover:border-[var(--color-accent-mid)]
                                            hover:bg-[var(--color-accent-light)] transition-all
                                            flex flex-col items-center justify-center gap-1.5 shrink-0
                                        "
                                        aria-label="Upload photo"
                                    >
                                        <Upload className="w-5 h-5 text-[var(--color-text-sub)]" />
                                        <span className="text-[10px] font-semibold text-[var(--color-text-sub)]">Gallery</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleAddPhotos(e.target.files)} />
                        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleAddPhotos(e.target.files)} />

                        <p className="text-xs text-[var(--color-text-weak)] mt-2">
                            Up to 3 photos. Camera for live shot, gallery to upload existing.
                        </p>
                    </div>

                    <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-200">
                        <Wrench className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 leading-relaxed">
                            A <strong>repair task</strong> will be automatically created and assigned when this issue is submitted.
                        </p>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--color-border)] flex gap-3 shrink-0 bg-[var(--color-surface)]">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-3.5 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-body)] text-sm font-bold hover:bg-[var(--color-muted)] transition-colors active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!description.trim()}
                        className={`
                            flex-[2] py-3.5 rounded-2xl text-white text-sm font-bold
                            flex items-center justify-center gap-2
                            transition-all active:scale-[0.98]
                            ${description.trim()
                                ? "bg-red-500 hover:bg-red-600 shadow-sm shadow-red-200"
                                : "bg-[var(--color-muted)] text-[var(--color-text-weak)] cursor-not-allowed"
                            }
                        `}
                    >
                        <AlertCircle className="w-4 h-4" />
                        Log Issue
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0.6; }
                    to { transform: translateY(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.85); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

// ─── CategoryPicker ───────────────────────────────────────────────────────────

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
                const checklist = checklists.find((c) => c.category === cat);
                const isDone = checklist && isCompletedToday(checklist);
                const isFromToday = checklist && isChecklistFromToday(checklist);
                const isInProgress = checklist && checklist.status !== "COMPLETED" && isFromToday;

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
                                : isInProgress
                                    ? "border-amber-300 bg-amber-50"
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
                                        {t("checklist.urgencyLabel.critical", "Critical")}
                                    </span>
                                )}
                                {isInProgress && !isDone && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 uppercase tracking-wide">
                                        In Progress
                                    </span>
                                )}
                            </div>
                            <p className={`text-xs mt-0.5 truncate ${isDone ? "text-[var(--color-success)]" : "text-[var(--color-text-sub)]"}`}>
                                {isDone ? `${t("checklist.doneToday", "Done today")} ✓` : t(meta.descKey, cat)}
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
// Exception-only model:
//   null  → not yet walked (neutral, shows "Issue?" prompt)
//   true  → explicitly cleared (green, via bulk or item-level undo)
//   false → issue logged (amber, opens IssueDialog)
//
// The OK button is removed. Staff only acts on exceptions.
// If they tapped Issue by mistake, they can dismiss the dialog and the item
// stays in its previous state. If they want to clear a previously flagged item
// they tap the green "Clear" chip that appears on a false item.

function CheckItem({ item, sectionKey, onChange, t }) {
    const [dialogOpen, setDialogOpen] = useState(false);

    function handleIssueClick() {
        setDialogOpen(true);
    }

    function handleClearIssue() {
        // Revert a flagged item back to "reviewed OK"
        onChange(sectionKey, item._id, { isOk: true, notes: "", photos: [] });
    }

    function handleDialogConfirm({ notes, photos }) {
        onChange(sectionKey, item._id, { isOk: false, notes, photos });
        setDialogOpen(false);
    }

    function handleDialogCancel() {
        setDialogOpen(false);
    }

    const hasPhotos = item.photos?.length > 0;
    const isIssue = item.isOk === false;
    const isCleared = item.isOk === true;
    const isPending = item.isOk === null;

    return (
        <>
            <div className={`
                rounded-xl border-2 overflow-hidden transition-all duration-200
                ${isIssue
                    ? "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]"
                    : isCleared
                        ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]"
                        : "border-[var(--color-border)] bg-[var(--color-surface-raised)]"
                }
            `}>
                <div className="flex items-center gap-3 p-3">
                    {/* Status dot */}
                    <div className={`
                        w-2 h-2 rounded-full shrink-0 mt-0.5 transition-colors duration-300
                        ${isIssue
                            ? "bg-[var(--color-warning)]"
                            : isCleared
                                ? "bg-[var(--color-success)]"
                                : "bg-[var(--color-border)]"
                        }
                    `} />

                    {/* Label + qty */}
                    <div className="flex-1 min-w-0">
                        <p className={`
                            text-sm font-medium leading-snug
                            ${isIssue
                                ? "text-[var(--color-warning)]"
                                : isCleared
                                    ? "text-[var(--color-success)]"
                                    : "text-[var(--color-text-body)]"
                            }
                        `}>
                            {item.label}
                        </p>
                        {item.quantity != null && (
                            <p className="text-xs text-[var(--color-text-weak)] mt-0.5">
                                qty: {item.quantity}
                            </p>
                        )}
                    </div>

                    {/* Action area — context-sensitive */}
                    <div className="flex gap-2 shrink-0 items-center">

                        {/* Pending: show Issue button only */}
                        {isPending && (
                            <button
                                onClick={handleIssueClick}
                                className="
                                    flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
                                    bg-white border-2 border-[var(--color-warning-border)]
                                    text-[var(--color-warning)] hover:bg-[var(--color-warning-bg)]
                                    transition-all duration-150 active:scale-95
                                "
                            >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>{t("checklist.issueButton", "Issue?")}</span>
                            </button>
                        )}

                        {/* Cleared: show subtle "flag" option in case they need to reverse */}
                        {isCleared && (
                            <button
                                onClick={handleIssueClick}
                                className="
                                    flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
                                    bg-[var(--color-success-bg)] border-2 border-[var(--color-success-border)]
                                    text-[var(--color-success)] hover:border-[var(--color-warning-border)]
                                    hover:bg-[var(--color-warning-bg)] hover:text-[var(--color-warning)]
                                    transition-all duration-150 active:scale-95 group
                                "
                                title="Flag an issue on this item"
                            >
                                <Check className="w-3.5 h-3.5 group-hover:hidden" />
                                <AlertCircle className="w-3.5 h-3.5 hidden group-hover:block" />
                                <span className="group-hover:hidden">{t("checklist.okButton", "OK")}</span>
                                <span className="hidden group-hover:inline">{t("checklist.issueButton", "Issue?")}</span>
                            </button>
                        )}

                        {/* Issue logged: show clear + edit */}
                        {isIssue && (
                            <div className="flex gap-1.5">
                                <button
                                    onClick={handleClearIssue}
                                    className="
                                        flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold
                                        bg-white border-2 border-[var(--color-success-border)]
                                        text-[var(--color-success)] hover:bg-[var(--color-success-bg)]
                                        transition-all duration-150 active:scale-95
                                    "
                                    title="Mark as OK"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleIssueClick}
                                    className="
                                        flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
                                        bg-[var(--color-warning)] text-white shadow-sm
                                        transition-all duration-150 active:scale-95
                                    "
                                >
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    <span>Edit</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Issue summary row */}
                {isIssue && (item.notes || hasPhotos) && (
                    <div className="px-3 pb-3 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                            {item.notes && (
                                <p className="text-xs text-[var(--color-warning)] leading-relaxed line-clamp-2">
                                    {item.notes}
                                </p>
                            )}
                        </div>
                        {hasPhotos && (
                            <div className="flex gap-1 shrink-0">
                                {item.photos.slice(0, 3).map((p, i) => (
                                    <div key={i} className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--color-warning-border)] shrink-0">
                                        <img src={p.uri} alt="" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {dialogOpen && (
                <IssueDialog
                    item={item}
                    onConfirm={handleDialogConfirm}
                    onCancel={handleDialogCancel}
                />
            )}
        </>
    );
}

// ─── SectionGroup ─────────────────────────────────────────────────────────────
// Now with "All Clear ✓" bulk action.
// onSectionClear(sectionKey) — sets all null items in this section to true.

function SectionGroup({ section, onChange, onSectionClear, t }) {
    const total = section.items.length;
    const cleared = section.items.filter((it) => it.isOk === true).length;
    const issues = section.items.filter((it) => it.isOk === false).length;
    const pending = section.items.filter((it) => it.isOk === null).length;
    const isFullyReviewed = pending === 0;

    return (
        <div>
            {/* Section header */}
            <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-[var(--color-text-strong)] truncate">
                        {section.sectionLabel}
                    </h3>
                    {/* Reviewed state indicator */}
                    {isFullyReviewed && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)] uppercase tracking-wide shrink-0">
                            Walked ✓
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {issues > 0 && (
                        <span className="text-xs font-semibold text-[var(--color-warning)] bg-[var(--color-warning-bg)] px-2 py-0.5 rounded-full border border-[var(--color-warning-border)]">
                            {issues} ⚠
                        </span>
                    )}

                    {/* Progress: x/total reviewed */}
                    <span className="text-xs text-[var(--color-text-weak)]">
                        {total - pending}/{total}
                    </span>

                    {/* All Clear — only show when there are still pending items */}
                    {pending > 0 && (
                        <button
                            onClick={() => onSectionClear(section.sectionKey)}
                            className="
                                flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                text-xs font-bold
                                bg-[var(--color-success-bg)] text-[var(--color-success)]
                                border-2 border-[var(--color-success-border)]
                                hover:bg-[var(--color-success)] hover:text-white
                                transition-all duration-150 active:scale-95
                            "
                            title={`Mark all ${pending} remaining items as OK`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            All Clear
                        </button>
                    )}
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

function ChecklistView({ category, checklist, onBack, onSubmitSuccess }) {
    const meta = CATEGORY_META[category];
    const Icon = meta.icon;
    const { t } = useTranslation();
    const nepaliDate = getNepaliTodayClient();

    const [sections, setSections] = useState(() =>
        checklist?.data?.sections
            ? JSON.parse(JSON.stringify(checklist.data.sections)).map((s) => ({
                ...s,
                items: s.items.map((it) => ({
                    ...it,
                    isOk: null,   // ← always start null (not yet walked)
                    photos: [],
                    notes: "",
                })),
            }))
            : [],
    );
    const [overallNotes, setOverallNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const totalItems = countTotal(sections);
    const issueCount = countIssues(sections);
    const reviewedCount = countReviewed(sections);
    const reviewedSections = countReviewedSections(sections);
    const totalSections = sections.length;
    const pendingCount = totalItems - reviewedCount;

    // Per-item change handler (unchanged API)
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

    // ── NEW: section-level All Clear ──────────────────────────────────────────
    // Sets isOk: true on all items that are still null in this section.
    // Items already set to false (issues) are intentionally left unchanged.
    function handleSectionAllClear(sectionKey) {
        setSections((prev) =>
            prev.map((sec) =>
                sec.sectionKey !== sectionKey
                    ? sec
                    : {
                        ...sec,
                        items: sec.items.map((it) =>
                            it.isOk === null ? { ...it, isOk: true, notes: "", photos: [] } : it,
                        ),
                    },
            ),
        );
    }

    async function handleSubmit() {
        if (submitting) return;
        setSubmitting(true);
        try {
            // Submit logic unchanged — null treated as OK on the server side too.
            // Only delta (failed or noted items) is sent.
            const itemResults = [];
            for (const sec of sections) {
                for (const item of sec.items) {
                    const effectiveIsOk = item.isOk === null ? true : item.isOk;
                    const hasNote = item.notes?.trim();
                    if (!effectiveIsOk || hasNote) {
                        itemResults.push({
                            itemId: item._id,
                            sectionKey: sec.sectionKey,
                            isOk: effectiveIsOk,
                            notes: item.notes?.trim() ?? "",
                        });
                    }
                }
            }

            const res = await api.patch(
                `/api/checklists/results/${checklist.data._id}/submit`,
                {
                    itemResults,
                    overallNotes,
                    status: "COMPLETED",
                    nepaliDate: nepaliDate.nepaliISO,
                    nepaliMonth: nepaliDate.bsMonth,
                    nepaliYear: nepaliDate.bsYear,
                },
            );
            onSubmitSuccess(res.data);
        } catch (err) {
            toast.error(err?.response?.data?.message ?? t("common.retry", "Please try again"));
        } finally {
            setSubmitting(false);
        }
    }

    if (!checklist?.data) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
                <p className="text-sm text-[var(--color-text-sub)]">{t("checklist.selectLabel", "Select a category")}</p>
                <button onClick={onBack} className="text-sm font-semibold text-[var(--color-accent)] underline">
                    {t("common.back", "Back")}
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full">

            {/* Sticky header */}
            <div className="sticky top-0 z-20 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 py-3">
                <div className="flex items-center gap-3 mb-2">
                    <button
                        onClick={onBack}
                        aria-label={t("common.back", "Back")}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5 text-[var(--color-text-body)]" />
                    </button>

                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                        <Icon className={`w-5 h-5 ${meta.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[var(--color-text-strong)] truncate">
                            {t(meta.labelKey, category)}
                        </p>
                        <p className="text-xs text-[var(--color-text-sub)]">
                            {nepaliDate.bsDay} {nepaliDate.monthName} {nepaliDate.bsYear} BS
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {issueCount > 0 && (
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                                {issueCount} ⚠
                            </span>
                        )}
                        {/* Section progress pill */}
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--color-surface-raised)] text-[var(--color-text-sub)] border border-[var(--color-border)]">
                            {reviewedSections}/{totalSections} sections
                        </span>
                    </div>
                </div>

                {/* Progress: item-level granularity */}
                <div className="flex items-center gap-2">
                    <ProgressBar
                        value={reviewedCount}
                        max={totalItems}
                        className="flex-1 mt-1"
                        color={issueCount > 0 ? "var(--color-warning)" : meta.color}
                    />
                    <span className="text-xs font-semibold text-[var(--color-text-sub)] shrink-0">
                        {pendingCount > 0 ? `${pendingCount} left` : "All walked ✓"}
                    </span>
                </div>
            </div>

            {/* Hint banner — shown only when nothing has been reviewed yet */}
            {reviewedCount === 0 && (
                <div className="mx-4 mt-4 flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)]">
                    <Eye className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                    <p className="text-xs text-[var(--color-accent)] font-medium leading-relaxed">
                        Walk each section and tap <strong>All Clear</strong> if everything looks fine. Only flag items with actual issues.
                    </p>
                </div>
            )}

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
                {sections.map((sec) => (
                    <SectionGroup
                        key={sec.sectionKey}
                        section={sec}
                        onChange={handleItemChange}
                        onSectionClear={handleSectionAllClear}
                        t={t}
                    />
                ))}

                {/* Overall notes */}
                <div>
                    <label className="block text-xs font-bold text-[var(--color-text-sub)] uppercase tracking-wider mb-2">
                        <MessageSquare className="w-3.5 h-3.5 inline mr-1.5" />
                        {t("checklist.overallNotesLabel", "Overall Notes")}
                    </label>
                    <textarea
                        value={overallNotes}
                        onChange={(e) => setOverallNotes(e.target.value)}
                        placeholder={t("checklist.overallNotesPlaceholder", "Any general observations for this check…")}
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

                <div className="h-4" />
            </div>

            {/* Sticky submit footer */}
            <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] px-4 py-4">

                {/* Pending items warning */}
                {pendingCount > 0 && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                        <EyeOff className="w-3.5 h-3.5 text-[var(--color-text-sub)] shrink-0" />
                        <p className="text-xs text-[var(--color-text-sub)] font-medium">
                            {pendingCount} item{pendingCount > 1 ? "s" : ""} not yet walked — will be treated as OK on submit
                        </p>
                    </div>
                )}

                {issueCount > 0 && (
                    <div className="flex items-center gap-2 mb-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                        <Wrench className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <p className="text-xs text-amber-800 font-medium">
                            {issueCount} issue{issueCount > 1 ? "s" : ""} — {issueCount} repair task{issueCount > 1 ? "s" : ""} will be auto-created
                        </p>
                    </div>
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
                            {t("checklist.submitting", "Submitting…")}
                        </>
                    ) : issueCount > 0 ? (
                        <>
                            <AlertCircle className="w-4 h-4" />
                            Submit with {issueCount} Issue{issueCount > 1 ? "s" : ""}
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-4 h-4" />
                            {t("checklist.submitAllClear", "Submit – All Clear")}
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
    const passRate = data.passRate ?? (data.totalItems > 0 ? Math.round((data.passedItems / data.totalItems) * 100) : 0);
    const nepaliDate = getNepaliTodayClient();

    const PRIORITY_COLORS = {
        Urgent: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
        High: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
        Medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
        Low: { bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200" },
    };

    return (
        <div className="flex flex-col px-5 py-8 gap-5">
            <div className="flex flex-col items-center text-center gap-3">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center ${hasIssues ? "bg-[var(--color-warning-bg)]" : "bg-[var(--color-success-bg)]"}`}>
                    {hasIssues
                        ? <AlertTriangle className="w-10 h-10 text-[var(--color-warning)]" />
                        : <PartyPopper className="w-10 h-10 text-[var(--color-success)]" />
                    }
                </div>

                <div>
                    <h2 className="text-xl font-bold text-[var(--color-text-strong)]">
                        {hasIssues ? t("checklist.resultTitle_issues", "Issues Logged") : t("checklist.resultTitle_clear", "All Clear!")}
                    </h2>
                    <p className="text-sm text-[var(--color-text-sub)] mt-1">
                        {hasIssues
                            ? `${autoCreatedTasks.length} repair task${autoCreatedTasks.length !== 1 ? "s" : ""} auto-created`
                            : t("checklist.resultSub_clear", "No issues found. Great work!")
                        }
                    </p>
                </div>

                <NepaliDateBadge
                    bsYear={nepaliDate.bsYear}
                    bsMonth={nepaliDate.bsMonth}
                    bsDay={nepaliDate.bsDay}
                    monthName={nepaliDate.monthName}
                />

                <div className={`
                    px-5 py-2 rounded-full text-sm font-bold border
                    ${hasIssues
                        ? "bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]"
                        : "bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]"
                    }
                `}>
                    {passRate}% Pass Rate · {data.passedItems}/{data.totalItems} items OK
                </div>
            </div>

            {autoCreatedTasks.length > 0 && (
                <div className="rounded-2xl border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] overflow-hidden">
                    <div className="px-4 py-3 border-b border-[var(--color-warning-border)] flex items-center gap-2">
                        <Wrench className="w-4 h-4 text-[var(--color-warning)]" />
                        <p className="text-xs font-bold text-[var(--color-warning)] uppercase tracking-wider">
                            {autoCreatedTasks.length} Repair Task{autoCreatedTasks.length !== 1 ? "s" : ""} Auto-Created
                        </p>
                    </div>
                    <div className="divide-y divide-[var(--color-warning-border)]">
                        {autoCreatedTasks.map((task) => {
                            const pc = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.Medium;
                            return (
                                <div key={task._id} className="flex items-center gap-3 px-4 py-3">
                                    <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center shrink-0 border border-[var(--color-warning-border)]">
                                        <Wrench className="w-3.5 h-3.5 text-[var(--color-warning)]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-[var(--color-text-body)] line-clamp-2 break-words">
                                            {task.title.replace(/^\[Auto\] /, "")}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${pc.bg} ${pc.text} ${pc.border}`}>
                                        {task.priority}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-3 gap-2">
                {[
                    { label: "Total", value: data.totalItems, color: "var(--color-text-body)" },
                    { label: "Passed", value: data.passedItems, color: "var(--color-success)" },
                    { label: "Issues", value: data.failedItems, color: data.failedItems > 0 ? "var(--color-warning)" : "var(--color-text-weak)" },
                ].map(({ label, value, color }) => (
                    <div key={label} className="flex flex-col items-center py-3 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border)]">
                        <span className="text-2xl font-black tabular-nums" style={{ color }}>{value}</span>
                        <span className="text-xs text-[var(--color-text-sub)] mt-0.5">{label}</span>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3 mt-1">
                <button
                    onClick={onNewCheck}
                    className="w-full py-4 rounded-2xl bg-[var(--color-accent)] text-white text-sm font-bold hover:bg-[var(--color-accent-hover)] transition-colors active:scale-[0.98]"
                >
                    {t("checklist.btnNewCheck", "Start Another Check")}
                </button>
                <button
                    onClick={onBack}
                    className="w-full py-4 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-body)] text-sm font-bold hover:bg-[var(--color-accent-light)] transition-colors active:scale-[0.98]"
                >
                    {t("checklist.btnDashboard", "Back to Dashboard")}
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
    const nepaliDate = useMemo(() => getNepaliTodayClient(), []);

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
                const res = await api.get("/api/checklists/results", {
                    params: { propertyId, startDate: today, endDate: today, limit: 50 },
                    signal: controller.signal,
                });

                const todayResults = res.data?.data ?? [];

                if (todayResults.length === 0) {
                    const latestResults = await Promise.allSettled(
                        ALL_CATEGORIES.map(cat =>
                            api.get("/api/checklists/results", {
                                params: { propertyId, category: cat, limit: 1, page: 1 },
                                signal: controller.signal,
                            })
                        )
                    );

                    const allLatest = latestResults
                        .filter(r => r.status === 'fulfilled' && r.value?.data?.data?.[0])
                        .map(r => r.value.data.data[0]);

                    setTodaysChecklists(allLatest);
                } else {
                    setTodaysChecklists(todayResults);
                }
            } catch (err) {
                if (err.name === "CanceledError" || err.name === "AbortError") return;
                console.error("[DailyChecklistPage] load failed:", err);
            } finally {
                setLoadingChecklists(false);
            }
        }

        load();
        return () => controller.abort();
    }, [propertyId]);

    const completedCategories = useMemo(() => {
        return todaysChecklists
            .filter((c) => isCompletedToday(c))
            .map((c) => c.category);
    }, [todaysChecklists]);
    const doneCount = completedCategories.length;
    const totalCount = ALL_CATEGORIES.length;

    async function handleCategorySelect(cat, existing) {
        setSelectedCategory(cat);

        if (existing && isCompletedToday(existing)) {
            toast.info(t("checklist.alreadyCompletedToday", "This checklist has already been completed today"));
            return;
        }

        if (existing && existing.status !== "COMPLETED" && isChecklistFromToday(existing)) {
            try {
                const res = await api.get(`/api/checklists/results/${existing._id}`);
                setActiveChecklist(res.data);
                setView("checklist");
            } catch {
                toast.error(t("common.retry", "Please try again"));
            }
            return;
        }

        setCreating(true);
        try {
            let templateId = null;

            if (existing?.template) {
                templateId = typeof existing.template === 'object' ? existing.template._id : existing.template;
            }

            if (!templateId) {
                const tplRes = await api.get("/api/checklists/templates", {
                    params: { propertyId, category: cat, isActive: true },
                });
                const templates = tplRes.data?.data ?? [];
                if (templates.length) templateId = templates[0]._id;
            }

            if (!templateId) {
                const recentRes = await api.get("/api/checklists/results", {
                    params: { propertyId, category: cat, limit: 1, page: 1 },
                });
                const recentResult = recentRes.data?.data?.[0];
                const tplRef = recentResult?.template;
                templateId = tplRef?._id ?? tplRef ?? null;
            }

            if (!templateId) {
                const anyRes = await api.get("/api/checklists/results", {
                    params: { category: cat, limit: 1, page: 1 },
                });
                const anyResult = anyRes.data?.data?.[0];
                const tplRef = anyResult?.template;
                templateId = tplRef?._id ?? tplRef ?? null;
            }

            if (!templateId) {
                toast.error(`No checklist template found for ${cat}. Ask your admin to create one first.`);
                return;
            }

            const res = await api.post("/api/checklists/results", {
                templateId,
                checkDate: new Date().toISOString(),
                nepaliDate: nepaliDate.nepaliISO,
                nepaliMonth: nepaliDate.bsMonth,
                nepaliYear: nepaliDate.bsYear,
            });

            const fullRes = await api.get(`/api/checklists/results/${res.data.data._id}`);
            setActiveChecklist(fullRes.data);
            setView("checklist");
        } catch (err) {
            toast.error(err?.response?.data?.message ?? t("common.retry", "Please try again"));
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

            {view === "picker" && (
                <div className="px-4 pt-5 pb-4 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3 mb-4">
                        <button
                            onClick={() => navigate(-1)}
                            aria-label={t("common.back", "Back")}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4 text-[var(--color-text-body)]" />
                        </button>

                        <div className="flex-1">
                            <h1 className="text-lg font-bold text-[var(--color-text-strong)]">
                                {t("checklist.pageTitle", "Daily Checks")}
                            </h1>
                            <p className="text-xs text-[var(--color-text-sub)]">
                                {t("checklist.pageSubtitle", "Building inspection")}
                            </p>
                        </div>

                        <NepaliDateBadge
                            bsYear={nepaliDate.bsYear}
                            bsMonth={nepaliDate.bsMonth}
                            bsDay={nepaliDate.bsDay}
                            monthName={nepaliDate.monthName}
                        />

                        <button
                            onClick={() => window.location.reload()}
                            aria-label={t("common.refresh", "Refresh")}
                            className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--color-surface-raised)] border border-[var(--color-border)] hover:bg-[var(--color-accent-light)] transition-colors"
                        >
                            <RefreshCw className="w-4 h-4 text-[var(--color-text-sub)]" />
                        </button>
                    </div>

                    <div className="rounded-2xl bg-[var(--color-accent)] px-4 py-3 flex items-center gap-3 mb-4">
                        <div>
                            <p className="text-white/80 text-xs">{greeting}</p>
                            <p className="text-white font-bold text-sm">
                                {user?.name ?? t("sidebar.staff", "Staff")}
                            </p>
                        </div>
                        <div className="ml-auto text-right">
                            <p className="text-white font-bold text-2xl tabular-nums">{doneCount}/{totalCount}</p>
                            <p className="text-white/70 text-xs">{t("checklist.doneToday", "done today")}</p>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <p className="text-xs font-semibold text-[var(--color-text-sub)]">
                                {t("dashboard.progressTitle", "Today's progress")}
                            </p>
                            <p className="text-xs font-bold text-[var(--color-accent)]">
                                {doneCount === totalCount
                                    ? `${t("common.allClear", "All clear")} 🎉`
                                    : `${totalCount - doneCount} remaining`
                                }
                            </p>
                        </div>
                        <ProgressBar value={doneCount} max={totalCount} />
                    </div>
                </div>
            )}

            <div className="flex-1 flex flex-col">
                {creating && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                        <div className="bg-[var(--color-surface-raised)] rounded-2xl px-8 py-6 flex flex-col items-center gap-3 shadow-xl">
                            <Loader2 className="w-8 h-8 animate-spin text-[var(--color-accent)]" />
                            <p className="text-sm font-semibold text-[var(--color-text-body)]">
                                {t("common.loading", "Loading…")}
                            </p>
                        </div>
                    </div>
                )}

                {view === "picker" && (
                    <div className="px-4 py-4">
                        <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-[var(--color-accent-light)] border border-[var(--color-accent-mid)] mb-4">
                            <ClipboardList className="w-4 h-4 text-[var(--color-accent)] shrink-0 mt-0.5" />
                            <p className="text-xs text-[var(--color-accent)] font-medium">
                                {t("checklist.selectLabel", "Select a category to begin today's inspection")}
                            </p>
                        </div>

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