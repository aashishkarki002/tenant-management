/**
 * LanguageToggle.jsx
 *
 * A compact pill toggle that switches between English and Nepali.
 * Designed to slot into the StaffSidebar footer or any header area.
 *
 * Props:
 *  - variant: "pill" (default) | "icon" | "full"
 *    pill  → नेपाली / EN pill, current locale highlighted
 *    icon  → globe icon only (tooltip on hover) — for tight spaces
 *    full  → labelled button with both options always visible
 *
 * Usage:
 *  import LanguageToggle from "@/components/LanguageToggle";
 *  <LanguageToggle />
 *  <LanguageToggle variant="icon" />
 *  <LanguageToggle variant="full" />
 */

import { Globe } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

// ─── Pill variant (default) ───────────────────────────────────────────────────
// Two-segment pill: clicking the inactive segment switches language.
// Active segment = petrol accent background.

function PillToggle({ isNepali, toggle }) {
    return (
        <div
            role="group"
            aria-label="Language toggle"
            className="inline-flex items-center rounded-full border border-[var(--color-border)]
                 bg-[var(--color-surface)] p-0.5 gap-0.5"
        >
            <button
                type="button"
                aria-pressed={isNepali}
                onClick={() => !isNepali && toggle()}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200
          ${isNepali
                        ? "bg-[var(--color-accent)] text-white shadow-sm"
                        : "text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]"
                    }`}
            >
                नेपाली
            </button>
            <button
                type="button"
                aria-pressed={!isNepali}
                onClick={() => isNepali && toggle()}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200
          ${!isNepali
                        ? "bg-[var(--color-accent)] text-white shadow-sm"
                        : "text-[var(--color-text-sub)] hover:text-[var(--color-text-body)]"
                    }`}
            >
                EN
            </button>
        </div>
    );
}

// ─── Icon-only variant ────────────────────────────────────────────────────────
// Globe icon with a small locale badge — for compact sidebars.

function IconToggle({ isNepali, toggle }) {
    return (
        <button
            type="button"
            onClick={toggle}
            title={isNepali ? "Switch to English" : "नेपालीमा जानुहोस्"}
            aria-label={isNepali ? "Switch to English" : "Switch to Nepali"}
            className="relative flex items-center justify-center w-9 h-9 rounded-xl
                 border border-[var(--color-border)] bg-[var(--color-surface)]
                 hover:bg-[var(--color-accent-light)] hover:border-[var(--color-accent-mid)]
                 transition-colors group"
        >
            <Globe className="w-4 h-4 text-[var(--color-text-sub)] group-hover:text-[var(--color-accent)]
                        transition-colors" />
            {/* Badge showing current locale */}
            <span className="absolute -top-1 -right-1 text-[9px] font-bold leading-none
                       bg-[var(--color-accent)] text-white rounded-full px-1 py-0.5 min-w-[18px]
                       text-center">
                {isNepali ? "ने" : "EN"}
            </span>
        </button>
    );
}

// ─── Full variant ─────────────────────────────────────────────────────────────
// Both options always visible as separate buttons side-by-side with labels.
// Good for settings pages or onboarding screens.

function FullToggle({ isNepali, toggle }) {
    return (
        <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-[var(--color-text-weak)] uppercase tracking-widest">
                Language / भाषा
            </p>
            <div className="grid grid-cols-2 gap-2">
                <button
                    type="button"
                    onClick={() => isNepali && toggle()}
                    aria-pressed={!isNepali}
                    className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-semibold
                      transition-all duration-150
                      ${!isNepali
                            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-text-body)]"
                        }`}
                >
                    <Globe className="w-3.5 h-3.5" />
                    English
                </button>
                <button
                    type="button"
                    onClick={() => !isNepali && toggle()}
                    aria-pressed={isNepali}
                    className={`flex items-center justify-center gap-2 h-10 rounded-xl border text-sm font-semibold
                      transition-all duration-150
                      ${isNepali
                            ? "bg-[var(--color-accent)] border-[var(--color-accent)] text-white shadow-sm"
                            : "bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-[var(--color-accent-mid)] hover:text-[var(--color-text-body)]"
                        }`}
                >
                    <Globe className="w-3.5 h-3.5" />
                    नेपाली
                </button>
            </div>
        </div>
    );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function LanguageToggle({ variant = "pill" }) {
    const { isNepali, toggle } = useLanguage();

    if (variant === "icon") return <IconToggle isNepali={isNepali} toggle={toggle} />;
    if (variant === "full") return <FullToggle isNepali={isNepali} toggle={toggle} />;
    return <PillToggle isNepali={isNepali} toggle={toggle} />;
}