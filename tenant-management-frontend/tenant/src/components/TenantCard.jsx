import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone, Mail, Calendar, MoreVertical, AlertTriangle,
  Eye, CreditCard, Bell, Pencil, XCircle, TrendingDown,
} from "lucide-react";
import { NEPALI_MONTH_NAMES } from "../../utils/nepaliDate.js";
import { useNavigate } from "react-router-dom";
import api from "../../plugins/axios";
import { toast } from "sonner";

// ─── Avatar color pool ────────────────────────────────────────────────────────
//
// Industry pattern: deterministic color from name hash so the same tenant
// always gets the same color across sessions — no flickering on re-render.
// Using design-token-aware inline styles so dark mode flips correctly.
//
const AVATAR_PALETTES = [
  { bg: "var(--color-accent-light)", color: "var(--color-accent)" },
  { bg: "var(--color-info-bg)", color: "var(--color-info)" },
  { bg: "var(--color-success-bg)", color: "var(--color-success)" },
  { bg: "var(--color-danger-bg)", color: "var(--color-danger)" },
  { bg: "var(--color-warning-bg)", color: "var(--color-warning)" },
  { bg: "var(--color-private-bg)", color: "var(--color-private)" },
  { bg: "var(--color-company-bg)", color: "var(--color-company)" },
  { bg: "var(--color-headoffice-bg)", color: "var(--color-headoffice)" },
];

export function getAvatarColor(name = "") {
  const palette = getAvatarPalette(name);
  return palette; // Now returns an object with bg and color
}

function getAvatarPalette(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length];
}

function Avatar({ name }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const palette = getAvatarPalette(name);
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
      style={{ background: palette.bg, color: palette.color }}
    >
      {initials}
    </div>
  );
}

// ─── Payment badge ─────────────────────────────────────────────────────────────
//
// Token-aware badge styles — these will correctly invert in dark mode.
// The className field kept for backward compat with tenants.jsx table badges.
//
export const PAYMENT_BADGE = {
  paid: {
    label: "Paid",
    style: { background: "var(--color-success-bg)", color: "var(--color-success)", borderColor: "var(--color-success-border)" },
  },
  partial: {
    label: "Partial",
    style: { background: "var(--color-info-bg)", color: "var(--color-info)", borderColor: "var(--color-info-border)" },
  },
  due_soon: {
    label: "Due Soon",
    style: { background: "var(--color-warning-bg)", color: "var(--color-warning)", borderColor: "var(--color-warning-border)" },
  },
  overdue: {
    label: "Overdue",
    style: { background: "var(--color-danger-bg)", color: "var(--color-danger)", borderColor: "var(--color-danger-border)" },
  },
};

export function getPaymentStatus(tenant) {
  if (!tenant) return "paid";
  if (!tenant.paymentStatus) return "paid";
  return tenant.paymentStatus;
}

export function needsAttention(tenant) {
  if (getPaymentStatus(tenant) === "overdue") return true;
  if (!tenant?.leaseEndDate) return false;
  const diff = (new Date(tenant.leaseEndDate) - new Date()) / 86400000;
  return diff > 0 && diff <= 30;
}

export function getTenantLocationLabel(tenant) {
  const unitLabel =
    Array.isArray(tenant?.units) && tenant.units.length > 0
      ? tenant.units.map(u => u?.name).filter(Boolean).join(", ")
      : null;
  const blockLabel = tenant?.block?.name ?? null;
  return (
    [unitLabel ? `Unit ${unitLabel}` : null, blockLabel ? `Block ${blockLabel}` : null]
      .filter(Boolean)
      .join(" • ") || "—"
  );
}



export function getTenantRentDisplay(tenant) {
  const fmt = (v) => v != null ? `Rs. ${Number(v).toLocaleString("en-IN")}` : "N/A";
  if (tenant?.rentPaymentFrequency === "monthly") return fmt(tenant?.totalRent);
  if (tenant?.rentPaymentFrequency === "quarterly") return fmt(tenant?.quarterlyRentAmount);
  return "N/A";
}

export default function TenantCard({
  tenant,
  onTenantMutated,
  onTerminate,
}) {
  const navigate = useNavigate();

  const paymentStatus = getPaymentStatus(tenant);
  const locationLabel = getTenantLocationLabel(tenant);

  /* ── Lease urgency (UX upgrade) ── */
  const leaseEnd = tenant?.leaseEndDate ? new Date(tenant.leaseEndDate) : null;
  const today = new Date();
  const daysLeft = leaseEnd
    ? Math.ceil((leaseEnd - today) / (1000 * 60 * 60 * 24))
    : null;

  const leaseLabel =
    daysLeft == null
      ? "No lease date"
      : daysLeft <= 0
        ? "Lease expired"
        : `Ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`;

  const leaseSubLabel = tenant?.leaseEndDateNepali || "";

  /* ── Overdue logic ── */
  const overdueBalance = tenant?.overdueBalance ?? 0;

  const overdueMonth = tenant?.oldestOverdueNepaliMonth;
  const overdueYear = tenant?.oldestOverdueNepaliYear;

  const overdueMonthName =
    overdueMonth != null
      ? NEPALI_MONTH_NAMES[overdueMonth - 1]
      : null;

  const overdueLabel =
    overdueMonthName && overdueYear
      ? `Since ${overdueMonthName} ${overdueYear}`
      : tenant?.consecutiveUnpaidMonths > 1
        ? `${tenant.consecutiveUnpaidMonths} months unpaid`
        : null;

  const deleteTenant = async () => {
    try {
      const res = await api.patch(
        `/api/tenant/delete-tenant/${tenant._id}`
      );

      if (res.data.success) {
        toast.success(res.data.message);
        onTenantMutated?.();
      } else {
        toast.error(res.data.message || "Failed");
      }
    } catch (err) {
      toast.error("Error deleting tenant");
    }
  };

  return (
    <Card
      onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}
      className="group cursor-pointer rounded-xl border overflow-hidden transition-all"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      <CardContent className="p-3">

        {/* ── HEADER ───────────────────────────── */}
        <div className="flex justify-between items-start mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={tenant?.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {tenant?.name || "—"}
              </p>
              <p className="text-[11px] opacity-70 truncate">
                {locationLabel}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}>
                <Eye className="w-3.5 h-3.5 mr-2" /> View
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate(`/rent-payment`)}>
                <CreditCard className="w-3.5 h-3.5 mr-2" /> Payment
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate(`/tenant/send-message`)}>
                <Bell className="w-3.5 h-3.5 mr-2" /> Reminder
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate(`/tenant/editTenant/${tenant._id}`)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => (onTerminate ? onTerminate(tenant) : deleteTenant())}
                style={{ color: "var(--color-danger)" }}
              >
                <XCircle className="w-3.5 h-3.5 mr-2" /> Terminate
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── RENT + STATUS ─────────────────────── */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <p className="text-lg font-bold">
              {getTenantRentDisplay(tenant)}
            </p>
            <p className="text-[10px] opacity-60">
              {tenant?.rentPaymentFrequency}
            </p>
          </div>

          <span
            className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
            style={PAYMENT_BADGE[paymentStatus]?.style}
          >
            {PAYMENT_BADGE[paymentStatus]?.label || paymentStatus}
          </span>
        </div>

        {/* ── LEASE (UX FIXED) ─────────────────── */}
        <div className="flex items-start gap-2 text-[11px] mb-2">
          <Calendar className="w-3 h-3 mt-0.5" />

          <div className="flex flex-col leading-tight">
            <span className="font-medium">{leaseLabel}</span>
            {leaseSubLabel && (
              <span className="opacity-60 text-[10px]">
                {leaseSubLabel}
              </span>
            )}
          </div>
        </div>

        {/* ── OVERDUE ──────────────────────────── */}
        {overdueBalance > 0 && (
          <div
            className="flex justify-between items-center border rounded-lg px-2 py-1 mb-2"
            style={{
              background: "var(--color-danger-bg)",
              borderColor: "var(--color-danger-border)",
            }}
          >
            <div
              className="flex items-center gap-1 text-[11px] font-semibold"
              style={{ color: "var(--color-danger)" }}
            >
              <TrendingDown className="w-3 h-3" />
              Rs. {overdueBalance.toLocaleString("en-IN")} arrears
            </div>

            {overdueLabel && (
              <span
                className="text-[10px]"
                style={{ color: "var(--color-danger)" }}
              >
                {overdueLabel}
              </span>
            )}
          </div>
        )}

        {/* ── ACTIONS ──────────────────────────── */}
        <div className="border-t pt-2 flex gap-1.5">
          <button
            className="flex-1 text-xs py-1.5 rounded-lg border transition-colors"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-body)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (tenant?.phone) window.location.href = `tel:${tenant.phone}`;
            }}
          >
            <Phone className="w-3 h-3 inline mr-1" /> Call
          </button>

          <button
            className="flex-1 text-xs py-1.5 rounded-lg border transition-colors"
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              color: "var(--color-text-body)",
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (tenant?.email) window.location.href = `mailto:${tenant.email}`;
            }}
          >
            <Mail className="w-3 h-3 inline mr-1" /> Email
          </button>
        </div>

      </CardContent>
    </Card>
  );
}