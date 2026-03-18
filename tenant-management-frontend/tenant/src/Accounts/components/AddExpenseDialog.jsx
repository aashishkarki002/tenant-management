import React, { useEffect, useState } from "react";
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
import { Loader2, Building2, User, Users, CheckCircle2 } from "lucide-react";
import DualCalendarTailwind from "@/components/dualDate";
import { PAYMENT_METHODS } from "../../Tenant/addTenant/constants/tenant.constant.js";

const VALID_PAYMENT_METHODS = Object.values(PAYMENT_METHODS);

// ─── Payee type config ────────────────────────────────────────────────────────
const PAYEE_TYPES = [
  {
    value: "TENANT",
    label: "Tenant",
    icon: User,
    description: "Expense linked to a tenant",
  },
  {
    value: "EXTERNAL",
    label: "External",
    icon: Building2,
    description: "Vendor, contractor or utility",
  },
  {
    value: "INTERNAL",
    label: "Internal",
    icon: Users,
    description: "Staff salary or advance",
  },
];

const EXTERNAL_PAYEE_TYPES = [
  { value: "VENDOR", label: "Vendor" },
  { value: "CONTRACTOR", label: "Contractor" },
  { value: "UTILITY", label: "Utility" },
  { value: "GOVERNMENT", label: "Government" },
  { value: "OTHER", label: "Other" },
];

const REFERENCE_TYPES = [
  { value: "MANUAL", label: "Manual" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "UTILITY", label: "Utility" },
  { value: "SALARY", label: "Salary" },
  { value: "ADVANCE", label: "Advance" },
];

function getInitialValues() {
  return {
    payeeType: "EXTERNAL",
    // Tenant
    tenantId: "",
    // External
    externalPayeeName: "",
    externalPayeeType: "VENDOR",
    externalContactInfo: "",
    // Internal (staff)
    staffId: "",
    staffRole: "",
    staffDepartment: "",
    payPeriodMonth: new Date().getMonth() + 1,
    payPeriodYear: new Date().getFullYear(),
    // Transaction
    source: "",
    referenceType: "MANUAL",
    referenceId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    nepaliDateStr: "",
    notes: "",
    paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
    bankAccountId: "",
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionDivider({ label }) {
  return (
    <div className="relative flex items-center py-1">
      <div className="flex-1 border-t border-border" />
      <span className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex-1 border-t border-border" />
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </Label>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function AddExpenseDialog({
  open,
  onOpenChange,
  tenants = [],
  expenseSources = [],
  bankAccounts = [],
  staffList = [],   // Array of { _id, name, email, profile: { designation, department } }
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);

  const formik = useFormik({
    initialValues: getInitialValues(),
    onSubmit: async (values) => {
      setSubmitting(true);
      try {
        const { payeeType } = values;
        const englishDate = values.date || new Date().toISOString().split("T")[0];

        const rawMethod = values.paymentMethod;
        const paymentMethod =
          typeof rawMethod === "string" && VALID_PAYMENT_METHODS.includes(rawMethod)
            ? rawMethod
            : PAYMENT_METHODS.BANK_TRANSFER;

        const nepaliDateStr = values.nepaliDateStr || null;

        const payload = {
          source: values.source,
          amount: Number(values.amount),
          EnglishDate: englishDate,
          nepaliDateStr,
          referenceType: values.referenceType || "MANUAL",
          referenceId: values.referenceId || undefined,
          notes: values.notes || undefined,
          payeeType,
          paymentMethod,
          transactionScope: "building",
        };

        // Payment method → bank account
        if (
          paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
          paymentMethod === PAYMENT_METHODS.CHEQUE
        ) {
          if (values.bankAccountId) payload.bankAccountId = values.bankAccountId;
        }

        // Payee-specific fields
        if (payeeType === "TENANT") {
          payload.tenant =
            typeof values.tenantId === "object"
              ? values.tenantId?._id
              : values.tenantId;
        }

        if (payeeType === "EXTERNAL") {
          payload.externalPayee = {
            name: values.externalPayeeName,
            type: values.externalPayeeType || "OTHER",
            contactInfo: values.externalContactInfo || undefined,
          };
        }

        if (payeeType === "INTERNAL") {
          payload.staffPayee = {
            staffId: values.staffId || undefined,
            role: values.staffRole || undefined,
            department: values.staffDepartment || undefined,
            payPeriod: {
              month: Number(values.payPeriodMonth),
              year: Number(values.payPeriodYear),
            },
          };
        }

        const response = await api.post("/api/expense/create", payload);
        if (response.data?.expense != null) {
          onSuccess?.(response.data);
          handleClose();
        } else {
          console.error(response.data?.message || "Create failed");
        }
      } catch (err) {
        console.error("Error creating expense:", err);
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleClose = () => {
    formik.resetForm({ values: getInitialValues() });
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open) return;
    formik.resetForm({ values: getInitialValues() });
  }, [open]);

  // When a staff member is selected, auto-fill role + department from their profile
  const handleStaffSelect = (staffId) => {
    formik.setFieldValue("staffId", staffId);
    const staff = staffList.find((s) => s._id === staffId);
    if (staff?.profile) {
      formik.setFieldValue("staffRole", staff.profile.designation || "");
      formik.setFieldValue("staffDepartment", staff.profile.department || "");
    }
  };

  const { payeeType } = formik.values;
  const selectedStaff = staffList.find((s) => s._id === formik.values.staffId);
  const showBankPicker =
    formik.values.paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
    formik.values.paymentMethod === PAYMENT_METHODS.CHEQUE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-full max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl"
        onInteractOutside={(e) => {
          if (e.target?.closest?.("[data-dual-calendar-panel]")) {
            e.preventDefault();
          }
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
            Accounting · Expense
          </p>
          <DialogTitle className="text-xl font-bold text-foreground leading-tight">
            Add Expense
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="px-6 py-5 space-y-5">

          {/* ── Payee Type Toggle ── */}
          <div className="space-y-2">
            <FieldLabel>Payee Type</FieldLabel>
            <div className="grid grid-cols-3 gap-2">
              {PAYEE_TYPES.map(({ value, label, icon: Icon, description }) => {
                const active = payeeType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => formik.setFieldValue("payeeType", value)}
                    className={[
                      "relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 text-center transition-all duration-150 cursor-pointer",
                      active
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground",
                    ].join(" ")}
                  >
                    {active && (
                      <CheckCircle2 className="absolute top-2 right-2 w-3.5 h-3.5 text-primary" />
                    )}
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-[10px] leading-tight opacity-70 hidden sm:block">
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── TENANT fields ── */}
          {payeeType === "TENANT" && (
            <div className="space-y-2">
              <FieldLabel>Select Tenant</FieldLabel>
              <Select
                value={
                  typeof formik.values.tenantId === "object"
                    ? formik.values.tenantId?._id ?? ""
                    : (formik.values.tenantId ?? "")
                }
                onValueChange={(v) => formik.setFieldValue("tenantId", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— choose tenant —" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── EXTERNAL fields ── */}
          {payeeType === "EXTERNAL" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <FieldLabel>Payee Name</FieldLabel>
                <Input
                  placeholder="e.g. Aryan Electricals"
                  value={formik.values.externalPayeeName}
                  onChange={(e) =>
                    formik.setFieldValue("externalPayeeName", e.target.value)
                  }
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Payee Type</FieldLabel>
                <Select
                  value={formik.values.externalPayeeType}
                  onValueChange={(v) =>
                    formik.setFieldValue("externalPayeeType", v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXTERNAL_PAYEE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <FieldLabel>Contact Info (optional)</FieldLabel>
                <Input
                  placeholder="Phone or email"
                  value={formik.values.externalContactInfo}
                  onChange={(e) =>
                    formik.setFieldValue("externalContactInfo", e.target.value)
                  }
                />
              </div>
            </div>
          )}

          {/* ── INTERNAL (Staff) fields ── */}
          {payeeType === "INTERNAL" && (
            <div className="space-y-4">
              {/* Staff selector */}
              <div className="space-y-2">
                <FieldLabel>Staff Member</FieldLabel>
                <Select
                  value={formik.values.staffId ?? ""}
                  onValueChange={handleStaffSelect}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— select staff —" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffList.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        No staff members found
                      </div>
                    )}
                    {staffList.map((s) => (
                      <SelectItem key={s._id} value={s._id}>
                        <div className="flex flex-col">
                          <span>{s.name}</span>
                          {s.profile?.designation && (
                            <span className="text-[11px] text-muted-foreground">
                              {s.profile.designation}
                              {s.profile.department
                                ? ` · ${s.profile.department}`
                                : ""}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Staff pill — shows selected staff info inline, no history */}
                {selectedStaff && (
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 mt-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                      {selectedStaff.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {selectedStaff.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {[
                          selectedStaff.profile?.designation,
                          selectedStaff.profile?.department,
                        ]
                          .filter(Boolean)
                          .join(" · ") || selectedStaff.email}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pay period */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <FieldLabel>Pay Month</FieldLabel>
                  <Select
                    value={String(formik.values.payPeriodMonth)}
                    onValueChange={(v) =>
                      formik.setFieldValue("payPeriodMonth", Number(v))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December",
                      ].map((m, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <FieldLabel>Pay Year</FieldLabel>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={formik.values.payPeriodYear}
                    onChange={(e) =>
                      formik.setFieldValue("payPeriodYear", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <SectionDivider label="Transaction" />

          {/* ── Source + Reference ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>Expense Source</FieldLabel>
              <Select
                value={formik.values.source ?? ""}
                onValueChange={(v) => formik.setFieldValue("source", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="— select source —" />
                </SelectTrigger>
                <SelectContent>
                  {expenseSources.map((src) => (
                    <SelectItem key={src._id} value={src._id}>
                      {src.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <FieldLabel>Reference Type</FieldLabel>
              <Select
                value={formik.values.referenceType ?? "MANUAL"}
                onValueChange={(v) => formik.setFieldValue("referenceType", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFERENCE_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Amount + Date ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <FieldLabel>Amount (रू)</FieldLabel>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={formik.values.amount ?? ""}
                onChange={(e) => formik.setFieldValue("amount", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <FieldLabel>Date</FieldLabel>
              <DualCalendarTailwind
                value={formik.values.date ?? ""}
                onChange={(englishDate, nepaliDateStr) => {
                  formik.setFieldValue("date", englishDate);
                  formik.setFieldValue("nepaliDateStr", nepaliDateStr ?? "");
                }}
              />
            </div>
          </div>

          {/* ── Payment Method ── */}
          <div className="space-y-2">
            <FieldLabel>Payment Method</FieldLabel>
            <Select
              value={
                formik.values.paymentMethod &&
                  VALID_PAYMENT_METHODS.includes(formik.values.paymentMethod)
                  ? formik.values.paymentMethod
                  : PAYMENT_METHODS.BANK_TRANSFER
              }
              onValueChange={(v) => {
                formik.setFieldValue("paymentMethod", v);
                if (
                  v !== PAYMENT_METHODS.BANK_TRANSFER &&
                  v !== PAYMENT_METHODS.CHEQUE
                ) {
                  formik.setFieldValue("bankAccountId", "");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PAYMENT_METHODS.CASH}>Cash</SelectItem>
                <SelectItem value={PAYMENT_METHODS.BANK_TRANSFER}>
                  Bank Transfer
                </SelectItem>
                <SelectItem value={PAYMENT_METHODS.CHEQUE}>Cheque</SelectItem>
                <SelectItem value={PAYMENT_METHODS.MOBILE_WALLET}>
                  Mobile Wallet
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Bank account picker ── */}
          {showBankPicker && (
            <div className="space-y-2">
              <FieldLabel>Paid From Account</FieldLabel>
              <div className="grid gap-2">
                {bankAccounts.map((bank) => {
                  const selected = formik.values.bankAccountId === bank._id;
                  return (
                    <button
                      key={bank._id}
                      type="button"
                      onClick={() =>
                        formik.setFieldValue("bankAccountId", bank._id)
                      }
                      className={[
                        "w-full text-left rounded-xl border-2 px-4 py-3 transition-all duration-150",
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 bg-background",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {bank.bankName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ···· {bank.accountNumber?.slice(-4) || "????"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                              Balance
                            </p>
                            <p className="text-sm font-semibold text-foreground">
                              रू{" "}
                              {(
                                (bank.balancePaisa || bank.balance || 0) / 100
                              ).toLocaleString("en-IN")}
                            </p>
                          </div>
                          {selected && (
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Notes ── */}
          <div className="space-y-2">
            <FieldLabel>Notes (optional)</FieldLabel>
            <Textarea
              placeholder="Any additional context..."
              value={formik.values.notes ?? ""}
              onChange={(e) => formik.setFieldValue("notes", e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          {/* ── Footer ── */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Add Expense
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}