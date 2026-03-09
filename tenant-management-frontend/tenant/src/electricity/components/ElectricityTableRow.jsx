import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, CreditCard, Eye, Pencil } from "lucide-react";
import { getConsumption, formatConsumption } from "../utils/electricityCalculations";
import ElectricityPaymentDialog from "./ElectricityPaymentDialog";
import { useNavigate } from "react-router-dom";

const STATUS_STYLES = {
  paid: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    row: "",
  },
  pending: {
    badge: "bg-orange-50 text-orange-700 border border-orange-200",
    row: "bg-orange-50/30",
  },
  overdue: {
    badge: "bg-red-50 text-red-700 border border-red-200",
    row: "bg-red-50/30",
  },
  partially_paid: {
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
    row: "bg-blue-50/20",
  },
};

function getStatusConfig(status) {
  return STATUS_STYLES[String(status).toLowerCase()] ?? {
    badge: "bg-gray-50 text-gray-600 border border-gray-200",
    row: "",
  };
}

export function ElectricityTableRow({ record, index, onPaymentRecorded }) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const navigate = useNavigate();

  const unitName =
    record.unit?.name ??
    record.unit?.unitName ??
    record.subMeter?.name ??
    record.subMeter?.displayName ??
    `Row ${index + 1}`;

  const isGeneratorMeter =
    record.meterType === "sub_meter" &&
    (record.subMeter?.name ?? "").startsWith("Generator –");

  const consumption =
    record.unitsConsumed != null && !Number.isNaN(Number(record.unitsConsumed))
      ? Number(record.unitsConsumed)
      : getConsumption(record);

  const status = record.status || "pending";
  const statusConfig = getStatusConfig(status);
  const totalAmount = Number(record.totalAmount) || 0;
  const paidAmount = Number(record.paidAmount) || 0;
  const remainingAmount =
    record.remainingAmount != null
      ? Number(record.remainingAmount)
      : Math.max(0, totalAmount - paidAmount);

  const fmt = (n) =>
    `Rs ${Number(n).toLocaleString("en-NP", { minimumFractionDigits: 0 })}`;

  const totalAmountFormatted = record.totalAmountFormatted ?? fmt(totalAmount);
  const paidAmountFormatted = record.paidAmountFormatted ?? (paidAmount > 0 ? fmt(paidAmount) : null);
  const remainingAmountFormatted = record.remainingAmountFormatted ?? fmt(remainingAmount);

  const PAYABLE_STATUSES = new Set(["pending", "partially_paid", "overdue"]);
  const isPayable = remainingAmount > 0 && PAYABLE_STATUSES.has(String(status).toLowerCase());

  const openPaymentDialog = useCallback(() => setPaymentDialogOpen(true), []);

  const handleViewDetails = useCallback(() => {
    if (record.tenant?._id) {
      navigate(`/tenant/viewDetail/${record.tenant._id}`);
    }
  }, [record.tenant?._id, navigate]);

  return (
    <>
      <tr className={`hover:bg-surface transition-colors ${statusConfig.row}`}>
        {/* NAME */}
        <td className="py-3 px-4">
          <div className="font-medium text-sm text-text-strong">{unitName}</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {isGeneratorMeter && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-warning-bg text-warning border border-warning-border">
                Generator
              </span>
            )}
            {record.isTenantTransition && (
              <span
                title="Previous tenant moved out"
                className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
              >
                Transition
              </span>
            )}
            {!record.tenant && record.meterType === "unit" && (
              <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                Vacant
              </span>
            )}
          </div>
        </td>

        {/* TYPE */}
        <td className="py-3 px-4">
          <span className="text-xs font-medium text-[#625848] capitalize">
            {record.meterType?.replace("_", " ") || "-"}
          </span>
        </td>

        {/* BUILDING */}
        <td className="py-3 px-4 text-sm text-[#625848]">
          {record.unit?.block?.name ?? record.subMeter?.block?.name ?? "-"}
        </td>

        {/* PREVIOUS */}
        <td className="py-3 px-4 text-sm text-[#625848] tabular-nums">
          {Number(record.previousReading) > 0
            ? Number(record.previousReading).toFixed(1)
            : "-"}
        </td>

        {/* CURRENT */}
        <td className="py-3 px-4 text-sm text-[#625848] tabular-nums">
          {Number(record.currentReading) > 0
            ? Number(record.currentReading).toFixed(1)
            : "-"}
        </td>

        {/* CONSUMPTION */}
        <td className="py-3 px-4">
          {consumption > 0 ? (
            <span className="text-sm font-semibold text-blue-600 tabular-nums">
              {formatConsumption(consumption)} kWh
            </span>
          ) : (
            <span className="text-sm text-[#AFA097]">-</span>
          )}
        </td>

        {/* BILL AMOUNT */}
        <td className="py-3 px-4">
          <span className="text-sm font-medium text-[#1C1A18] tabular-nums">
            {totalAmountFormatted}
          </span>
        </td>

        {/* STATUS */}
        <td className="py-3 px-4">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${statusConfig.badge}`}
          >
            {status.replace("_", " ")}
          </span>
        </td>

        {/* READING DATE */}
        <td className="py-3 px-4 text-xs text-[#948472] tabular-nums whitespace-nowrap">
          {record.nepaliDate ?? record.readingDate?.slice(0, 10) ?? "-"}
        </td>

        {/* ACTIONS */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-1">
            {isPayable && (
              <Button
                size="sm"
                onClick={openPaymentDialog}
                className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              >
                <CreditCard className="w-3 h-3 mr-1" />
                Pay
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-[#948472] hover:text-[#1C1A18] hover:bg-[#F0EDE9] rounded-md"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {record.tenant?._id && (
                  <DropdownMenuItem
                    onClick={handleViewDetails}
                    className="text-sm cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 mr-2" />
                    View Details
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-sm cursor-pointer"
                  disabled
                >
                  <Pencil className="w-3.5 h-3.5 mr-2" />
                  Edit Reading
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </td>
      </tr>

      <ElectricityPaymentDialog
        paymentDialogOpen={paymentDialogOpen}
        setPaymentDialogOpen={setPaymentDialogOpen}
        unitName={unitName}
        record={record}
        totalAmountFormatted={totalAmountFormatted}
        paidAmount={paidAmount}
        paidAmountFormatted={paidAmountFormatted}
        remainingAmount={remainingAmount}
        remainingAmountFormatted={remainingAmountFormatted}
        onPaymentRecorded={onPaymentRecorded}
      />
    </>
  );
}
