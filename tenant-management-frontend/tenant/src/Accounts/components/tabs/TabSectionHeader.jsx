/**
 * tabs/TabSectionHeader.jsx
 *
 * Shared section header used by RevenueTab and ExpensesTab.
 * Renders a coloured icon circle, a descriptive label, and a right-anchored badge.
 *
 * Extracted to its own file so both tabs import it cleanly with no
 * circular dependency through TabComponents.jsx.
 *
 * Props:
 *   icon    ReactNode  — icon element (already sized)
 *   iconBg  string     — CSS color for the circle background
 *   label   ReactNode  — text/JSX for the left label
 *   badge   ReactNode  — right-anchored content (usually a total amount)
 */

export default function TabSectionHeader({ icon, iconBg, label, badge }) {
    return (
        <div className="flex items-center justify-between flex-wrap gap-2 px-1 pb-1 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
                <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: iconBg }}
                >
                    {icon}
                </div>
                <span className="text-[13px] text-[var(--color-text-body)]">{label}</span>
            </div>
            {badge}
        </div>
    );
}