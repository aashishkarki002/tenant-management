import { useState, useEffect, useCallback } from "react";
import { XIcon } from "lucide-react";
import api from "../../../plugins/axios";
import { cn } from "@/lib/utils";
import { Button } from "../../components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../../components/ui/select";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Spinner } from "../../components/ui/spinner";
import { Separator } from "../../components/ui/separator";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { Badge } from "../../components/ui/badge";
import BankAccountSelect from "@/components/BankAccountSelect.jsx";
import {
    PAYMENT_METHODS,
    getLedgerPaymentMethodSelectOptions,
    paymentMethodRequiresBankAccount,
} from "@/constants/paymentMethods.js";
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ADJUSTMENT_TYPES = [
    {
        type: "CASH_REFUND",
        label: "Cash / Bank Refund",
        icon: " RS ",
        color: "#10b981",
        description: "Return funds to tenant via cash or bank transfer",
        needsPayment: true,
    },
    {
        type: "MAINTENANCE_ADJUSTMENT",
        label: "Maintenance Deduction",
        icon: "🔧",
        color: "#f59e0b",
        description: "Withhold for repairs — recognised as maintenance revenue",
        needsPayment: false,
    },
    {
        type: "MAINTENANCE_EXPENSE_OFFSET",
        label: "Contractor Expense Offset",
        icon: "📋",
        color: "#8b5cf6",
        description: "Withhold to pay a contractor — offsets existing expense",
        needsPayment: false,
    },
    {
        type: "RENT_ADJUSTMENT",
        label: "Apply to Rent Arrears",
        icon: "🏠",
        color: "#ef4444",
        description: "Clear outstanding rent dues from SD balance",
        needsPayment: false,
    },
    {
        type: "CAM_ADJUSTMENT",
        label: "Apply to CAM Dues",
        icon: "🏢",
        color: "#3b82f6",
        description: "Clear outstanding CAM dues from SD balance",
        needsPayment: false,
    },
    {
        type: "ELECTRICITY_ADJUSTMENT",
        label: "Apply to Electricity Dues",
        icon: "⚡",
        color: "#06b6d4",
        description: "Clear outstanding electricity dues from SD balance",
        needsPayment: false,
    },
];

const ADJUSTMENT_TYPE_SELECTED_RING = {
    CASH_REFUND: "ring-emerald-500/40 border-emerald-500/50",
    MAINTENANCE_ADJUSTMENT: "ring-amber-500/40 border-amber-500/50",
    MAINTENANCE_EXPENSE_OFFSET: "ring-violet-500/40 border-violet-500/50",
    RENT_ADJUSTMENT: "ring-red-500/40 border-red-500/50",
    CAM_ADJUSTMENT: "ring-blue-500/40 border-blue-500/50",
    ELECTRICITY_ADJUSTMENT: "ring-cyan-500/40 border-cyan-500/50",
};

function formatRs(paisa) {
    if (!paisa) return "रू 0";
    const rupees = paisa / 100;
    return `रू ${rupees.toLocaleString("en-IN")}`;
}

function formatPct(part, total) {
    if (!total) return "0%";
    return `${Math.round((part / total) * 100)}%`;
}

function lineItemTypeLabel(type) {
    return ADJUSTMENT_TYPES.find((t) => t.type === type)?.label ?? type;
}

function extractBankAccounts(responseData) {
    if (Array.isArray(responseData?.bankAccounts)) return responseData.bankAccounts;
    if (Array.isArray(responseData?.data)) return responseData.data;
    return [];
}

function ownershipEntityIdFromBlock(block) {
    if (!block) return null;
    const ref = block.ownershipEntityId ?? block.ownershipEntity;
    return ref?._id ?? ref ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function BalanceBar({ totalPaisa, settledPaisa, pendingPaisa }) {
    const total = totalPaisa || 0;
    const settled = settledPaisa || 0;
    const pending = pendingPaisa || 0;
    const settledW = total ? (settled / total) * 100 : 0;
    const pendingW = total ? (pending / total) * 100 : 0;
    const remainingW = Math.max(0, 100 - settledW - pendingW);

    return (
        <div className="space-y-2">
            <svg
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                viewBox="0 0 100 2"
                preserveAspectRatio="none"
                aria-hidden
            >
                {settledW > 0 && (
                    <rect
                        x={0}
                        y={0}
                        width={settledW}
                        height={2}
                        className="fill-green-500"
                    />
                )}
                {pendingW > 0 && (
                    <rect
                        x={settledW}
                        y={0}
                        width={pendingW}
                        height={2}
                        className="fill-amber-500"
                    />
                )}
                {remainingW > 0 && (
                    <rect
                        x={settledW + pendingW}
                        y={0}
                        width={remainingW}
                        height={2}
                        className="fill-border"
                    />
                )}
            </svg>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full bg-green-500" />
                    Settled
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full bg-amber-500" />
                    Pending
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 shrink-0 rounded-full bg-border" />
                    Remaining
                </span>
            </div>
        </div>
    );
}

function AdjustmentTypeCard({ item, isSelected, onClick }) {
    return (
        <Button
            type="button"
            variant="outline"
            className={cn(
                "h-auto w-full flex-col items-stretch gap-1 whitespace-normal px-3 py-3 text-left",
                isSelected &&
                cn(
                    "bg-accent/40 ring-2",
                    ADJUSTMENT_TYPE_SELECTED_RING[item.type],
                ),
            )}
            onClick={onClick}
        >
            <span className="flex items-center gap-2">
                <span className="text-base leading-none" aria-hidden>
                    {item.icon}
                </span>
                <span className="text-sm font-semibold">{item.label}</span>
            </span>
            <span className="text-left text-xs font-normal text-muted-foreground">
                {item.description}
            </span>
            {isSelected && (
                <span className="text-xs font-medium text-primary">Selected</span>
            )}
        </Button>
    );
}

function LineItemRow({ item, index, onUpdate, onRemove, bankAccounts }) {
    const selectedBank = bankAccounts.find(
        (b) => b.accountCode === item.bankAccountCode,
    );

    return (
        <Card className="overflow-hidden border-border">
            <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                        {lineItemTypeLabel(item.type)}
                    </span>

                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemove(index)}
                        aria-label="Remove line"
                    >
                        <XIcon className="size-4" />
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label htmlFor={`sd-line-amt-${index}`}>Amount</Label>

                    <Input
                        id={`sd-line-amt-${index}`}
                        type="number"
                        step="0.01"
                        value={item.amountPaisa ? item.amountPaisa / 100 : ""}
                        onChange={(e) =>
                            onUpdate(index, {
                                amountPaisa: Math.round(
                                    parseFloat(e.target.value || 0) * 100,
                                ),
                            })
                        }
                    />
                </div>

                {item.type === "CASH_REFUND" && (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label>Payment Method</Label>

                            <Select
                                value={item.paymentMethod}
                                onValueChange={(v) =>
                                    onUpdate(index, { paymentMethod: v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>

                                <SelectContent>
                                    {getLedgerPaymentMethodSelectOptions().map((m) => (
                                        <SelectItem key={m.value} value={m.value}>
                                            {m.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {paymentMethodRequiresBankAccount(item.paymentMethod) && (
                            <div className="space-y-2">
                                <Label>Bank</Label>
                                <BankAccountSelect
                                    bankAccounts={bankAccounts}
                                    value={selectedBank?._id ? String(selectedBank._id) : ""}
                                    onValueChange={(id) => {
                                        const bank = bankAccounts.find(
                                            (b) => String(b._id) === String(id),
                                        );
                                        onUpdate(index, {
                                            bankAccountCode:
                                                bank?.accountCode || null,
                                        });
                                    }}
                                    triggerClassName="w-full"
                                    placeholder="Select bank account"
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor={`sd-line-note-${index}`}>Note</Label>

                    <Input
                        id={`sd-line-note-${index}`}
                        value={item.note || ""}
                        onChange={(e) =>
                            onUpdate(index, { note: e.target.value })
                        }
                    />
                </div>
            </CardContent>
        </Card>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STEPS
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ["Overview", "Breakdown", "Review", "Confirm"];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIZARD
// ─────────────────────────────────────────────────────────────────────────────

export default function SdRefundWizard({ sdId, blockId, onSuccess, onClose }) {
    const [step, setStep] = useState(0);
    const [preflight, setPreflight] = useState(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Wizard state
    const [lineItems, setLineItems] = useState([]);
    const [refundDate, setRefundDate] = useState(
        new Date().toISOString().split("T")[0],
    );
    const [internalNotes, setInternalNotes] = useState("");
    const [bankAccounts, setBankAccounts] = useState([]);
    const [draftId, setDraftId] = useState(null);
    const [entityId, setEntityId] = useState(null);

    // ── Load preflight data ─────────────────────────────────────────────────
    useEffect(() => {
        if (!sdId) return;
        setLoading(true);
        Promise.all([
            api.get(`/api/sd-refund/preflight/${sdId}`),
            api.get("/api/bank/get-bank-accounts"),
            api.get("/api/blocks/get-allblocks"),
        ])
            .then(([preflightRes, banksRes, blocksRes]) => {
                setPreflight(preflightRes.data.data);
                setBankAccounts(extractBankAccounts(banksRes.data));
                const blocks = blocksRes.data?.data ?? [];
                const matchedBlock = blocks.find(
                    (b) => String(b._id) === String(blockId),
                );
                setEntityId(ownershipEntityIdFromBlock(matchedBlock));
            })
            .catch((e) => setError(e.response?.data?.message ?? e.message))
            .finally(() => setLoading(false));
    }, [sdId, blockId]);

    // ── Line item helpers ───────────────────────────────────────────────────
    const addLineItem = useCallback((type) => {
        setLineItems((prev) => [
            ...prev,
            {
                type,
                amountPaisa: 0,
                note: "",
                paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
                bankAccountCode: null,
            },
        ]);
    }, []);

    const updateLineItem = useCallback((index, patch) => {
        setLineItems((prev) =>
            prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
        );
    }, []);

    const removeLineItem = useCallback((index) => {
        setLineItems((prev) => prev.filter((_, i) => i !== index));
    }, []);

    const totalRequestedPaisa = lineItems.reduce(
        (s, l) => s + (l.amountPaisa ?? 0),
        0,
    );

    const remainingAfter = preflight
        ? preflight.remainingPaisa - totalRequestedPaisa
        : 0;

    // ── Validation per step ─────────────────────────────────────────────────
    const canProceed = useCallback(() => {
        if (step === 0) return preflight?.canRefund;
        if (step === 1) {
            if (!lineItems.length) return false;
            if (totalRequestedPaisa <= 0) return false;
            if (totalRequestedPaisa > (preflight?.remainingPaisa ?? 0))
                return false;
            // All CASH_REFUND items must have bankAccountCode (if bank method)
            for (const l of lineItems) {
                if (l.type === "CASH_REFUND") {
                    if (!l.amountPaisa) return false;
                    if (
                        paymentMethodRequiresBankAccount(l.paymentMethod) &&
                        !l.bankAccountCode
                    )
                        return false;
                }
                if (!l.amountPaisa) return false;
            }
            return true;
        }
        return true;
    }, [step, preflight, lineItems, totalRequestedPaisa]);

    // ── Submit: create draft ────────────────────────────────────────────────
    async function handleCreateDraft() {
        if (!entityId) {
            setError("Could not resolve entity from selected block.");
            return;
        }
        setPosting(true);
        setError(null);
        try {
            const res = await api.post("/api/sd-refund/draft", {
                sdId,
                blockId,
                entityId,
                refundDate,
                lineItems,
                internalNotes,
            });
            setDraftId(res.data.data._id);
            setStep(3);
        } catch (e) {
            setError(e.response?.data?.message ?? e.message);
        } finally {
            setPosting(false);
        }
    }

    // ── Submit: confirm + post ──────────────────────────────────────────────
    async function handleConfirm() {
        if (!draftId) return;
        if (!entityId) {
            setError("Could not resolve entity from selected block.");
            return;
        }
        setPosting(true);
        setError(null);
        try {
            await api.post(`/api/sd-refund/${draftId}/confirm`, {
                blockId,
                entityId,
            });
            setSuccess(true);
            onSuccess?.();
        } catch (e) {
            setError(e.response?.data?.message ?? e.message);
        } finally {
            setPosting(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <Dialog
            defaultOpen
            onOpenChange={(open) => {
                if (!open) onClose?.();
            }}
        >
            <DialogContent
                className="flex max-h-[92vh] max-w-5xl w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
                showCloseButton
            >
                {/* HEADER */}
                <DialogHeader className="shrink-0 flex-row items-center justify-between space-y-0 border-b px-6 py-4 text-left">
                    <DialogTitle className="text-xl font-semibold">
                        Settlement Wizard
                    </DialogTitle>
                </DialogHeader>

                {/* STEP TRACK */}
                <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-muted/30 px-6 py-4">
                    {STEPS.map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            {i > 0 && (
                                <Separator
                                    orientation="vertical"
                                    className="mx-1 hidden h-4 sm:block"
                                />
                            )}
                            <div
                                className={cn(
                                    "flex items-center gap-2 rounded-md px-2 py-1",
                                    i === step && "bg-background shadow-sm",
                                )}
                            >
                                <span
                                    className={cn(
                                        "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                                        i < step &&
                                        "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
                                        i === step &&
                                        "border-primary bg-primary/10 text-primary",
                                        i > step &&
                                        "border-muted-foreground/30 text-muted-foreground",
                                    )}
                                >
                                    {i + 1}
                                </span>
                                <span
                                    className={cn(
                                        "text-sm",
                                        i === step
                                            ? "font-medium text-foreground"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    {s}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* BODY */}
                <div className="max-h-[65vh] min-h-0 flex-1 overflow-y-auto p-6">
                    {/* LOADING */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-12">
                            <Spinner className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Loading security deposit details…
                            </p>
                        </div>
                    )}

                    {/* SUCCESS */}
                    {!loading && success && (
                        <div className="flex flex-col items-center py-12 text-center">
                            <div className="mb-4 flex size-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-500/10 text-3xl text-green-600 dark:text-green-400">
                                ✓
                            </div>

                            <h3 className="text-lg font-semibold">
                                Settlement Posted
                            </h3>

                            <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                The security deposit settlement has been recorded
                                and the ledger has been updated.
                            </p>

                            <Button
                                type="button"
                                className="mt-6"
                                onClick={() => onClose?.()}
                            >
                                Close
                            </Button>
                        </div>
                    )}

                    {/* ERROR */}
                    {!loading && !success && error && step < 3 && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* STEP 0 — OVERVIEW */}
                    {!loading && !success && step === 0 && preflight && (
                        <div className="space-y-6">
                            {/* TENANT CARD */}
                            <Card className="border-border">
                                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                                    <Avatar className="size-11">
                                        <AvatarFallback className="bg-primary/15 text-base font-semibold text-primary">
                                            {preflight.sd?.tenant?.name?.[0] ??
                                                "T"}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <p className="truncate text-base font-semibold">
                                            {preflight.sd?.tenant?.name ??
                                                "Tenant"}
                                        </p>

                                        <p className="text-sm text-muted-foreground">
                                            {preflight.sd?.tenant?.phone ?? ""}
                                        </p>

                                        <p className="text-xs text-muted-foreground">
                                            Block:{" "}
                                            {preflight.sd?.block?.name ?? "—"}
                                        </p>
                                    </div>

                                    <Badge
                                        variant="secondary"
                                        className="shrink-0 uppercase tracking-wide"
                                    >
                                        {preflight.sd?.mode?.replace("_", " ")}
                                    </Badge>
                                </CardContent>
                            </Card>

                            {/* AMOUNT STRIP */}
                            <div className="grid gap-3 sm:grid-cols-3">
                                <Card className="border-border">
                                    <CardContent className="flex flex-col gap-1 p-4">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Total SD
                                        </span>
                                        <span className="text-lg font-semibold tabular-nums">
                                            {formatRs(preflight.sd?.amountPaisa)}
                                        </span>
                                    </CardContent>
                                </Card>

                                <Card className="border-primary/30 bg-primary/5">
                                    <CardContent className="flex flex-col gap-1 p-4">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Remaining
                                        </span>
                                        <span className="text-lg font-semibold tabular-nums text-primary">
                                            {formatRs(preflight.remainingPaisa)}
                                        </span>
                                    </CardContent>
                                </Card>

                                <Card className="border-border">
                                    <CardContent className="flex flex-col gap-1 p-4">
                                        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            Already Settled
                                        </span>
                                        <span className="text-lg font-semibold tabular-nums">
                                            {formatRs(preflight.settledPaisa)}
                                        </span>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* BALANCE BAR */}
                            <BalanceBar
                                totalPaisa={preflight.sd?.amountPaisa ?? 0}
                                settledPaisa={preflight.settledPaisa ?? 0}
                                pendingPaisa={0}
                            />

                            {/* DATE FIELD */}
                            {preflight.canRefund && (
                                <div className="space-y-2">
                                    <Label htmlFor="sd-settlement-date">
                                        Settlement Date
                                    </Label>

                                    <Input
                                        id="sd-settlement-date"
                                        type="date"
                                        value={refundDate}
                                        onChange={(e) =>
                                            setRefundDate(e.target.value)
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 1 — BREAKDOWN */}
                    {!loading && !success && step === 1 && preflight && (
                        <div className="space-y-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-semibold">
                                        Settlement Breakdown
                                    </h3>

                                    <p className="text-sm text-muted-foreground">
                                        Total must not exceed{" "}
                                        {formatRs(preflight.remainingPaisa)}
                                    </p>
                                </div>

                                <Card className="shrink-0 border-border sm:min-w-[140px]">
                                    <CardContent className="flex flex-col gap-0.5 p-3 text-right">
                                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                            Requested
                                        </span>
                                        <span
                                            className={cn(
                                                "text-lg font-semibold tabular-nums",
                                                totalRequestedPaisa >
                                                    (preflight?.remainingPaisa ??
                                                        0)
                                                    ? "text-destructive"
                                                    : "text-primary",
                                            )}
                                        >
                                            {formatRs(totalRequestedPaisa)}
                                        </span>
                                    </CardContent>
                                </Card>
                            </div>

                            <BalanceBar
                                totalPaisa={preflight.sd?.amountPaisa ?? 0}
                                settledPaisa={preflight.settledPaisa ?? 0}
                                pendingPaisa={totalRequestedPaisa}
                            />

                            {lineItems.map((item, i) => (
                                <LineItemRow
                                    key={i}
                                    item={item}
                                    index={i}
                                    onUpdate={updateLineItem}
                                    onRemove={removeLineItem}
                                    bankAccounts={bankAccounts}
                                />
                            ))}

                            <div>
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Add line type
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    {ADJUSTMENT_TYPES.map((t) => (
                                        <AdjustmentTypeCard
                                            key={t.type}
                                            item={t}
                                            isSelected={lineItems.some(
                                                (l) => l.type === t.type,
                                            )}
                                            onClick={() => addLineItem(t.type)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2 — REVIEW */}
                    {!loading && !success && step === 2 && preflight && (
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold">
                                Review Settlement
                            </h3>

                            <Card className="overflow-hidden border-border">
                                <CardContent className="divide-y p-0">
                                    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                                        <span className="text-muted-foreground">
                                            Tenant
                                        </span>
                                        <span className="font-semibold">
                                            {preflight.sd?.tenant?.name}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 bg-muted/20 px-4 py-3 text-sm">
                                        <span className="text-muted-foreground">
                                            Settlement Date
                                        </span>
                                        <span className="font-semibold">
                                            {refundDate}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-4 bg-primary/5 px-4 py-3 text-sm">
                                        <span className="font-medium text-primary">
                                            Total Settlement
                                        </span>
                                        <span className="font-semibold text-primary">
                                            {formatRs(totalRequestedPaisa)}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* STEP 3 — CONFIRM */}
                    {!loading && !success && step === 3 && (
                        <div className="flex flex-col items-center gap-3 py-8 text-center">
                            <div
                                className="mb-1 text-4xl"
                                aria-hidden
                            >
                                📋
                            </div>

                            <h3 className="text-lg font-semibold">
                                Ready to Post
                            </h3>

                            <p className="max-w-sm text-sm text-muted-foreground">
                                Click below to post the settlement to the ledger.
                            </p>

                            <p className="text-xl font-bold tabular-nums">
                                {formatRs(totalRequestedPaisa)}
                            </p>

                            <Button
                                type="button"
                                size="lg"
                                className="mt-4 w-full max-w-sm"
                                onClick={handleConfirm}
                                disabled={posting}
                            >
                                {posting ? "Posting…" : "Post to Ledger"}
                            </Button>
                        </div>
                    )}
                </div>

                {/* FOOTER */}
                {!loading && !success && (
                    <DialogFooter className="shrink-0 flex-row flex-wrap items-center justify-between gap-3 border-t px-6 py-4 sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                step === 0
                                    ? onClose?.()
                                    : setStep((s) => s - 1)
                            }
                            disabled={posting}
                        >
                            {step === 0 ? "Cancel" : "← Back"}
                        </Button>

                        <div className="flex flex-wrap gap-2">
                            {step < 2 && (
                                <Button
                                    type="button"
                                    onClick={() => setStep((s) => s + 1)}
                                    disabled={!canProceed() || posting}
                                >
                                    Next →
                                </Button>
                            )}

                            {step === 2 && (
                                <Button
                                    type="button"
                                    onClick={handleCreateDraft}
                                    disabled={!canProceed() || posting}
                                >
                                    Save Draft →
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
