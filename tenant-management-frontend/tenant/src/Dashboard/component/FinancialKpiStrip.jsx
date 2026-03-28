import React, { useEffect, useState } from "react";
import { motion } from "motion/react";
import { TrendingUp, TrendingDown, Wallet, DollarSign, CreditCard, AlertCircle } from "lucide-react";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatCurrency(val) {
  if (val == null || val === "") return "₹0";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatCompact(val) {
  if (val == null || val === "") return "₹0";
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`;
  return `₹${n.toLocaleString("en-IN")}`;
}

// ─── Animated Counter ─────────────────────────────────────────────────────────

function AnimatedCounter({ value, duration = 0.6 }) {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = Number(value) || 0;

  useEffect(() => {
    let startTime = null;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      // easeOut cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      setDisplayValue(Math.floor(targetValue * easeProgress));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [targetValue, duration]);

  return formatCurrency(displayValue);
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function MiniSparkline({ data = [], positive = true }) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");

  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg 
      viewBox="0 0 100 24" 
      className="w-full h-6 opacity-0"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={positive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      
      <motion.polyline
        points={points}
        fill="none"
        stroke={positive ? "rgb(34, 197, 94)" : "rgb(239, 68, 68)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.6 }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
      />
      
      <motion.polygon
        points={`0,100 ${points} 100,100`}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
      />
    </svg>
  );
}

// ─── Delta Indicator ──────────────────────────────────────────────────────────

function DeltaIndicator({ value, percentage = true }) {
  if (value == null || value === 0) return null;

  const isPositive = value > 0;
  const displayValue = percentage 
    ? `${Math.abs(value).toFixed(1)}%`
    : formatCompact(Math.abs(value));

  return (
    <motion.div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${
        isPositive 
          ? "bg-green-500/10 text-green-600 dark:text-green-400" 
          : "bg-red-500/10 text-red-600 dark:text-red-400"
      }`}
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.5, ease: "easeOut" }}
    >
      {isPositive ? (
        <TrendingUp className="w-3 h-3" strokeWidth={2.5} />
      ) : (
        <TrendingDown className="w-3 h-3" strokeWidth={2.5} />
      )}
      <span>{displayValue}</span>
    </motion.div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  compactValue,
  delta,
  deltaPercentage = true,
  icon: Icon,
  variant = "default", // "default" | "primary" | "success" | "danger"
  sparklineData,
  index = 0,
  loading = false,
}) {
  const [isHovered, setIsHovered] = useState(false);

  const variantStyles = {
    default: {
      border: "border-neutral-200 dark:border-neutral-800",
      bg: "bg-white dark:bg-neutral-950",
      iconBg: "bg-neutral-100 dark:bg-neutral-900",
      iconColor: "text-neutral-600 dark:text-neutral-400",
      labelColor: "text-neutral-500 dark:text-neutral-500",
      valueColor: "text-neutral-950 dark:text-neutral-50",
    },
    primary: {
      border: "border-neutral-900 dark:border-neutral-100",
      bg: "bg-neutral-950 dark:bg-neutral-100",
      iconBg: "bg-neutral-800 dark:bg-neutral-200",
      iconColor: "text-neutral-100 dark:text-neutral-900",
      labelColor: "text-neutral-400 dark:text-neutral-600",
      valueColor: "text-neutral-50 dark:text-neutral-950",
    },
    success: {
      border: "border-green-200 dark:border-green-900/50",
      bg: "bg-white dark:bg-neutral-950",
      iconBg: "bg-green-100 dark:bg-green-950",
      iconColor: "text-green-600 dark:text-green-400",
      labelColor: "text-neutral-500 dark:text-neutral-500",
      valueColor: "text-neutral-950 dark:text-neutral-50",
    },
    danger: {
      border: "border-red-200 dark:border-red-900/50",
      bg: "bg-white dark:bg-neutral-950",
      iconBg: "bg-red-100 dark:bg-red-950",
      iconColor: "text-red-600 dark:text-red-400",
      labelColor: "text-neutral-500 dark:text-neutral-500",
      valueColor: "text-neutral-950 dark:text-neutral-50",
    },
  };

  const styles = variantStyles[variant] || variantStyles.default;

  return (
    <motion.div
      className={`relative rounded-2xl border ${styles.border} ${styles.bg} p-5 overflow-hidden
                  transition-shadow duration-200 cursor-default`}
      style={{
        boxShadow: isHovered 
          ? "0 8px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.04)"
          : "0 2px 8px -2px rgba(0, 0, 0, 0.04)",
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 0.61, 0.36, 1], // easeOutCubic
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      {/* Background gradient (subtle) */}
      <div 
        className="absolute inset-0 opacity-0 pointer-events-none"
        style={{
          background: variant === "primary" 
            ? "radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent 60%)"
            : "radial-gradient(circle at top right, rgba(0,0,0,0.01), transparent 60%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10">
        {/* Header: Label + Icon */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className={`text-[10px] font-semibold tracking-[0.12em] uppercase ${styles.labelColor}`}>
              {label}
            </p>
            {delta != null && (
              <div className="mt-2">
                <DeltaIndicator value={delta} percentage={deltaPercentage} />
              </div>
            )}
          </div>
          
          <motion.div
            className={`rounded-xl p-2.5 ${styles.iconBg}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: index * 0.08 + 0.2, ease: "easeOut" }}
          >
            <Icon className={`w-4 h-4 ${styles.iconColor}`} strokeWidth={2} />
          </motion.div>
        </div>

        {/* Value */}
        {loading ? (
          <div className={`h-9 w-32 rounded-lg ${styles.iconBg} animate-pulse`} />
        ) : (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: index * 0.08 + 0.15, ease: "easeOut" }}
          >
            <p className={`text-3xl font-bold tabular-nums tracking-tight ${styles.valueColor} leading-none`}>
              {compactValue || <AnimatedCounter value={value} />}
            </p>
          </motion.div>
        )}

        {/* Sparkline */}
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-4 -mx-1">
            <MiniSparkline data={sparklineData} positive={delta >= 0} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Financial KPI Strip ──────────────────────────────────────────────────────

export default function FinancialKpiStrip({ stats, loading }) {
  const accounting = stats?.accounting ?? {};
  const kpi = stats?.kpi ?? {};

  // Calculate values
  const totalRevenue = accounting.totalRevenue ?? 0;
  const totalExpenses = accounting.totalExpenses ?? 0;
  const netCashPosition = totalRevenue - totalExpenses;
  const outstandingLiabilities = kpi.totalRemaining ?? 0;

  // Mock deltas (replace with real data from your API)
  const revenueDelta = 12.5; // +12.5% vs last period
  const expenseDelta = -5.2; // +5.2% vs last period (shown as negative trend)
  const cashDelta = 18.3; // +18.3% vs last period
  const liabilitiesDelta = -8.7; // -8.7% vs last period (reduction is positive)

  // Mock sparkline data (replace with real trend data)
  const revenueSparkline = [45000, 52000, 48000, 55000, 61000, 58000, totalRevenue];
  const expenseSparkline = [32000, 35000, 38000, 36000, 39000, 41000, totalExpenses];

  const kpiCards = [
    {
      label: "Net Cash Position",
      value: netCashPosition,
      compactValue: formatCompact(netCashPosition),
      delta: cashDelta,
      deltaPercentage: true,
      icon: Wallet,
      variant: "primary",
      sparklineData: null,
    },
    {
      label: "Total Revenue",
      value: totalRevenue,
      compactValue: formatCompact(totalRevenue),
      delta: revenueDelta,
      deltaPercentage: true,
      icon: TrendingUp,
      variant: "success",
      sparklineData: revenueSparkline,
    },
    {
      label: "Total Expenses",
      value: totalExpenses,
      compactValue: formatCompact(totalExpenses),
      delta: expenseDelta,
      deltaPercentage: true,
      icon: CreditCard,
      variant: "default",
      sparklineData: expenseSparkline,
    },
    {
      label: "Outstanding Liabilities",
      value: outstandingLiabilities,
      compactValue: formatCompact(outstandingLiabilities),
      delta: liabilitiesDelta,
      deltaPercentage: true,
      icon: AlertCircle,
      variant: outstandingLiabilities > 0 ? "danger" : "default",
      sparklineData: null,
    },
  ];

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: 0.08,
          },
        },
      }}
    >
      {kpiCards.map((card, index) => (
        <KpiCard
          key={card.label}
          {...card}
          index={index}
          loading={loading}
        />
      ))}
    </motion.div>
  );
}
