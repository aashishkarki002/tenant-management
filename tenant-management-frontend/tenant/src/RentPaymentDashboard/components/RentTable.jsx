import React, { useMemo, useState, useCallback } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog } from "@/components/ui/dialog";
import { RentTableRow } from "./RentTableRow";
import { PaymentDialog } from "./PaymentDialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePaymentForm } from "../hooks/usePaymentForm";
import { sortRents } from "../utils/rentSort";
import { exportRentsToCsv } from "../utils/rentExport";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function rowFullySettled(rent, electricityRecords = []) {
  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";
  const hasElectricityDue = electricityRecords.some((r) => {
    const remaining =
      r.remainingAmount ?? Math.max(0, (r.totalAmount || 0) - (r.paidAmount || 0));
    return remaining > 0;
  });
  return rent.status === "paid" && !hasOutstandingLateFee && !hasElectricityDue;
}

const SORT_COLS = [
  { key: "tenant", label: "Tenant" },
  { key: "unit", label: "Unit" },
  { key: "rent", label: "Rent", right: true },
  { key: "cam", label: "CAM", right: true },
  { key: "electricity", label: "Electricity", right: true },
  { key: "total", label: "Total", right: true },
  { key: "dueDate", label: "Due date" },
  { key: "status", label: "Status" },
];

function SortHead({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  return (
    <TableHead
      className={cn(
        "whitespace-nowrap bg-transparent py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
        col.right && "text-right",
      )}
      aria-sort={
        col.key ? (active ? (sortDir === "asc" ? "ascending" : "descending") : "none") : undefined
      }
    >
      {col.key ? (
        <button
          type="button"
          onClick={() => onSort(col.key)}
          className={cn(
            "inline-flex items-center gap-0.5 hover:text-foreground transition-colors -mx-1 px-1 rounded",
            active && "text-foreground",
          )}
        >
          {col.label}
          {active ? (
            sortDir === "asc" ? (
              <ChevronUp className="size-3 opacity-60" />
            ) : (
              <ChevronDown className="size-3 opacity-60" />
            )
          ) : (
            <span
              className="inline-flex flex-col leading-none opacity-20 text-[7px] select-none ml-0.5"
              aria-hidden="true"
            >
              <span>▲</span>
              <span>▼</span>
            </span>
          )}
        </button>
      ) : (
        col.label
      )}
    </TableHead>
  );
}

/** Minimal floating action bar that appears when rows are selected */
const BulkActionBar = ({ count, onRemind, sendingEmails, onExport, onMarkPaid, onClear }) => (
  <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20 text-xs">
    <span className="text-muted-foreground tabular-nums font-medium">
      {count} selected
    </span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={sendingEmails}
        onClick={onRemind}
        className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        Send reminders
      </button>
      <button
        type="button"
        onClick={onExport}
        className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        Export
      </button>
      <button
        type="button"
        onClick={onMarkPaid}
        className="h-6 px-2 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        Mark paid
      </button>
      <button
        type="button"
        onClick={onClear}
        className="h-6 px-2 rounded text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        Clear
      </button>
    </div>
  </div>
);

export const RentTable = ({
  rents,
  cams,
  bankAccounts,
  electricityByTenantId = {},
  onRefresh,
  sendRentReminders,
  sendingEmails,
}) => {
  const {
    formik,
    allocationMode,
    setAllocationMode,
    rentAllocation,
    setRentAllocation,
    camAllocation,
    setCamAllocation,
    lateFeeAllocation,
    setLateFeeAllocation,
    electricityAllocations,
    setElectricityAllocations,
    totalElectricityAllocation,
    selectedBankAccountId,
    setSelectedBankAccountId,
    handleOpenDialog,
    handleAmountChange,
  } = usePaymentForm({ cams, onSuccess: onRefresh });

  const [selectedRent, setSelectedRent] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortKey, setSortKey] = useState("tenant");
  const [sortDir, setSortDir] = useState("asc");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkRemindOpen, setBulkRemindOpen] = useState(false);

  const sortedRents = useMemo(
    () => sortRents(rents, cams, sortKey, sortDir),
    [rents, cams, sortKey, sortDir],
  );

  const visibleIdSet = useMemo(
    () => new Set(sortedRents.map((r) => r._id).filter(Boolean)),
    [sortedRents],
  );

  const activeSelectedIds = useMemo(() => {
    const next = new Set();
    selectedIds.forEach((id) => {
      if (visibleIdSet.has(id)) next.add(id);
    });
    return next;
  }, [selectedIds, visibleIdSet]);

  const handleSort = useCallback(
    (key) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("asc");
      }
    },
    [sortKey],
  );

  const toggleOne = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allVisibleIds = sortedRents.map((r) => r._id).filter(Boolean);
  const allSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => activeSelectedIds.has(id));
  const someSelected = allVisibleIds.some((id) => activeSelectedIds.has(id));

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      allVisibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [allSelected, allVisibleIds]);

  const selectedRentsList = useMemo(
    () => sortedRents.filter((r) => r._id && activeSelectedIds.has(r._id)),
    [sortedRents, activeSelectedIds],
  );

  const getElecRecords = (rent) =>
    electricityByTenantId[rent.tenant?._id?.toString()] || [];

  const handleOpen = (rent, electricityRecords = []) => {
    setSelectedRent(rent);
    handleOpenDialog(rent, electricityRecords);
    setDialogOpen(true);
  };

  const handleBulkExport = () => {
    const list =
      selectedRentsList.length > 0 ? selectedRentsList : sortedRents;
    exportRentsToCsv(list, cams);
    toast.success(
      selectedRentsList.length > 0
        ? `Exported ${selectedRentsList.length} row(s).`
        : "Exported all visible rows.",
    );
  };

  const handleBulkMarkPaid = () => {
    if (activeSelectedIds.size === 0) return;
    if (activeSelectedIds.size !== 1) {
      toast.info("Select one unpaid row to record a payment.");
      return;
    }
    const rent = selectedRentsList[0];
    if (!rent) return;
    if (rowFullySettled(rent, getElecRecords(rent))) {
      toast.info("This row is already fully paid.");
      return;
    }
    if (rent.prevBalance) {
      toast.info("Use the Pay button on the row to handle this tenant's arrears.");
      return;
    }
    handleOpen(rent, getElecRecords(rent));
  };

  const headerCheckboxRef = React.useRef(null);
  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  // Electricity records for the currently open dialog (stable across re-renders)
  const selectedElecRecords = selectedRent ? getElecRecords(selectedRent) : [];

  return (
    <>
      {/* Bulk action bar */}
      {activeSelectedIds.size > 0 && (
        <BulkActionBar
          count={activeSelectedIds.size}
          sendingEmails={sendingEmails}
          onRemind={() => setBulkRemindOpen(true)}
          onExport={handleBulkExport}
          onMarkPaid={handleBulkMarkPaid}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <AlertDialog open={bulkRemindOpen} onOpenChange={setBulkRemindOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send rent reminders</AlertDialogTitle>
            <AlertDialogDescription>
              This sends reminder emails to all tenants with unpaid or overdue
              rent. Continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setBulkRemindOpen(false);
                await sendRentReminders?.();
              }}
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clean border-light table */}
      <div className="max-h-[min(70vh,820px)] overflow-auto">
        <table className="w-full caption-bottom text-sm min-w-[960px]">
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="border-b border-border/60 hover:bg-transparent">
              <TableHead className="w-10 px-3 py-2.5 bg-background">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAllVisible}
                  className="size-3.5 rounded border border-input accent-primary cursor-pointer"
                  aria-label="Select all rows"
                />
              </TableHead>
              {SORT_COLS.map((col) => (
                <SortHead
                  key={col.key || col.label}
                  col={col}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              ))}
              <TableHead className="py-2.5 text-right text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-transparent">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRents.length === 0 ? (
              <TableRow className="hover:bg-transparent border-0">
                <TableCell
                  colSpan={11}
                  className="py-20 text-center"
                >
                  <p className="text-sm text-muted-foreground">
                    No rents for this view
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Try a different period, frequency, or status filter.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              sortedRents.map((rent, idx) => (
                <RentTableRow
                  key={rent._id || idx}
                  rent={rent}
                  cams={cams}
                  bankAccounts={bankAccounts}
                  electricityRecords={getElecRecords(rent)}
                  onOpenPaymentDialog={handleOpen}
                  onRefresh={onRefresh}
                  selected={!!(rent._id && activeSelectedIds.has(rent._id))}
                  onToggleSelected={() => rent._id && toggleOne(rent._id)}
                />
              ))
            )}
          </TableBody>
        </table>
      </div>

      {selectedRent && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <PaymentDialog
            rent={selectedRent}
            cams={cams}
            bankAccounts={bankAccounts}
            electricityRecords={selectedElecRecords}
            formik={formik}
            allocationMode={allocationMode}
            setAllocationMode={setAllocationMode}
            rentAllocation={rentAllocation}
            setRentAllocation={setRentAllocation}
            camAllocation={camAllocation}
            setCamAllocation={setCamAllocation}
            lateFeeAllocation={lateFeeAllocation}
            setLateFeeAllocation={setLateFeeAllocation}
            electricityAllocations={electricityAllocations}
            setElectricityAllocations={setElectricityAllocations}
            totalElectricityAllocation={totalElectricityAllocation}
            selectedBankAccountId={selectedBankAccountId}
            setSelectedBankAccountId={setSelectedBankAccountId}
            handleAmountChange={handleAmountChange}
            onClose={() => setDialogOpen(false)}
            onTdsVerified={() => setDialogOpen(false)}
          />
        </Dialog>
      )}
    </>
  );
};
