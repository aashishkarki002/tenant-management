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
import { ChevronUp, ChevronDown, User } from "lucide-react";
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
    const [pendingStatus, setPendingStatus] = useState(null);
    const [staffs, setStaffs] = useState([]);
    const [assigning, setAssigning] = useState(false);

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
            setPendingStatus("COMPLETED");
            setIsDialogOpen(true);
            return;
        }

        // instant update for other statuses
        try {
            await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
                status: newStatus,
            });
            toast.success("Status updated");
            onUpdate?.();
        } catch (err) {
            toast.error("Failed to update status");
        }
    };

    /* ---------------- COMPLETE WITH PAYMENT ---------------- */

    const handleCompleteSubmit = async () => {
        try {
            await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
                status: "COMPLETED",
                paymentStatus: formData.paymentStatus,
                paidAmount: Number(formData.paidAmount),
            });

            toast.success("Work order completed");
            setIsDialogOpen(false);
            setPendingStatus(null);
            onUpdate?.();
        } catch (err) {
            toast.error("Failed to complete work order");
        }
    };

    const handleDialogClose = () => {
        setIsDialogOpen(false);
        setPendingStatus(null);
    };

    const updateFormField = (field, value) => {
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

    /* ---------------- UI ---------------- */

    return (
        <>
            {/* PAYMENT CONFIRMATION DIALOG */}
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
                        {/* Assign staff */}
                        <div className="space-y-2">
                            <Label>Assign to</Label>
                            <Select
                                value={assignedStaffId || "__unassigned__"}
                                onValueChange={handleAssignStaff}
                                disabled={assigning}
                            >
                                <SelectTrigger className="bg-white border-gray-300">
                                    <SelectValue placeholder="Assign staff">
                                        {assignedStaffId
                                            ? staffs.find((s) => s._id === assignedStaffId)?.name ?? "Assigned"
                                            : "Unassigned"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__unassigned__">
                                        Unassigned
                                    </SelectItem>
                                    {staffs.map((staff) => (
                                        <SelectItem key={staff._id} value={staff._id}>
                                            {staff.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

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
                                    <SelectItem value="partially_paid">
                                        Partially Paid
                                    </SelectItem>
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
                                onChange={(e) =>
                                    updateFormField("paidAmount", e.target.value)
                                }
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={handleDialogClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={handleCompleteSubmit}
                        >
                            Complete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MAIN CARD */}
            <Card className="w-full min-w-0 rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md">
                <CardContent className="p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                        {/* Title */}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">
                                {maintenanceItem.title}
                            </h3>
                            <p className="text-sm text-gray-500">{workOrderId}</p>
                        </div>

                        {/* Priority badge */}
                        {maintenanceItem.priority && (
                            <Badge
                                className={`${getPriorityStyle(
                                    maintenanceItem.priority
                                )} shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase`}
                            >
                                {maintenanceItem.priority}
                            </Badge>
                        )}

                        {/* Assign staff */}
                        <div className="flex w-full items-center gap-2 sm:w-auto sm:min-w-[140px]">
                            <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-teal-600" />
                            </div>
                            <Select
                                value={assignedStaffId || "__unassigned__"}
                                onValueChange={handleAssignStaff}
                                disabled={assigning}
                            >
                                <SelectTrigger className="min-w-0 flex-1 bg-white border-gray-300 sm:min-w-[140px] sm:flex-initial">
                                    <SelectValue placeholder="Assign staff">
                                        {assignedStaffId
                                            ? staffs.find((s) => s._id === assignedStaffId)?.name ?? "Assigned"
                                            : "Unassigned"}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__unassigned__">
                                        Unassigned
                                    </SelectItem>
                                    {staffs.map((staff) => (
                                        <SelectItem key={staff._id} value={staff._id}>
                                            {staff.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Status */}
                        <Select
                            value={maintenanceItem.status}
                            onValueChange={handleStatusSelect}
                        >
                            <SelectTrigger className="bg-blue-600 text-white">
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

                        {/* Expand */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={toggleExpand}
                        >
                            {isExpanded ? <ChevronUp /> : <ChevronDown />}
                        </Button>
                    </div>

                    {/* EXPANDED DETAILS */}
                    {isExpanded && (
                        <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4 md:grid-cols-4">
                            <Info label="Scheduled Date" value={formatDate(maintenanceItem.scheduledDate)} />
                            <Info label="Type" value={maintenanceItem.type} />
                            <Info label="Amount" value={`₹${maintenanceItem.amount || 0}`} />
                            <Info label="Paid" value={`₹${maintenanceItem.paidAmount || 0}`} />
                            <Info
                                label="Payment Status"
                                value={maintenanceItem.paymentStatus?.replace("_", " ")}
                            />
                            {maintenanceItem.description && (
                                <div className="col-span-2 md:col-span-4">
                                    <p className="text-xs text-gray-500">Description</p>
                                    <p>{maintenanceItem.description}</p>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}

/* --------- SMALL HELPER --------- */
function Info({ label, value }) {
    return (
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm">{value || "N/A"}</p>
        </div>
    );
}
