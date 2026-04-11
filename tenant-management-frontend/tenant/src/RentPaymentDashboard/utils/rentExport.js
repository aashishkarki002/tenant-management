import { getPaymentAmounts, normalizeStatus } from "./paymentUtil";
import { formatNepaliDueDate } from "./dateUtils";

/**
 * Client-side CSV export for visible rent rows (no API).
 */
export function exportRentsToCsv(rents, cams) {
  const headers = [
    "Tenant",
    "Property",
    "Unit",
    "Rent",
    "CAM",
    "Total",
    "Due date",
    "Status",
  ];
  const rows = rents.map((rent) => {
    const { rentAmount, camAmount, totalDue } = getPaymentAmounts(rent, cams);
    const propertyName =
      rent.block?.name || rent.innerBlock?.name || "";
    const unitName =
      rent.units?.map((u) => u.name).filter(Boolean).join(", ") || "";
    return [
      rent.tenant?.name || "",
      propertyName,
      unitName,
      rentAmount,
      camAmount,
      totalDue,
      formatNepaliDueDate(rent),
      normalizeStatus(rent.status) || "",
    ];
  });
  const escape = (cell) => {
    const s = String(cell ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers, ...rows]
    .map((r) => r.map(escape).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rent-collection-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
