import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormik } from "formik";
import api from "../../../plugins/axios";
import {
  Loader2,
  Building2,
  Sparkles,
  User,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import DualCalendarTailwind from "@/components/dualDate";
import useOwnership from "../../hooks/use-ownership";
import dateConverter from "nepali-datetime/dateConverter";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const formatBsFromParts = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** BS "YYYY-MM-DD" for an AD calendar day (same logic as DualCalendarTailwind). */
function englishIsoToNepaliString(iso) {
  if (!iso || typeof iso !== "string") return "";
  try {
    const [enYear, enMonthHuman, enDay] = iso.split("-").map(Number);
    const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
      enYear,
      enMonthHuman - 1,
      enDay,
    );
    return formatBsFromParts(npYear, npMonth0 + 1, npDay);
  } catch {
    return "";
  }
}

function getEntityBadgeColor(type) {
  switch (type) {
    case "private":
      return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
    case "company":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800";
    case "head_office":
      return "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-400 dark:border-violet-800";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function getEntityTypeLabel(type) {
  switch (type) {
    case "private":
      return "Private";
    case "company":
      return "Company";
    case "head_office":
      return "Head Office";
    default:
      return type ?? "Unknown";
  }
}

function getOwnershipLabel(entity) {
  if (!entity || typeof entity !== "object") return null;
  return entity.name || getEntityTypeLabel(entity.type);
}

function ownershipEntityIdFromBlock(block) {
  if (!block) return "";
  const ref = block.ownershipEntityId ?? block.ownershipEntity;
  const id = ref?._id ?? ref;
  return id != null ? String(id) : "";
}

function blocksForOwnershipEntity(blocks, entityId) {
  if (!entityId || !Array.isArray(blocks)) return [];
  const target = String(entityId);
  return blocks.filter((b) => ownershipEntityIdFromBlock(b) === target);
}

const getInitialValues = () => {
  const date = new Date().toISOString().split("T")[0];
  return {
  payerType: "tenant",
  tenantId: "",
  externalPayerName: "",
  externalPayerType: "PERSON",
  sourceId: "",
  amount: "",
  date,
  nepaliDate: englishIsoToNepaliString(date),
  notes: "",
  paymentMethod: "bank_transfer",
  bankAccountId: "",
  // Ownership fields
  entityId: "",
  blockId: "",
  transactionScope: "building",
  // Manual override flag
  entityOverridden: false,
};
};

// ─────────────────────────────────────────────────────────────────────────────
// Entity Resolution Banner
// Shows auto-resolved entity (from tenant block) or manual picker
// ─────────────────────────────────────────────────────────────────────────────

function EntityResolutionBanner({
  resolvedEntity,
  resolvedBlock,
  resolving,
  error,
  isAutoResolved,
  allEntities,
  entitiesLoading,
  manualEntityId,
  onManualEntityChange,
  payerType,
}) {
  // For external payers — always show manual selector
  if (payerType === "external") {
    return (
      <div className="space-y-2">
        <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3 h-3" />
          Receiving Entity
        </Label>
        <Select
          value={manualEntityId || ""}
          onValueChange={onManualEntityChange}
          disabled={entitiesLoading}
        >
          <SelectTrigger className="w-full h-11 rounded-xl text-sm">
            <SelectValue placeholder={entitiesLoading ? "Loading entities…" : "— select entity —"} />
          </SelectTrigger>
          <SelectContent>
            {allEntities.map((e) => (
              <SelectItem key={e._id} value={e._id}>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${getEntityBadgeColor(e.type)}`}
                  >
                    {getEntityTypeLabel(e.type)}
                  </span>
                  {e.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {manualEntityId && (
          <p className="text-[11px] text-muted-foreground">
            Revenue will be recorded under the selected entity.
          </p>
        )}
      </div>
    );
  }

  // For tenants — show auto-resolution state
  if (resolving) {
    return (
      <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-muted/40 border border-border animate-pulse">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">
          Resolving ownership from tenant's block…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Could not auto-resolve entity
          </p>
          <p className="text-xs text-amber-600/80 dark:text-amber-500 mt-0.5">
            {error} — please select manually below.
          </p>
          <div className="mt-2">
            <Select
              value={manualEntityId || ""}
              onValueChange={onManualEntityChange}
              disabled={entitiesLoading}
            >
              <SelectTrigger className="w-full h-9 rounded-lg text-sm border-amber-300 dark:border-amber-700">
                <SelectValue placeholder={entitiesLoading ? "Loading entities…" : "— select entity —"} />
              </SelectTrigger>
              <SelectContent>
                {allEntities.map((e) => (
                  <SelectItem key={e._id} value={e._id}>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${getEntityBadgeColor(e.type)}`}
                      >
                        {getEntityTypeLabel(e.type)}
                      </span>
                      {e.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  if (isAutoResolved && resolvedEntity) {
    return (
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Auto-resolved header */}
        <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/30 border-b border-border">
          <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Auto-resolved from tenant's block
          </span>
        </div>

        {/* Breadcrumb trail: Tenant → Block → Entity */}
        <div className="px-4 py-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Tenant node */}
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
              <User className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                Tenant
              </span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />

            {/* Block node */}
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1.5">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              <span className="text-xs font-medium text-foreground">
                {resolvedBlock?.name || "Block"}
              </span>
            </div>

            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />

            {/* Entity node — highlighted */}
            <div
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border font-semibold text-xs ${getEntityBadgeColor(resolvedEntity.type)}`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>{resolvedEntity.name || getEntityTypeLabel(resolvedEntity.type)}</span>
              <span className="opacity-60 font-normal">
                ({getEntityTypeLabel(resolvedEntity.type)})
              </span>
            </div>
          </div>

          {/* Override link */}
          <button
            type="button"
            onClick={() => onManualEntityChange("__override__")}
            className="mt-2 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Override entity manually
          </button>
        </div>
      </div>
    );
  }

  // No tenant selected yet — placeholder
  return (
    <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-muted/30 border border-dashed border-border">
      <Building2 className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-sm text-muted-foreground/70">
        Select a tenant to auto-resolve the owning entity
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ─────────────────────────────────────────────────────────────────────────────

export function AddRevenueDialog({
  open,
  onOpenChange,
  tenants,
  revenueSource: revenueSourceProp,
  bankAccounts = [],
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

  // Fetch all ownership entities and blocks via hook
  const { 
    entities: entitiesProp, 
    blocks, 
    loading: entitiesLoading, 
    getBlocksForEntity 
  } = useOwnership();

  // Entity resolution state
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(null);
  const [resolvedEntity, setResolvedEntity] = useState(null); // { _id, name, type }
  const [resolvedBlock, setResolvedBlock] = useState(null);   // { _id, name }
  const [isAutoResolved, setIsAutoResolved] = useState(false);
  const [showManualOverride, setShowManualOverride] = useState(false);
  const [manualEntityId, setManualEntityId] = useState("");

  // Normalise revenueSource prop
  const revenueSource = useMemo(() => {
    if (!revenueSourceProp) return [];
    if (Array.isArray(revenueSourceProp)) return revenueSourceProp;
    if (Array.isArray(revenueSourceProp?.data)) return revenueSourceProp.data;
    if (Array.isArray(revenueSourceProp?.revenueSource)) return revenueSourceProp.revenueSource;
    return [];
  }, [revenueSourceProp]);

  // Normalise entities from hook (already a plain array, but guard anyway)
  const allEntities = useMemo(() => {
    if (!entitiesProp) return [];
    if (Array.isArray(entitiesProp)) return entitiesProp;
    return [];
  }, [entitiesProp]);

  // The final entityId to use in the submit payload
  const resolvedEntityId = useMemo(() => {
    if (showManualOverride || !isAutoResolved) return manualEntityId;
    return resolvedEntity?._id || "";
  }, [showManualOverride, isAutoResolved, resolvedEntity, manualEntityId]);

  const formik = useFormik({
    initialValues: getInitialValues(),
    onSubmit: async (values) => {
      const entityId = resolvedEntityId;
      if (!entityId) {
        // Surface validation error — entity is required
        return;
      }

      const entity = allEntities.find((e) => e._id === entityId);
      const transactionScope =
        entity?.type === "head_office" ? "head_office" : "building";
      if (transactionScope === "building" && !values.blockId) {
        return;
      }

      setSubmitting(true);
      try {
        const payerType = values.payerType === "tenant" ? "TENANT" : "EXTERNAL";
        const paymentMethod = String(values.paymentMethod || "bank_transfer").toLowerCase();

        const adDate = values.date || new Date().toISOString().split("T")[0];
        const bsDate =
          values.nepaliDate?.trim() || englishIsoToNepaliString(adDate);
        const payload = {
          source: values.sourceId,
          amount: Number(values.amount),
          date: adDate,
          nepaliDate: bsDate || undefined,
          payerType,
          referenceType: "MANUAL",
          notes: values.notes || undefined,
          paymentMethod,
          // Ownership fields
          entityId,
          blockId:
            transactionScope === "head_office"
              ? undefined
              : values.blockId || undefined,
          transactionScope,
        };

        if (paymentMethod === "bank_transfer" || paymentMethod === "cheque") {
          if (values.bankAccountId) payload.bankAccountId = values.bankAccountId;
        }

        if (payerType === "TENANT") {
          payload.tenant =
            typeof values.tenantId === "object"
              ? values.tenantId?._id
              : values.tenantId;
        } else {
          payload.externalPayer = {
            name: values.externalPayerName,
            type: values.externalPayerType,
          };
        }

        const response = await api.post("/api/revenue/create", payload);
        if (response.data?.success) {
          onSuccess?.(response.data);
          handleClose();
        } else {
          console.error(response.data?.message || "Create failed");
        }
      } catch (err) {
        console.error("Error creating revenue:", err);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm({ values: getInitialValues() });
    setSelectedBankAccountId("");
    resetEntityResolution();
    onOpenChange(false);
  };

  const resetEntityResolution = () => {
    setResolving(false);
    setResolveError(null);
    setResolvedEntity(null);
    setResolvedBlock(null);
    setIsAutoResolved(false);
    setShowManualOverride(false);
    setManualEntityId("");
    formik.setFieldValue("blockId", "");
  };

  useEffect(() => {
    if (!open) return;
    formik.resetForm({ values: getInitialValues() });
    setSelectedBankAccountId("");
    resetEntityResolution();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep formik.blockId in sync with resolved entity + tenant block / block list
  useEffect(() => {
    if (!open) return;
    if (!resolvedEntityId) {
      formik.setFieldValue("blockId", "");
      return;
    }
    const ent = allEntities.find((e) => String(e._id) === String(resolvedEntityId));
    if (!ent || ent.type === "head_office") {
      formik.setFieldValue("blockId", "");
      return;
    }
    const list = getBlocksForEntity(resolvedEntityId);
    if (
      resolvedBlock?._id &&
      list.some((b) => String(b._id) === String(resolvedBlock._id))
    ) {
      formik.setFieldValue("blockId", String(resolvedBlock._id));
      return;
    }
    if (list.length === 1) {
      formik.setFieldValue("blockId", String(list[0]._id));
      return;
    }
    const cur = formik.values.blockId;
    const valid = cur && list.some((b) => String(b._id) === String(cur));
    if (!valid) formik.setFieldValue("blockId", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from entity/block list; avoid loop on blockId
  }, [open, resolvedEntityId, allEntities, resolvedBlock?._id, getBlocksForEntity]);

  // ── Auto-resolve entity when tenant changes ──────────────────────────────
  const resolveTenantEntity = useCallback(async (tenantId) => {
    if (!tenantId) {
      resetEntityResolution();
      return;
    }

    setResolving(true);
    setResolveError(null);
    setIsAutoResolved(false);
    setResolvedEntity(null);
    setResolvedBlock(null);

    try {
      // Fetch tenant details — includes block reference
      const tenantRes = await api.get(`/api/tenant/get-tenant/${tenantId}`);
      const tenant = tenantRes.data?.tenant || tenantRes.data?.data;

      if (!tenant) throw new Error("Tenant data not found");

      const blockId = tenant.block?._id || tenant.block;
      if (!blockId) throw new Error("Tenant has no block assigned");

      // Fetch block to get ownershipEntityId
      let block = null;
      let entity = null;

      // Check if block is already in the local blocks list (from hook)
      block = blocks.find((b) => String(b._id) === String(blockId));

      if (!block) {
        // Fallback to API call
        try {
          const blockRes = await api.get(`/api/blocks/${blockId}`);
          block = blockRes.data?.block || blockRes.data?.data;
        } catch {
          // If no dedicated block endpoint, check the property tree
          const propRes = await api.get("/api/property/get-property");
          const tree = propRes.data?.property || propRes.data?.data;
          const blocksList = tree?.blocks || [];
          block = blocksList.find((b) => b._id === blockId || b._id?.toString() === blockId?.toString());
        }
      }

      if (!block) throw new Error("Block not found");

      const entityId = block.ownershipEntityId?._id || block.ownershipEntityId;
      if (!entityId) throw new Error("Block has no ownership entity assigned");

      // Try to find entity in the local allEntities list first (no extra call)
      entity = allEntities.find(
        (e) => e._id === entityId || e._id?.toString() === entityId?.toString()
      );

      if (!entity) {
        // Fallback: fetch from ownership endpoint
        const entityRes = await api.get(`/api/ownership/${entityId}`);
        entity = entityRes.data?.entity || entityRes.data?.data;
      }

      if (!entity) throw new Error("Ownership entity not found");

      setResolvedBlock({ _id: block._id, name: block.name });
      setResolvedEntity({ _id: entity._id, name: entity.name, type: entity.type });
      setIsAutoResolved(true);
      setShowManualOverride(false);
    } catch (err) {
      console.error("Entity resolution failed:", err);
      setResolveError(err.message || "Unknown error");
    } finally {
      setResolving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formik.setFieldValue is stable for this dialog
  }, [allEntities, blocks]);

  // Trigger resolution when tenant changes
  useEffect(() => {
    const tenantId = typeof formik.values.tenantId === "object"
      ? formik.values.tenantId?._id
      : formik.values.tenantId;

    if (formik.values.payerType === "tenant" && tenantId) {
      resolveTenantEntity(tenantId);
    } else {
      resetEntityResolution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formik.values.tenantId, formik.values.payerType]);

  const handleManualEntityChange = (value) => {
    if (value === "__override__") {
      setShowManualOverride(true);
      setManualEntityId("");
    } else {
      setManualEntityId(value);
      // If they pick an entity manually, update block tracking too
      if (showManualOverride) {
        setResolvedBlock(null); // block unknown in manual mode
      }
    }
  };

  const payerType = formik.values.payerType ?? "tenant";
  const isEntityResolved = !!resolvedEntityId;
  const selectedEntityForRevenue = allEntities.find(
    (e) => String(e._id) === String(resolvedEntityId ?? ""),
  );
  const blocksForRevenueEntity = getBlocksForEntity(resolvedEntityId);
  const needsBuildingBlock =
    !!resolvedEntityId &&
    selectedEntityForRevenue &&
    selectedEntityForRevenue.type !== "head_office";
  const blockReady =
    !needsBuildingBlock ||
    (!entitiesLoading &&
      blocksForRevenueEntity.length > 0 &&
      !!formik.values.blockId);
  const canSubmit =
    isEntityResolved &&
    formik.values.sourceId &&
    formik.values.amount &&
    blockReady;

  const showRevenueBlockPicker =
    needsBuildingBlock &&
    !entitiesLoading &&
    blocksForRevenueEntity.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={[
          "flex flex-col gap-0 p-0 overflow-hidden",
          // mobile: bottom sheet
          "fixed bottom-0 left-0 right-0 top-auto",
          "rounded-t-2xl rounded-b-none",
          "max-h-[92dvh]",
          "translate-x-0 translate-y-0",
          // sm+: centred modal
          "sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:right-auto",
          "sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-2xl",
          "sm:max-w-lg sm:max-h-[90dvh]",
        ].join(" ")}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-5 pt-4 pb-3 border-b border-border space-y-0.5 sm:px-6 sm:pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Accounting · Revenue
          </p>
          <DialogTitle className="text-xl font-bold text-foreground leading-tight sm:text-2xl">
            Add Revenue
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          <form
            id="add-revenue-form"
            onSubmit={formik.handleSubmit}
            className="space-y-5"
          >
            {/* ── Payer type toggle ─────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Payer type
              </Label>
              <div className="inline-flex w-full rounded-xl border border-input bg-muted/40 p-1 gap-1">
                {["tenant", "external"].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => formik.setFieldValue("payerType", type)}
                    className={[
                      "flex-1 rounded-lg py-2.5 text-sm font-medium transition-all capitalize",
                      payerType === type
                        ? "bg-background text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground",
                    ].join(" ")}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tenant picker ────────────────────────────────────────── */}
            {payerType === "tenant" && (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Select tenant
                </Label>
                <Select
                  value={
                    typeof formik.values.tenantId === "object"
                      ? (formik.values.tenantId?._id ?? "")
                      : (formik.values.tenantId ?? "")
                  }
                  onValueChange={(v) => formik.setFieldValue("tenantId", v)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                    <SelectValue placeholder="— choose tenant —" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(tenants) &&
                      tenants.map((tenant) => (
                        <SelectItem key={tenant._id} value={tenant._id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── External payer fields ──────────────────────────────── */}
            {payerType === "external" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Payer name
                  </Label>
                  <Input
                    placeholder="Name of payer"
                    value={formik.values.externalPayerName ?? ""}
                    onChange={(e) =>
                      formik.setFieldValue("externalPayerName", e.target.value)
                    }
                    className="h-11 rounded-xl text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Type
                  </Label>
                  <Select
                    value={formik.values.externalPayerType ?? "PERSON"}
                    onValueChange={(v) =>
                      formik.setFieldValue("externalPayerType", v)
                    }
                  >
                    <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                      <SelectValue placeholder="Person or Company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSON">Person</SelectItem>
                      <SelectItem value="COMPANY">Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── Entity resolution section ──────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Receiving entity
              </Label>

              {/* For tenants: show auto-resolution UI, with manual override */}
              {payerType === "tenant" && !showManualOverride && (
                <EntityResolutionBanner
                  resolvedEntity={resolvedEntity}
                  resolvedBlock={resolvedBlock}
                  resolving={resolving}
                  error={resolveError}
                  isAutoResolved={isAutoResolved}
                  allEntities={allEntities}
                  entitiesLoading={entitiesLoading}
                  manualEntityId={manualEntityId}
                  onManualEntityChange={handleManualEntityChange}
                  payerType={payerType}
                />
              )}

              {/* Manual override mode (for tenants who clicked "override") */}
              {payerType === "tenant" && showManualOverride && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-1">
                    <span>Manual override active —</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowManualOverride(false);
                        setManualEntityId("");
                      }}
                      className="underline underline-offset-2 hover:text-foreground transition-colors"
                    >
                      revert to auto
                    </button>
                  </div>
                  <Select
                    value={manualEntityId || ""}
                    onValueChange={(v) => {
                      setManualEntityId(v);
                      setResolvedBlock(null);
                    }}
                    disabled={entitiesLoading}
                  >
                    <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                      <SelectValue placeholder={entitiesLoading ? "Loading entities…" : "— select entity —"} />
                    </SelectTrigger>
                    <SelectContent>
                      {allEntities.map((e) => (
                        <SelectItem key={e._id} value={e._id}>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${getEntityBadgeColor(e.type)}`}
                            >
                              {getEntityTypeLabel(e.type)}
                            </span>
                            {e.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* For external: always manual */}
              {payerType === "external" && (
                <EntityResolutionBanner
                  resolvedEntity={null}
                  resolvedBlock={null}
                  resolving={false}
                  error={null}
                  isAutoResolved={false}
                  allEntities={allEntities}
                  entitiesLoading={entitiesLoading}
                  manualEntityId={manualEntityId}
                  onManualEntityChange={setManualEntityId}
                  payerType={payerType}
                />
              )}
            </div>

            {needsBuildingBlock &&
              !entitiesLoading &&
              blocksForRevenueEntity.length === 0 &&
              isEntityResolved && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>
                    No building blocks are linked to this entity. Assign a block in
                    Organization settings first.
                  </span>
                </div>
              )}

            {needsBuildingBlock &&
              !entitiesLoading &&
              blocksForRevenueEntity.length === 1 &&
              formik.values.blockId && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3" />
                  Block automatically selected: {blocksForRevenueEntity[0].name || "Unnamed block"}
                </p>
              )}

            {showRevenueBlockPicker && (
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Building block
                </Label>
                <Select
                  value={formik.values.blockId ?? ""}
                  onValueChange={(v) => formik.setFieldValue("blockId", v)}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                    <SelectValue placeholder="— select block —" />
                  </SelectTrigger>
                  <SelectContent>
                    {blocksForRevenueEntity.map((b) => (
                      <SelectItem key={b._id} value={String(b._id)}>
                        {b.name || "Unnamed block"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Section divider ───────────────────────────────────────── */}
            <div className="relative flex items-center py-1">
              <div className="flex-1 border-t border-border" />
              <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Transaction
              </span>
              <div className="flex-1 border-t border-border" />
            </div>

            {/* ── Revenue source ────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Revenue source
              </Label>
              <Select
                value={formik.values.sourceId ?? ""}
                onValueChange={(v) => formik.setFieldValue("sourceId", v)}
                disabled={revenueSource.length === 0}
              >
                <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                  <SelectValue
                    placeholder={
                      revenueSource.length === 0
                        ? "Loading sources…"
                        : "— select source —"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {revenueSource.map((source) => (
                    <SelectItem key={source._id} value={source._id}>
                      {source.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {revenueSource.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No revenue sources found. Make sure sources are configured in
                  the system.
                </p>
              )}
            </div>

            {/* ── Payment method ─────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Payment method
              </Label>
              <Select
                value={formik.values.paymentMethod || ""}
                onValueChange={(v) => {
                  formik.setFieldValue("paymentMethod", v);
                  if (v !== "bank_transfer" && v !== "cheque") {
                    setSelectedBankAccountId("");
                    formik.setFieldValue("bankAccountId", "");
                  }
                }}
              >
                <SelectTrigger className="w-full h-11 rounded-xl text-sm">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── Bank account picker ────────────────────────────────── */}
            {(formik.values.paymentMethod === "bank_transfer" ||
              formik.values.paymentMethod === "cheque") && (
                <div className="space-y-3">
                  <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Deposit to
                  </Label>
                  <div className="flex flex-col gap-2.5">
                    {Array.isArray(bankAccounts) &&
                      bankAccounts.map((bank) => {
                        const selected = selectedBankAccountId === bank._id;
                        return (
                          <button
                            key={bank._id}
                            type="button"
                            onClick={() => {
                              setSelectedBankAccountId(bank._id);
                              formik.setFieldValue("bankAccountId", bank._id);
                            }}
                            className={[
                              "w-full text-left p-3.5 border-2 rounded-xl transition-colors",
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-muted-foreground bg-background",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getOwnershipLabel(bank.entityId) && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border border-border bg-muted/40 text-muted-foreground flex-shrink-0">
                                      {getOwnershipLabel(bank.entityId)}
                                    </span>
                                  )}
                                  <p className="font-semibold text-foreground text-sm truncate">
                                    {bank.bankName}
                                  </p>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  **** **** {bank.accountNumber?.slice(-4) || "****"}
                                </p>
                              </div>
                              <div className="flex items-center gap-2.5 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
                                    Balance
                                  </p>
                                  <p className="font-semibold text-foreground text-sm">
                                    रू{((bank.balancePaisa ?? bank.balance ?? 0) / 100).toLocaleString("en-IN")}
                                  </p>
                                </div>
                                {selected && (
                                  <div className="text-primary flex-shrink-0">
                                    <CheckCircle2 className="w-5 h-5" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

            {/* ── Amount + Date ──────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount (रू)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  value={formik.values.amount ?? ""}
                  onChange={(e) =>
                    formik.setFieldValue("amount", e.target.value)
                  }
                  className="h-11 rounded-xl text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Date
                </Label>
                <DualCalendarTailwind
                  value={formik.values.date ?? ""}
                  onChange={(englishDate, nepaliDateStr) => {
                    formik.setFieldValue("date", englishDate);
                    formik.setFieldValue(
                      "nepaliDate",
                      nepaliDateStr ?? englishIsoToNepaliString(englishDate),
                    );
                  }}
                />
              </div>
            </div>

            {/* ── Notes ─────────────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Notes{" "}
                <span className="normal-case font-normal">(optional)</span>
              </Label>
              <Textarea
                placeholder="Any additional context..."
                value={formik.values.notes ?? ""}
                onChange={(e) =>
                  formik.setFieldValue("notes", e.target.value)
                }
                rows={3}
                className="rounded-xl resize-none text-sm"
              />
            </div>

            {/* ── Entity required warning ───────────────────────────────── */}
            {!isEntityResolved &&
              !resolving &&
              (formik.values.tenantId || payerType === "external") && (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>A receiving entity is required to save this revenue.</span>
                </div>
              )}
          </form>
        </div>

        {/* ── Sticky footer ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t border-border bg-background sm:px-6 sm:pb-5">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="flex-1 h-11 rounded-xl text-sm sm:flex-none sm:w-24"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-revenue-form"
            disabled={submitting || !canSubmit}
            className="flex-1 h-11 rounded-xl text-sm bg-primary text-primary-foreground hover:bg-primary/90 sm:flex-none sm:min-w-[130px] disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Add Revenue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}