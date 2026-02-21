import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { getConsumption, formatConsumption } from "../utils/electricityCalculations";
import ElectricityPaymentDialog from "./ElectricityPaymentDialog";

function getStatusBadge(status) {
  switch (String(status).toLowerCase()) {
    case "paid": return "bg-green-100 text-green-700";
    case "pending": return "bg-orange-100 text-orange-700";
    case "overdue": return "bg-red-100 text-red-700";
    case "partially_paid": return "bg-blue-100 text-blue-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

/**
 * ElectricityTableRow
 *
 * Renders one reading record. Column order matches ElectricityTable thead:
 * Name | Type | Building | Block | Prev | Curr | Consumption | Bill | Status | Action | Receipt | Reading Date
 *
 * Field-name alignment with the controller / DB model:
 *   unitsConsumed  — stored by the service (falls back to curr - prev via getConsumption)
 *   totalAmount    — already a number (paise conversion happens server-side)
 *   paidAmount     — same
 *   remainingAmount — same
 */
export function ElectricityTableRow({ record, index, onPaymentRecorded }) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);

  const unitName =
    record.unit?.name ??
    record.unit?.unitName ??
    record.subMeter?.name ??
    record.subMeter?.displayName ??
    `Row ${index + 1}`;

  // Controller stores consumption as `unitsConsumed`; fall back to calculation
  const consumption =
    record.unitsConsumed != null && !Number.isNaN(Number(record.unitsConsumed))
      ? Number(record.unitsConsumed)
      : getConsumption(record);

  const status = record.status || "pending";

  const totalAmount = Number(record.totalAmount) || 0;
  const paidAmount = Number(record.paidAmount) || 0;
  const remainingAmount =
    record.remainingAmount != null
      ? Number(record.remainingAmount)
      : Math.max(0, totalAmount - paidAmount);

  const fmt = (n) =>
    `Rs. ${Number(n).toLocaleString("en-NP", { minimumFractionDigits: 2 })}`;

  const totalAmountFormatted = record.totalAmountFormatted ?? fmt(totalAmount);
  const paidAmountFormatted = record.paidAmountFormatted ?? (paidAmount > 0 ? fmt(paidAmount) : null);
  const remainingAmountFormatted = record.remainingAmountFormatted ?? fmt(remainingAmount);

  const isPayable =
    remainingAmount > 0 && String(status).toLowerCase() === "pending";

  const openPaymentDialog = useCallback(() => setPaymentDialogOpen(true), []);

  // Receipt URL: backend stores as receipt.url (Cloudinary secure_url); support legacy flat fields
  const receiptUrl =
    record.receipt?.url ??
    (typeof record.receipt === "string" ? record.receipt : null) ??
    record.receiptImageUrl ??
    record.receiptImage ??
    null;

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50">
        {/* NAME */}
        <td className="py-3 px-4">
          <div className="font-medium">{unitName}</div>
        </td>

        {/* TYPE */}
        <td className="py-3 px-4 text-sm capitalize">
          {record.meterType?.replace("_", " ") || "-"}
        </td>

        {/* BUILDING */}
        <td className="py-3 px-4 text-sm">
          {record.unit?.block?.name ?? record.subMeter?.block?.name ?? "-"}
        </td>

        {/* BLOCK */}
        <td className="py-3 px-4 text-sm">
          {record.unit?.innerBlock?.name ?? record.subMeter?.innerBlock?.name ?? "-"}
        </td>

        {/* PREVIOUS */}
        <td className="py-3 px-4 text-sm">
          {Number(record.previousReading) > 0
            ? Number(record.previousReading).toFixed(1)
            : "-"}
        </td>

        {/* CURRENT */}
        <td className="py-3 px-4 text-sm">
          {Number(record.currentReading) > 0
            ? Number(record.currentReading).toFixed(1)
            : "-"}
        </td>

        {/* CONSUMPTION */}
        <td className="py-3 px-4">
          {consumption > 0 ? (
            <span className="text-sm font-medium text-blue-600">
              {formatConsumption(consumption)} kWh
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>

        {/* BILL */}
        <td className="py-3 px-4 text-sm">{totalAmountFormatted}</td>

        {/* STATUS */}
        <td className="py-3 px-4">
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(status)}`}
          >
            {status.replace("_", " ").toUpperCase()}
          </span>
        </td>

        {/* ACTION */}
        <td className="py-3 px-4">
          {isPayable ? (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={openPaymentDialog}
            >
              Pay
            </Button>
          ) : (
            <span className="text-xs text-gray-400">
              {status.toLowerCase() === "paid" ? "Completed" : "-"}
            </span>
          )}
        </td>

        {/* RECEIPT */}
        <td className="py-3 px-4 text-sm">
          {receiptUrl ? (
            <a
              href={receiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline text-xs hover:text-blue-800"
            >
              View
            </a>
          ) : (
            <span className="text-gray-400 text-xs">-</span>
          )}
        </td>

        {/* READING DATE */}
        <td className="py-3 px-4 text-sm text-gray-600">
          {record.nepaliDate ?? record.readingDate?.slice(0, 10) ?? "-"}
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