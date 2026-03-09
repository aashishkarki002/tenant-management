import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Phone, Mail, Calendar, MoreVertical, AlertTriangle,
  Eye, CreditCard, Bell, Pencil, XCircle,
} from "lucide-react";
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
  { bg: "var(--color-muted-fill)", color: "var(--color-text-sub)" },
];

// Keep the Tailwind class variant exported so tenants.jsx table avatars still work
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-600",
  "bg-violet-100 text-violet-600",
  "bg-emerald-100 text-emerald-600",
  "bg-rose-100 text-rose-600",
  "bg-amber-100 text-amber-600",
  "bg-cyan-100 text-cyan-600",
  "bg-pink-100 text-pink-600",
  "bg-indigo-100 text-indigo-600",
];

export function getAvatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
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
    className: "bg-green-50 text-green-700 border-green-200",
    style: { background: "var(--color-success-bg)", color: "var(--color-success)", borderColor: "var(--color-success-border)" },
  },
  due_soon: {
    label: "Due Soon",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    style: { background: "var(--color-warning-bg)", color: "var(--color-warning)", borderColor: "var(--color-warning-border)" },
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-50 text-red-700 border-red-200",
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

const fmt = (val) =>
  val != null && val > 0
    ? `Rs. ${Number(val).toLocaleString("en-IN")}`
    : "N/A";

export function getTenantRentDisplay(tenant) {
  if (tenant?.rentPaymentFrequency === "monthly") return fmt(tenant?.totalRent);
  if (tenant?.rentPaymentFrequency === "quarterly") return fmt(tenant?.quarterlyRentAmount);
  return "N/A";
}

// ─── TenantCard ────────────────────────────────────────────────────────────────
export default function TenantCard({ tenant, onTenantMutated }) {
  const navigate = useNavigate();
  const attention = needsAttention(tenant);
  const paymentStatus = getPaymentStatus(tenant);
  const badge = PAYMENT_BADGE[paymentStatus] ?? PAYMENT_BADGE.paid;

  const rentDisplay = getTenantRentDisplay(tenant);
  const frequencyLabel =
    tenant?.rentPaymentFrequency === "monthly" ? "/ mo"
      : tenant?.rentPaymentFrequency === "quarterly" ? "/ qtr"
        : "";
  const locationLabel = getTenantLocationLabel(tenant);

  const deleteTenant = async () => {
    try {
      if (!tenant?._id) { toast.error("Tenant ID is missing"); return; }
      const res = await api.patch(`/api/tenant/delete-tenant/${tenant._id}`);
      if (res.data.success) { toast.success(res.data.message); onTenantMutated?.(); }
      else toast.error(res.data.message || "Failed to delete tenant");
    } catch (err) {
      toast.error(err.response?.data?.message || "An error occurred while deleting tenant");
    }
  };

  return (
    <Card
      onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}
      className="group cursor-pointer rounded-xl border overflow-hidden transition-all duration-200"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        boxShadow: "var(--shadow-card)",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--color-accent-mid)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(28,25,23,0.09)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--color-border)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
      }}
    >
      <CardContent className="p-3">

        {/* ── Attention banner ─────────────────────────────────────────────────
            Only renders when overdue or lease expiring — zero noise otherwise.
        ──────────────────────────────────────────────────────────────────────── */}
        {attention && (
          <div
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 mb-2.5 text-[11px] font-semibold border"
            style={{
              background: "var(--color-danger-bg)",
              borderColor: "var(--color-danger-border)",
              color: "var(--color-danger)",
            }}
          >
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Attention Needed
          </div>
        )}

        {/* ── Header: Avatar + Name + Menu ─────────────────────────────────── */}
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={tenant?.name} />
            <div className="min-w-0">
              <p
                className="text-sm font-semibold leading-tight truncate font-sans"
                style={{ color: "var(--color-text-strong)" }}
              >
                {tenant?.name || "—"}
              </p>
              <p
                className="text-[11px] truncate mt-0.5"
                style={{ color: "var(--color-text-sub)" }}
              >
                {locationLabel}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={e => e.stopPropagation()}
                className="w-6 h-6 rounded-full flex items-center justify-center
                           opacity-0 group-hover:opacity-100 transition-all shrink-0"
                style={{ color: "var(--color-text-sub)" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--color-surface-raised)"}
                onMouseLeave={e => e.currentTarget.style.background = ""}
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" onClick={e => e.stopPropagation()}>
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}>
                <Eye className="w-3.5 h-3.5 mr-2" /> View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/rent-payment`)}>
                <CreditCard className="w-3.5 h-3.5 mr-2" /> Record Payment
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tenant/send-message`)}>
                <Bell className="w-3.5 h-3.5 mr-2" /> Send Reminder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tenant/editTenant/${tenant._id}`)}>
                <Pencil className="w-3.5 h-3.5 mr-2" /> Edit Tenant
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                style={{ color: "var(--color-danger)" }}
                onClick={deleteTenant}
              >
                <XCircle className="w-3.5 h-3.5 mr-2" /> Terminate Lease
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Rent + Payment badge ──────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-1">
            <span
              className="text-lg font-bold leading-tight font-mono tabular-nums"
              style={{ color: "var(--color-text-strong)" }}
            >
              {rentDisplay}
            </span>
            {frequencyLabel && (
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--color-text-weak)" }}
              >
                {frequencyLabel}
              </span>
            )}
          </div>
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
            style={badge.style}
          >
            {badge.label}
          </span>
        </div>

        {/* ── Metadata row ─────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-3 text-[11px] mb-2.5"
          style={{ color: "var(--color-text-sub)" }}
        >
          {tenant?.rentAmountFormatted && (
            <span className="font-mono tabular-nums">Paid: {tenant.rentAmountFormatted}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {tenant?.leaseEndDateNepali || "—"}
          </span>
        </div>

        {/* ── Action buttons ────────────────────────────────────────────────── */}
        <div
          className="border-t pt-2 flex gap-1.5"
          style={{ borderColor: "var(--color-border)" }}
        >
          <button
            className="flex-1 flex items-center justify-center gap-1 text-xs rounded-lg py-1.5 transition-colors font-medium"
            style={{
              background: "var(--color-surface-raised)",
              color: "var(--color-text-sub)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--color-success-bg)";
              e.currentTarget.style.color = "var(--color-success)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--color-surface-raised)";
              e.currentTarget.style.color = "var(--color-text-sub)";
            }}
            onClick={e => {
              e.stopPropagation();
              if (tenant?.phone) window.location.href = `tel:${tenant.phone}`;
            }}
          >
            <Phone className="w-3 h-3" /> Call
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1 text-xs rounded-lg py-1.5 transition-colors font-medium"
            style={{
              background: "var(--color-surface-raised)",
              color: "var(--color-text-sub)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--color-accent-light)";
              e.currentTarget.style.color = "var(--color-accent)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "var(--color-surface-raised)";
              e.currentTarget.style.color = "var(--color-text-sub)";
            }}
            onClick={e => {
              e.stopPropagation();
              if (tenant?.email) window.location.href = `mailto:${tenant.email}`;
            }}
          >
            <Mail className="w-3 h-3" /> Email
          </button>
        </div>
      </CardContent>
    </Card>
  );
}