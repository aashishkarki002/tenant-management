import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Phone, Mail, Calendar, MoreHorizontal } from "lucide-react";

import { useNavigate } from "react-router-dom";
import api from "../../plugins/axios";
import { toast } from "sonner";


// Generate a deterministic pastel avatar background from name
function getAvatarColor(name = "") {
  const colors = [
    "bg-blue-100 text-blue-600",
    "bg-violet-100 text-violet-600",
    "bg-emerald-100 text-emerald-600",
    "bg-rose-100 text-rose-600",
    "bg-amber-100 text-amber-600",
    "bg-cyan-100 text-cyan-600",
    "bg-pink-100 text-pink-600",
    "bg-indigo-100 text-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

function Avatar({ name }) {
  const initials = name
    ? name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  const colorClass = getAvatarColor(name);
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${colorClass}`}>
      {initials}
    </div>
  );
}

export default function TenantCard({ tenant, HandleDeleteTenant }) {
  const navigate = useNavigate();



  const isActive = tenant?.status === "active" || !tenant?.status;

  const rentDisplay =
    tenant?.rentPaymentFrequency === "monthly"
      ? tenant?.totalRentFormatted
      : tenant?.rentPaymentFrequency === "quarterly"
        ? tenant?.quarterlyRentAmountFormatted
        : "N/A";

  const frequencyLabel =
    tenant?.rentPaymentFrequency === "monthly"
      ? "MONTHLY"
      : tenant?.rentPaymentFrequency === "quarterly"
        ? "QUARTERLY"
        : "";

  // Billing tag
  const billingTag = tenant?.billingType === "automated"
    ? { label: "AUTOMATED BILLING", color: "text-blue-500" }
    : tenant?.billingType === "manual"
      ? { label: "MANUAL PAY", color: "text-purple-500" }
      : tenant?.rentPaymentFrequency === "quarterly"
        ? { label: "QUARTERLY BILLING", color: "text-indigo-500" }
        : null;

  const unitLabel =
    Array.isArray(tenant?.units) && tenant.units.length > 0
      ? tenant.units.map((u) => u?.name).filter(Boolean).join(", ")
      : "—";

  const blockLabel = tenant?.block?.name ?? null;

  const locationLabel = [unitLabel !== "—" ? `Unit ${unitLabel}` : null, blockLabel ? `Block ${blockLabel}` : null]
    .filter(Boolean)
    .join(" • ") || "—";

  const DeleteTenant = async () => {
    try {
      if (!tenant?._id) { toast.error("Tenant ID is missing"); return; }
      const response = await api.patch(`/api/tenant/delete-tenant/${tenant._id}`);
      if (response.data.success) {
        toast.success(response.data.message);
        HandleDeleteTenant();
      } else {
        toast.error(response.data.message || "Failed to delete tenant");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "An error occurred while deleting tenant");
    }
  };

  return (
    <Card className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
      <CardContent className="p-4">
        {/* Top row: avatar + name/unit + menu */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <Avatar name={tenant?.name} />
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-tight">{tenant?.name || "—"}</p>
              <p className="text-xs text-gray-400 mt-0.5">{locationLabel}</p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-100 text-gray-400 transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs">Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/tenant/editTenant/${tenant._id}`)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/tenant/viewDetail/${tenant._id}`)}>
                View Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={DeleteTenant}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Rent + frequency + status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-gray-900">{rentDisplay}</span>
            {frequencyLabel && (
              <span className="text-[10px] font-semibold text-gray-400 tracking-wide">{frequencyLabel}</span>
            )}
          </div>
          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isActive
              ? "bg-green-50 text-green-600"
              : "bg-gray-100 text-gray-500"
              }`}
          >
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>

        {/* Lease end date */}
        <div className="flex items-center gap-1.5 mb-3">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-400">{tenant?.leaseEndDateNepali}</span>
        </div>

        {/* Billing tag */}
        {billingTag && (
          <p className={`text-[10px] font-bold tracking-widest mb-3 ${billingTag.color}`}>
            {billingTag.label}
          </p>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mb-3" />

        {/* Call + Email */}
        <div className="flex gap-2">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-green-50 hover:text-green-600 rounded-lg py-2 transition-colors font-medium"
            onClick={(e) => {
              e.stopPropagation();
              if (tenant?.phone) window.location.href = `tel:${tenant.phone}`;
            }}
          >
            <Phone className="w-3.5 h-3.5" />
            Call
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-sm text-gray-600 bg-gray-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg py-2 transition-colors font-medium"
            onClick={(e) => {
              e.stopPropagation();
              if (tenant?.email) window.location.href = `mailto:${tenant.email}`;
            }}
          >
            <Mail className="w-3.5 h-3.5" />
            Email
          </button>
        </div>
      </CardContent>
    </Card>
  );
}