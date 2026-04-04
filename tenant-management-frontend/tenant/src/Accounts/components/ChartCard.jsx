/**
 * ChartCard.jsx
 *
 * Consistent wrapper for all charts. Adds a standard header (uppercase title +
 * optional subtitle + optional right-side actions) and a subtle fade-in
 * animation on mount / tab switch.
 *
 * Props:
 *   title     string    uppercase chart label
 *   subtitle  string?   secondary label below the title
 *   actions   ReactNode optional right-side controls (legend, toggle, etc.)
 *   children  ReactNode chart content
 *   className string?   extra classes applied to the outer div
 */

import { cn } from "@/lib/utils";
import { motion } from "motion/react"; // eslint-disable-line no-unused-vars

export default function ChartCard({ title, subtitle, actions, children, className }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={cn(
                "bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5",
                "shadow-[0_1px_4px_rgba(0,0,0,0.06)]",
                className,
            )}
        >
            <div className="flex items-start justify-between mb-4">
                <div>
                    <p className="text-[12px] font-semibold text-[var(--color-text-weak)] uppercase tracking-[0.06em]">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="text-[11px] text-[var(--color-text-sub)] mt-0.5">{subtitle}</p>
                    )}
                </div>
                {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>
            {children}
        </motion.div>
    );
}
