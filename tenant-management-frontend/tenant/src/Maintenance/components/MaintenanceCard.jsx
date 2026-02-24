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

export default function MaintenanceCard({
    maintenanceItem,
    isExpanded,
    toggleExpand,
    getPriorityStyle,
    formatStatus,
    formatDate,
    workOrderId,
    onUpdate,
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [staffs, setStaffs] = useState([]);
    const [assigning, setAssigning] = useState(false);

    // Overpayment confirmation state
    const [overpaymentMeta, setOverpaymentMeta] = useState(null); // { message, diffRupees }

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
    });

    useEffect(() => {
        setFormData({
            paymentStatus: maintenanceItem.paymentStatus || "pending",
            paidAmount: maintenanceItem.paidAmount?.toString() || "0",
        });
    }, [maintenanceItem]);

    /* ---------------- STATUS CHANGE HANDLER ---------------- */
    const handleStatusSelect = async (newStatus) => {
        if (newStatus === maintenanceItem.status) return;

        if (newStatus === "COMPLETED") {
            setOverpaymentMeta(null); // reset any previous overpayment state
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

    /* ---------------- SUBMIT COMPLETION (shared for normal + overpayment confirm) ---- */
    const submitCompletion = async (allowOverpayment = false) => {
        try {
            await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
                status: "COMPLETED",
                paymentStatus: formData.paymentStatus,
                paidAmount: Number(formData.paidAmount),
                ...(allowOverpayment && { allowOverpayment: true }),
            });
            toast.success(
                allowOverpayment
                    ? "Work order completed (overpayment recorded)"
                    : "Work order completed",
            );
            setIsDialogOpen(false);
            setOverpaymentMeta(null);
            onUpdate?.();
        } catch (err) {
            const data = err?.response?.data;

            // ── Overpayment: backend says 409 + isOverpayment:true ──────────
            // Instead of a generic error toast, surface a confirmation prompt
            // inside the dialog so the user can consciously accept it.
            if (err?.response?.status === 409 && data?.isOverpayment) {
                setOverpaymentMeta({
                    message: data.message,
                    diffRupees: data.overpaymentDiffRupees,
                });
                return; // keep dialog open, show warning
            }

            toast.error(data?.message || "Failed to complete work order");
        }
    };

    const handleCompleteSubmit = () => submitCompletion(false);
    const handleOverpaymentConfirm = () => submitCompletion(true);

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setOverpaymentMeta(null);
    };

    const updateFormField = (field, value) => {
        // If the user changes the paidAmount, reset any stale overpayment warning
        if (field === "paidAmount") setOverpaymentMeta(null);
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

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

    /* ── Payment badge colour — overpaid gets its own amber style ── */
    const paymentBadgeColour = {
        pending: "bg-yellow-50 text-yellow-700",
        partially_paid: "bg-orange-50 text-orange-700",
        paid: "bg-emerald-50 text-emerald-700",
        overpaid: "bg-amber-100 text-amber-800",
    }[maintenanceItem.paymentStatus] ?? "bg-gray-100 text-gray-500";

    const estimatedAmount = maintenanceItem.amount || 0;
    const paidAmountNum = Number(formData.paidAmount) || 0;
    const isOverpayingInForm =
        estimatedAmount > 0 && paidAmountNum > estimatedAmount;

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

                        {/* Paid Amount */}
                        <div className="space-y-2">
                            <Label>Paid Amount (₹)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.paidAmount}
                                disabled={formData.paymentStatus === "pending"}
                                onChange={(e) => updateFormField("paidAmount", e.target.value)}
                            />
                            {/* Live hint — shows before submitting */}
                            {isOverpayingInForm && !overpaymentMeta && (
                                <p className="flex items-center gap-1.5 text-xs text-amber-600">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    Paid amount exceeds estimated (₹{estimatedAmount}). You will be
                                    asked to confirm.
                                </p>
                            )}
                        </div>

                        {/* ── Overpayment confirmation banner ────────────────────────────
                            Shown after the backend returns 409 isOverpayment:true.
                            Keeps the user in the same dialog — no extra modal needed.
                        ── */}
                        {overpaymentMeta && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                                <div className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                    <div>
                                        <p className="text-sm font-medium text-amber-800">
                                            Overpayment detected
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

                    {/* Footer — hidden while overpayment banner is showing */}
                    {!overpaymentMeta && (
                        <DialogFooter>
                            <Button variant="outline" onClick={handleDialogClose}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleCompleteSubmit}
                            >
                                Complete
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
                            {/* Surface overpaid status on the card itself */}
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