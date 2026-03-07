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

function Avatar({ name }) {
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${getAvatarColor(name)}`}>
      {initials}
    </div>
  );
}

export const PAYMENT_BADGE = {
  paid:     { label: "Paid",     className: "bg-green-50 text-green-700 border-green-200" },
  due_soon: { label: "Due Soon", className: "bg-amber-50 text-amber-700 border-amber-200" },
  overdue:  { label: "Overdue",  className: "bg-red-50 text-red-700 border-red-200" },
};

export function getPaymentStatus(tenant) {
  if (tenant?.paymentStatus) return tenant.paymentStatus;
  return "paid";
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
  if (tenant?.rentPaymentFrequency === "monthly") return tenant?.totalRentFormatted ?? "N/A";
  if (tenant?.rentPaymentFrequency === "quarterly") return tenant?.quarterlyRentAmountFormatted ?? "N/A";
  return "N/A";
}

export default function TenantCard({ tenant, onTenantMutated }) {
  const navigate = useNavigate();
  const attention = needsAttention(tenant);
  const paymentStatus = getPaymentStatus(tenant);
  const badge = PAYMENT_BADGE[paymentStatus] ?? PAYMENT_BADGE.paid;

  const rentDisplay = getTenantRentDisplay(tenant);
  const frequencyLabel =
    tenant?.rentPaymentFrequency === "monthly" ? "Monthly"
      : tenant?.rentPaymentFrequency === "quarterly" ? "Quarterly"
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
      className="group cursor-pointer bg-white rounded-xl border border-gray-100 shadow-sm
                 hover:shadow-md hover:border-gray-200 transition-all duration-200 overflow-hidden"
    >
      <CardContent className="p-3">
        {attention && (
          <div className="flex items-center gap-1.5 text-red-600 bg-red-50 border border-red-100
                          rounded-lg px-2.5 py-1 mb-2 text-[11px] font-semibold">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Attention Needed
          </div>
        )}

        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={tenant?.name} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 leading-tight truncate">
                {tenant?.name || "—"}
              </p>
              <p className="text-[11px] text-gray-400 truncate">{locationLabel}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={e => e.stopPropagation()}
                className="w-6 h-6 rounded-full flex items-center justify-center
                           text-gray-400 hover:bg-gray-100 opacity-0 group-hover:opacity-100
                           transition-all shrink-0"
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
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={deleteTenant}>
                <XCircle className="w-3.5 h-3.5 mr-2" /> Terminate Lease
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold text-gray-900 leading-tight">{rentDisplay}</span>
            {frequencyLabel && (
              <span className="text-[10px] font-medium text-gray-400">{frequencyLabel}</span>
            )}
          </div>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-2">
          {tenant?.lastPaymentDate && (
            <span>Paid: {new Date(tenant.lastPaymentDate).toLocaleDateString()}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {tenant?.leaseEndDateNepali || "—"}
          </span>
        </div>

        <div className="border-t border-gray-100 pt-2 flex gap-1.5">
          <button
            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500
                       bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-lg py-1.5
                       transition-colors font-medium"
            onClick={e => {
              e.stopPropagation();
              if (tenant?.phone) window.location.href = `tel:${tenant.phone}`;
            }}
          >
            <Phone className="w-3 h-3" /> Call
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1 text-xs text-gray-500
                       bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg py-1.5
                       transition-colors font-medium"
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
