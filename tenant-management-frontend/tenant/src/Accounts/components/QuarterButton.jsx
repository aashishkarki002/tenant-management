import { useState } from "react";
import { motion } from "framer-motion";

const quarterToMonths = {
    All: "All periods",
    Q1: "Jan – Mar",
    Q2: "Apr – Jun",
    Q3: "Jul – Sep",
    Q4: "Oct – Dec",
};

export default function QuarterButton({
    quarter,
    value,
    selectedQuarter,
    setSelectedQuarter,
}) {
    const [hovered, setHovered] = useState(false);
    const isSelected = selectedQuarter === value;

    const monthText = value ? (quarterToMonths[value] ?? null) : null;
    const displayText = monthText ? `${quarter} · ${monthText}` : quarter;

    const width = monthText ? 180 : 80;

    return (
        <motion.button
            onClick={() => setSelectedQuarter(value)}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            animate={{
                width,
                backgroundColor: isSelected ? "var(--color-accent)" : hovered ? "var(--color-accent-hover)" : "var(--color-surface)",
                color: isSelected ? "var(--color-surface-raised)" : hovered ? "var(--color-surface-raised)" : "var(--color-text-strong)",
            }}
            transition={{ stiffness: 300, damping: 20 }}
            className="h-10 rounded-md text-sm font-medium whitespace-nowrap"
        >
            {displayText}
        </motion.button>
    );
}