import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useBackfillRent } from "../hooks/useBackfillRent";
import api from "../../../plugins/axios";
import { getTodayNepali } from "@/utils/nepaliDate";

// ── Nepali month names (1-based index) ────────────────────────────────────────
const NEPALI_MONTH_NAMES = [
  "", // pad so index 1 = Baisakh
  "Baisakh", "Jestha", "Ashadh", "Shrawan",
  "Bhadra", "Ashwin", "Kartik", "Mangsir",
  "Poush", "Magh", "Falgun", "Chaitra",
];

/**
 * Generate the past `count` Nepali months going back from (but not including)
 * the current BS month.
 *
 * Uses getTodayNepali() — the same canonical BS date source used across the app —
 * so the month list is always accurate, even at year boundaries.
 *
 * Returns [{ nepaliYear, nepaliMonth }] sorted oldest → newest.
 */
function pastNepaliMonths(count = 24) {
  const today = getTodayNepali();
  let bsYear = today.year;
  let bsMonth = today.month;

  const months = [];
  for (let i = 0; i < count; i++) {
    bsMonth -= 1;
    if (bsMonth < 1) {
      bsMonth = 12;
      bsYear -= 1;
    }
    months.unshift({ nepaliYear: bsYear, nepaliMonth: bsMonth });
  }
  return months; // oldest first
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BackfillRentDialog = ({ open, onOpenChange, onSuccess }) => {
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [existingMonthSet, setExistingMonthSet] = useState(new Set());
  const [existingLoading, setExistingLoading] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(new Set());

  const months = pastNepaliMonths(24);

  const { backfillRent, loading } = useBackfillRent({
    onSuccess: () => {
      onOpenChange(false);
      onSuccess?.();
    },
  });

  // Fetch active tenants when dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedTenantId("");
    setSelectedMonths(new Set());
    setExistingMonthSet(new Set());
    setTenantsLoading(true);
    api
      .get("/api/tenant/get-tenants?status=active")
      .then((res) => setTenants(res.data?.tenants || res.data?.data || []))
      .catch(() => setTenants([]))
      .finally(() => setTenantsLoading(false));
  }, [open]);

  // When tenant changes, fetch their existing rents to mark already-created months
  const handleTenantChange = useCallback(async (id) => {
    setSelectedTenantId(id);
    setSelectedMonths(new Set());
    setExistingMonthSet(new Set());
    if (!id) return;
    setExistingLoading(true);
    try {
      const res = await api.get(`/api/rent/get-rents-by-tenant/${id}`);
      const rents = res.data?.rents || [];
      const keys = new Set(
        rents.map((r) => `${r.nepaliYear}-${r.nepaliMonth}`),
      );
      setExistingMonthSet(keys);
    } catch {
      setExistingMonthSet(new Set());
    } finally {
      setExistingLoading(false);
    }
  }, []);

  const toggleMonth = (nepaliYear, nepaliMonth) => {
    const key = `${nepaliYear}-${nepaliMonth}`;
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = () => {
    const monthsToCreate = months
      .filter((m) => selectedMonths.has(`${m.nepaliYear}-${m.nepaliMonth}`))
      .map(({ nepaliYear, nepaliMonth }) => ({ nepaliYear, nepaliMonth }));
    backfillRent({ tenantId: selectedTenantId, months: monthsToCreate });
  };

  const selectedTenant = tenants.find((t) => t._id === selectedTenantId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Backfill Past Rent</DialogTitle>
          <DialogDescription>
            Create rent records for a specific tenant for past months that were
            missed or not yet entered. Already-existing months are greyed out.
          </DialogDescription>
        </DialogHeader>

        {/* ── Tenant select ── */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Tenant
          </label>
          {tenantsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Loading tenants…
            </div>
          ) : (
            <Select value={selectedTenantId} onValueChange={handleTenantChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="— select tenant —" />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* ── Paisa preview ── */}
        {selectedTenant && (
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground flex gap-4">
            <span>
              Gross:{" "}
              <strong className="text-foreground">
                Rs {((selectedTenant.grossAmountPaisa || selectedTenant.totalRentPaisa || 0) / 100).toLocaleString()}
              </strong>
            </span>
            <span>
              Net:{" "}
              <strong className="text-foreground">
                Rs {((selectedTenant.totalRentPaisa || 0) / 100).toLocaleString()}
              </strong>
            </span>
          </div>
        )}

        {/* ── Month grid ── */}
        {selectedTenantId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Select months to create
              </label>
              {existingLoading && <Spinner className="h-3.5 w-3.5" />}
            </div>

            <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
              {months.map(({ nepaliYear, nepaliMonth }) => {
                const key = `${nepaliYear}-${nepaliMonth}`;
                const alreadyExists = existingMonthSet.has(key);
                const isSelected = selectedMonths.has(key);

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={alreadyExists}
                    onClick={() => toggleMonth(nepaliYear, nepaliMonth)}
                    className={[
                      "rounded-md border px-2 py-1.5 text-xs text-left transition-colors",
                      alreadyExists
                        ? "cursor-not-allowed border-border bg-muted text-muted-foreground opacity-50"
                        : isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-background hover:bg-accent hover:text-accent-foreground",
                    ].join(" ")}
                  >
                    <span className="block font-medium">
                      {NEPALI_MONTH_NAMES[nepaliMonth]}
                    </span>
                    <span className="text-[10px] opacity-70">{nepaliYear}</span>
                    {alreadyExists && (
                      <span className="block text-[10px] text-green-600 font-medium">
                        exists
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedMonths.size > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedMonths.size} month{selectedMonths.size > 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selectedTenantId || selectedMonths.size === 0}
          >
            {loading ? (
              <>
                <Spinner className="mr-1.5 h-3.5 w-3.5" /> Creating…
              </>
            ) : (
              `Create ${selectedMonths.size || ""} Record${selectedMonths.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
