import React, { useMemo, useState, useCallback } from "react";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { sortRents } from "../utils/rentSort";
import { exportRentsToCsv } from "../utils/rentExport";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

function rowFullySettled(rent) {
  const hasOutstandingLateFee =
    rent.lateFeeApplied &&
    rent.lateFeePaisa > 0 &&
    rent.lateFeeStatus !== "paid";
  return rent.status === "paid" && !hasOutstandingLateFee;
}

const SORT_COLS = [
  { key: "tenant", label: "Tenant" },
  { key: "unit", label: "Unit" },
  { key: "rent", label: "Rent" },
  { key: "cam", label: "CAM" },
  { key: "total", label: "Total" },
  { key: "dueDate", label: "Due date" },
  { key: "status", label: "Status" },
];

function SortHead({ col, sortKey, sortDir, onSort }) {
  const active = sortKey === col.key;
  const ariaSort = active ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <TableHead
      className="whitespace-nowrap bg-background"
      aria-sort={col.key ? ariaSort : undefined}
    >
      {col.key ? (
        <button
          type="button"
          onClick={() => onSort(col.key)}
          className={cn(
            "inline-flex items-center gap-0.5 font-medium text-foreground hover:text-foreground/80 -mx-1 px-1 rounded",
          )}
        >
          {col.label}
          {active ? (
            sortDir === "asc" ? (
              <ChevronUp className="size-3.5 opacity-70" />
            ) : (
              <ChevronDown className="size-3.5 opacity-70" />
            )
          ) : (
            <span className="inline-flex flex-col leading-none opacity-25 text-[8px] select-none" aria-hidden="true">
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

export const RentTable = ({
  rents,
  cams,
  bankAccounts,
  formik,
  allocationMode,
  setAllocationMode,
  rentAllocation,
  setRentAllocation,
  camAllocation,
  setCamAllocation,
  lateFeeAllocation,
  setLateFeeAllocation,
  selectedBankAccountId,
  setSelectedBankAccountId,
  handleOpenDialog,
  handleAmountChange,
  onRefresh,
  sendRentReminders, // used for bulk action bar only
  sendingEmails,     // used for bulk action bar only
}) => {
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

  const handleSort = useCallback((key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

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

  const handleOpen = (rent) => {
    setSelectedRent(rent);
    handleOpenDialog(rent);
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
    if (rowFullySettled(rent)) {
      toast.info("This row is already fully paid.");
      return;
    }
    if (rent.prevBalance) {
      toast.info("Use the Pay button on the row to handle this tenant's arrears.");
      return;
    }
    handleOpen(rent);
  };

  const headerCheckboxRef = React.useRef(null);
  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (el) el.indeterminate = someSelected && !allSelected;
  }, [someSelected, allSelected]);

  return (
    <>
      {activeSelectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 px-3 py-2.5 border-b border-border bg-muted/30 text-xs">
          <span className="font-medium text-muted-foreground tabular-nums">
            {activeSelectedIds.size} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={sendingEmails}
              onClick={() => setBulkRemindOpen(true)}
            >
              Send reminders
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleBulkExport}
            >
              Export
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={handleBulkMarkPaid}
            >
              Mark paid
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={bulkRemindOpen} onOpenChange={setBulkRemindOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send rent reminders</AlertDialogTitle>
            <AlertDialogDescription>
              This sends reminder emails to all tenants with unpaid or overdue rent
              (same as Send Reminders in the toolbar). Continue?
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

      <div className="relative rounded-md border border-border bg-background">
        <div className="max-h-[min(70vh,800px)] overflow-auto">
          <table className="w-full caption-bottom text-sm min-w-[920px]">
            <TableHeader className="sticky top-0 z-10 bg-background [&_tr]:border-b">
              <TableRow className="hover:bg-transparent border-b border-border bg-background shadow-[inset_0_-1px_0_0_hsl(var(--border))]">
                <TableHead className="w-10 px-2 bg-background">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAllVisible}
                    className={cn(
                      "size-3.5 rounded border border-input accent-primary cursor-pointer",
                    )}
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
                <TableHead className="whitespace-nowrap text-right bg-background">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRents.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="py-16 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-10 w-10 text-muted-foreground/40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M3 21h18M12 3a4 4 0 100 8 4 4 0 000-8z"
                        />
                      </svg>
                      <p className="text-sm font-medium">No rents for this view</p>
                      <p className="text-xs text-muted-foreground/70">
                        Try another period, frequency, or status filter.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedRents.map((rent, idx) => (
                  <RentTableRow
                    key={rent._id || idx}
                    rent={rent}
                    cams={cams}
                    bankAccounts={bankAccounts}
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
      </div>

      {selectedRent && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <PaymentDialog
            rent={selectedRent}
            cams={cams}
            bankAccounts={bankAccounts}
            formik={formik}
            allocationMode={allocationMode}
            setAllocationMode={setAllocationMode}
            rentAllocation={rentAllocation}
            setRentAllocation={setRentAllocation}
            camAllocation={camAllocation}
            setCamAllocation={setCamAllocation}
            lateFeeAllocation={lateFeeAllocation}
            setLateFeeAllocation={setLateFeeAllocation}
            selectedBankAccountId={selectedBankAccountId}
            setSelectedBankAccountId={setSelectedBankAccountId}
            handleAmountChange={handleAmountChange}
            onClose={() => setDialogOpen(false)}
            onTdsVerified={() => {
              setDialogOpen(false);
            }}
          />
        </Dialog>
      )}
    </>
  );
};
