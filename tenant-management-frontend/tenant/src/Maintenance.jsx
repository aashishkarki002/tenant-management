import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronUp, ChevronDown, User, AlertTriangle } from "lucide-react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { PAYMENT_METHODS } from "../../Tenant/addTenant/constants/tenant.constant.js";

const VALID_PAYMENT_METHODS = Object.values(PAYMENT_METHODS);

export default function MaintenanceCard({
  maintenanceItem,
  isExpanded,
  toggleExpand,
  getPriorityStyle,
  formatStatus,
  formatDate,
  workOrderId,
  onUpdate,
  bankAccounts = [],
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [staffs, setStaffs] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Overpayment confirmation state — set after backend returns 409
  const [overpaymentMeta, setOverpaymentMeta] = useState(null);

  useEffect(() => {
    const fetchStaffs = async () => {
      try {
        const res = await api.get("/api/staff/get-staffs");
        const data = res.data?.data;
        const list = Array.isArray(data) ? data : data?.data ?? [];
        setStaffs(list);
      } catch {
        setStaffs([]);
      }
    };
    fetchStaffs();
  }, []);

  const [formData, setFormData] = useState({
    paymentStatus: maintenanceItem.paymentStatus || "pending",
    paidAmount: maintenanceItem.paidAmount?.toString() || "0",
    paymentMethod: PAYMENT_METHODS.BANK_TRANSFER,
    bankAccountId: "",
  });
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");

  useEffect(() => {
    setFormData((prev) => ({
      paymentStatus: maintenanceItem.paymentStatus || "pending",
      paidAmount: maintenanceItem.paidAmount?.toString() || "0",
      paymentMethod: prev.paymentMethod || PAYMENT_METHODS.BANK_TRANSFER,
      bankAccountId: prev.bankAccountId || "",
    }));
  }, [maintenanceItem]);

  useEffect(() => {
    if (isDialogOpen) setSelectedBankAccountId(formData.bankAccountId || "");
  }, [isDialogOpen, formData.bankAccountId]);

  /* ── Derived overpayment values (real-time, before submit) ── */
  const estimatedAmount = maintenanceItem.amount || 0;
  const paidAmountNum = Number(formData.paidAmount) || 0;
  const exceedsByRupees =
    estimatedAmount > 0 && paidAmountNum > estimatedAmount
      ? +(paidAmountNum - estimatedAmount).toFixed(2)
      : 0;
  const isOverpayingInForm = exceedsByRupees > 0;

  // True when the user has seen the live warning AND clicked "Confirm Overpayment"
  // locally (before the backend also validates it).
  const [localOverpaymentConfirmed, setLocalOverpaymentConfirmed] = useState(false);

  /* ---------------- STATUS CHANGE HANDLER ---------------- */
  const handleStatusSelect = async (newStatus) => {
    if (newStatus === maintenanceItem.status) return;

    if (newStatus === "COMPLETED") {
      setOverpaymentMeta(null);
      setLocalOverpaymentConfirmed(false);
      setIsDialogOpen(true);
      return;
    }

    try {
      await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
        status: newStatus,
      });
      toast.success("Status updated");
      onUpdate?.();
    } catch {
      toast.error("Failed to update status");
    }
  };

  /* ---------------- SUBMIT COMPLETION ---- */
  const submitCompletion = async (allowOverpayment = false) => {
    const paymentMethod =
      formData.paymentMethod && VALID_PAYMENT_METHODS.includes(formData.paymentMethod)
        ? formData.paymentMethod
        : PAYMENT_METHODS.BANK_TRANSFER;
    const payload = {
      status: "COMPLETED",
      paymentStatus: formData.paymentStatus,
      paidAmount: Number(formData.paidAmount),
      paymentMethod,
      ...(allowOverpayment && { allowOverpayment: true }),
    };
    if (
      paymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
      paymentMethod === PAYMENT_METHODS.CHEQUE
    ) {
      if (formData.bankAccountId) payload.bankAccountId = formData.bankAccountId;
    }
    try {
      await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, payload);
      toast.success(
        allowOverpayment
          ? "Work order completed (overpayment recorded)"
          : "Work order completed",
      );
      setIsDialogOpen(false);
      setOverpaymentMeta(null);
      setLocalOverpaymentConfirmed(false);
      onUpdate?.();
    } catch (err) {
      const data = err?.response?.data;

      // Backend 409 overpayment guard (double-check layer)
      if (err?.response?.status === 409 && data?.isOverpayment) {
        setOverpaymentMeta({
          message: data.message,
          diffRupees: data.overpaymentDiffRupees,
        });
        return;
      }

      toast.error(data?.message || "Failed to complete work order");
    }
  };

  // Primary "Complete" button — if the user is overpaying and hasn't
  // confirmed yet, block submission and scroll them to the warning.
  const handleCompleteSubmit = () => {
    if (isOverpayingInForm && !localOverpaymentConfirmed) {
      // The inline warning is already visible; do nothing so the user
      // reads it and clicks "Confirm Overpayment" first.
      return;
    }
    submitCompletion(localOverpaymentConfirmed);
  };

  // Called from the inline warning's confirm button
  const handleLocalOverpaymentConfirm = () => {
    setLocalOverpaymentConfirmed(true);
  };

  // Called from the backend-returned overpayment banner
  const handleOverpaymentConfirm = () => submitCompletion(true);

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setOverpaymentMeta(null);
    setLocalOverpaymentConfirmed(false);
  };

  const updateFormField = (field, value) => {
    if (field === "paidAmount") {
      setOverpaymentMeta(null);
      setLocalOverpaymentConfirmed(false); // reset confirmation when amount changes
    }
    if (field === "paymentMethod") {
      if (value !== PAYMENT_METHODS.BANK_TRANSFER && value !== PAYMENT_METHODS.CHEQUE) {
        setSelectedBankAccountId("");
        setFormData((prev) => ({ ...prev, [field]: value, bankAccountId: "" }));
        return;
      }
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const currentPaymentMethod =
    formData.paymentMethod && VALID_PAYMENT_METHODS.includes(formData.paymentMethod)
      ? formData.paymentMethod
      : PAYMENT_METHODS.BANK_TRANSFER;

  /* ---------------- ASSIGN STAFF ---------------- */
  const handleAssignStaff = async (staffId) => {
    const value = staffId === "__unassigned__" ? null : staffId;
    setAssigning(true);
    try {
      await api.patch(`/api/maintenance/${maintenanceItem._id}/assign`, {
        assignedTo: value,
      });
      toast.success(value ? "Staff assigned" : "Assignment cleared");
      onUpdate?.();
    } catch {
      toast.error("Failed to update assignment");
    } finally {
      setAssigning(false);
    }
  };

  const assignedStaffId =
    maintenanceItem.assignedTo?._id ?? maintenanceItem.assignedTo ?? "";

  const assignedStaffName = assignedStaffId
    ? staffs.find((s) => s._id === assignedStaffId)?.name ?? "Assigned"
    : null;

  /* ── Status badge colour ── */
  const statusColour = {
    OPEN: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    CANCELLED: "bg-gray-100 text-gray-500",
  }[maintenanceItem.status] ?? "bg-slate-100 text-slate-700";

  /* ── Payment badge colour ── */
  const paymentBadgeColour = {
    pending: "bg-yellow-50 text-yellow-700",
    partially_paid: "bg-orange-50 text-orange-700",
    paid: "bg-emerald-50 text-emerald-700",
    overpaid: "bg-amber-100 text-amber-800",
  }[maintenanceItem.paymentStatus] ?? "bg-gray-100 text-gray-500";

  /* ── Complete button label / disabled state ── */
  const completeButtonBlocked = isOverpayingInForm && !localOverpaymentConfirmed;

  /* ---------------- UI ---------------- */
  return (
    <>
      {/* COMPLETION DIALOG */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white text-black sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Complete Work Order
            </DialogTitle>
            <p className="text-sm text-gray-500">
              Confirm payment details before marking this task as completed.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Payment Status */}
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select
                value={formData.paymentStatus}
                onValueChange={(v) => updateFormField("paymentStatus", v)}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partially_paid">Partially Paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Paid Amount — with estimated reference */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Paid Amount (₹)</Label>
                {estimatedAmount > 0 && (
                  <span className="text-xs text-gray-400">
                    Estimated:{" "}
                    <span className="font-medium text-gray-600">
                      ₹{estimatedAmount.toLocaleString("en-IN")}
                    </span>
                  </span>
                )}
              </div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={formData.paidAmount}
                disabled={formData.paymentStatus === "pending"}
                onChange={(e) => updateFormField("paidAmount", e.target.value)}
                className={
                  isOverpayingInForm
                    ? "border-amber-400 focus-visible:ring-amber-400"
                    : ""
                }
              />

              {/* ── Real-time overpayment breakdown ───────────────────────── */}
              {isOverpayingInForm && estimatedAmount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
                  {/* Breakdown table */}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-600">
                      <span>Estimated amount</span>
                      <span className="font-medium">
                        ₹{estimatedAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Amount being paid</span>
                      <span className="font-medium">
                        ₹{paidAmountNum.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200 pt-1.5 font-semibold text-amber-800">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Exceeds estimate by
                      </span>
                      <span>₹{exceedsByRupees.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Confirm / edit actions */}
                  {!localOverpaymentConfirmed ? (
                    <>
                      <p className="text-xs text-amber-700">
                        The paid amount exceeds the estimated cost. Please confirm
                        to proceed — this will be recorded as an{" "}
                        <strong>overpaid</strong> expense in accounting.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-xs"
                        onClick={handleLocalOverpaymentConfirm}
                      >
                        Confirm Overpayment & Proceed
                      </Button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Overpayment confirmed — you can now complete the order.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select
                value={currentPaymentMethod}
                onValueChange={(v) => updateFormField("paymentMethod", v)}
              >
                <SelectTrigger className="bg-white border-gray-300">
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PAYMENT_METHODS.CASH}>Cash</SelectItem>
                  <SelectItem value={PAYMENT_METHODS.BANK_TRANSFER}>Bank Transfer</SelectItem>
                  <SelectItem value={PAYMENT_METHODS.CHEQUE}>Cheque</SelectItem>
                  <SelectItem value={PAYMENT_METHODS.MOBILE_WALLET}>Mobile Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bank account */}
            {(currentPaymentMethod === PAYMENT_METHODS.BANK_TRANSFER ||
              currentPaymentMethod === PAYMENT_METHODS.CHEQUE) && (
                <div className="space-y-2">
                  <Label>Deposit To (Bank Account)</Label>
                  <div className="grid gap-2">
                    {Array.isArray(bankAccounts) &&
                      bankAccounts.map((bank) => (
                        <button
                          key={bank._id}
                          type="button"
                          onClick={() => {
                            setSelectedBankAccountId(bank._id);
                            updateFormField("bankAccountId", bank._id);
                          }}
                          className={`w-full text-left p-3 border-2 rounded-lg cursor-pointer transition-colors ${selectedBankAccountId === bank._id
                            ? "border-slate-900 bg-slate-900/[0.03]"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-900 text-sm">{bank.bankName}</p>
                              <p className="text-xs text-slate-500">
                                **** **** {bank.accountNumber?.slice(-4) || "****"}
                              </p>
                            </div>
                            {selectedBankAccountId === bank._id && (
                              <div className="text-slate-900 ml-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}

            {/* ── Backend-returned overpayment banner (fallback / double-check) ──
                            Only shown if the backend catches something the frontend missed.
                        ── */}
            {overpaymentMeta && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      Overpayment detected (server)
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {overpaymentMeta.message}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Excess:{" "}
                      <span className="font-semibold">
                        ₹{overpaymentMeta.diffRupees}
                      </span>
                      . This will be recorded as an <strong>overpaid</strong>{" "}
                      expense in accounting.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setOverpaymentMeta(null)}
                  >
                    Edit Amount
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-xs"
                    onClick={handleOverpaymentConfirm}
                  >
                    Confirm Overpayment
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer — hidden while backend overpayment banner is showing */}
          {!overpaymentMeta && (
            <DialogFooter>
              <Button variant="outline" onClick={handleDialogClose}>
                Cancel
              </Button>
              <Button
                className={
                  completeButtonBlocked
                    ? "bg-amber-400 cursor-not-allowed text-white opacity-70"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }
                onClick={handleCompleteSubmit}
                title={
                  completeButtonBlocked
                    ? "Confirm the overpayment above before completing"
                    : undefined
                }
              >
                {completeButtonBlocked ? "Confirm Overpayment First ↑" : "Complete"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* MAIN CARD */}
      <Card className="w-full rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
        <CardContent className="p-4">
          {/* ── Top row ── */}
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">
                  {maintenanceItem.title}
                </h3>
                {maintenanceItem.priority && (
                  <Badge
                    className={`${getPriorityStyle(maintenanceItem.priority)} shrink-0 rounded-full px-2 py-0.5 text-xs font-medium uppercase`}
                  >
                    {maintenanceItem.priority}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-400">{workOrderId}</p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Select
                value={maintenanceItem.status}
                onValueChange={handleStatusSelect}
              >
                <SelectTrigger
                  className={`h-8 w-auto gap-1 rounded-full border-0 px-3 text-xs font-medium ${statusColour}`}
                >
                  <SelectValue>
                    {formatStatus(maintenanceItem.status)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-gray-400 hover:text-gray-700"
                onClick={toggleExpand}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* ── Collapsed preview ── */}
          {!isExpanded && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
              {maintenanceItem.scheduledDate && (
                <span>{formatDate(maintenanceItem.scheduledDate)}</span>
              )}
              {assignedStaffName ? (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {assignedStaffName}
                </span>
              ) : (
                <span className="italic text-gray-400">Unassigned</span>
              )}
              {maintenanceItem.paymentStatus === "overpaid" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Overpaid
                </span>
              )}
            </div>
          )}

          {/* ── EXPANDED DETAILS ── */}
          {isExpanded && (
            <div className="mt-4 space-y-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Info
                  label="Scheduled"
                  value={formatDate(maintenanceItem.scheduledDate)}
                />
                <Info label="Type" value={maintenanceItem.type} />
                <Info
                  label="Estimated"
                  value={`₹${maintenanceItem.amount || 0}`}
                />
                <Info
                  label="Paid"
                  value={`₹${maintenanceItem.paidAmount || 0}`}
                  highlight={
                    maintenanceItem.paymentStatus === "overpaid"
                      ? "amber"
                      : null
                  }
                />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    Payment
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${paymentBadgeColour}`}
                  >
                    {maintenanceItem.paymentStatus?.replace(/_/g, " ") ?? "N/A"}
                  </span>
                </div>
              </div>

              {maintenanceItem.description && (
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {maintenanceItem.description}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0">
                  Assign to
                </p>
                <Select
                  value={assignedStaffId || "__unassigned__"}
                  onValueChange={handleAssignStaff}
                  disabled={assigning}
                >
                  <SelectTrigger className="h-8 w-full sm:w-52 bg-white border-gray-300 text-sm">
                    <SelectValue placeholder="Assign staff">
                      {assignedStaffId
                        ? staffs.find((s) => s._id === assignedStaffId)
                          ?.name ?? "Assigned"
                        : "Unassigned"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {staffs.map((staff) => (
                      <SelectItem key={staff._id} value={staff._id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function Info({ label, value, highlight }) {
  const valueClass =
    highlight === "amber"
      ? "text-amber-700 font-semibold"
      : "text-gray-800";
  return (
    <div>
      <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-sm font-medium capitalize ${valueClass}`}>
        {value || "N/A"}
      </p>
    </div>
  );
}