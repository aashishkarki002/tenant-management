import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronUp, ChevronDown, User } from 'lucide-react';
import api from '../../../../plugins/axios';
import { toast } from 'sonner';

export default function MaintenanceCard({
    maintenanceItem,
    isExpanded,
    toggleExpand,
    getPriorityStyle,
    formatStatus,
    formatDate,
    workOrderId,
    onUpdate
}) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState({
        status: maintenanceItem.status || 'OPEN',
        paymentStatus: maintenanceItem.paymentStatus || 'pending',
        paidAmount: maintenanceItem.paidAmount?.toString() || '0'
    });

    // Sync form data when maintenanceItem changes
    useEffect(() => {
        setFormData({
            status: maintenanceItem.status || 'OPEN',
            paymentStatus: maintenanceItem.paymentStatus || 'pending',
            paidAmount: maintenanceItem.paidAmount?.toString() || '0'
        });
    }, [maintenanceItem]);

    const handleStatusSelect = (newStatus) => {
        if (!newStatus || newStatus === maintenanceItem.status) {
            return;
        }

        setFormData(prev => ({ ...prev, status: newStatus }));

        // Delay dialog opening to allow Select to close properly
        setTimeout(() => {
            setIsDialogOpen(true);
        }, 100);
    };

    const handleDialogClose = () => {
        // Reset form data to original values
        setFormData({
            status: maintenanceItem.status || 'OPEN',
            paymentStatus: maintenanceItem.paymentStatus || 'pending',
            paidAmount: maintenanceItem.paidAmount?.toString() || '0'
        });
        setIsDialogOpen(false);
    };

    const handleSubmit = async () => {
        try {
            const response = await api.patch(`/api/maintenance/${maintenanceItem._id}/status`, {
                status: formData.status,
                paymentStatus: formData.paymentStatus,
                paidAmount: parseFloat(formData.paidAmount) || 0
            });

            if (response.data.success) {
                toast.success("Status and payment information updated successfully");
                setIsDialogOpen(false);

                if (onUpdate) {
                    onUpdate();
                } else {
                    window.location.reload();
                }
            } else {
                toast.error("Failed to update status");
            }
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error(error.response?.data?.message || "Failed to update status");
        }
    };

    const updateFormField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <>
            {/* Status Update Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="bg-white text-black sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-semibold">
                            Update Status & Payment
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Payment Status */}
                        <div className="space-y-2">
                            <Label htmlFor="payment-status" className="text-sm font-medium">
                                Payment Status
                            </Label>
                            <Select
                                value={formData.paymentStatus}
                                onValueChange={(value) => updateFormField('paymentStatus', value)}
                            >
                                <SelectTrigger
                                    id="payment-status"
                                    className="bg-white text-black border-gray-300"
                                >
                                    <SelectValue placeholder="Select payment status" />
                                </SelectTrigger>
                                <SelectContent className="bg-white text-black">
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="partially_paid">Partially Paid</SelectItem>
                                    <SelectItem value="paid">Paid</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Paid Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="paid-amount" className="text-sm font-medium">
                                Paid Amount (₹)
                            </Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                                    ₹
                                </span>
                                <Input
                                    id="paid-amount"
                                    type="number"
                                    value={formData.paidAmount}
                                    onChange={(e) => updateFormField('paidAmount', e.target.value)}
                                    className="bg-white text-black border-gray-300 pl-8"
                                    placeholder="0.00"
                                    min="0"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            onClick={handleDialogClose}
                            className="bg-gray-200 text-black hover:bg-gray-300"
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSubmit}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Update
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Main Card */}
            <Card className="border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                    {/* Main Row */}
                    <div className="flex items-center gap-4">
                        {/* Work Order Description */}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-gray-900 leading-tight">
                                {maintenanceItem.title || 'Maintenance Task'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5 leading-tight">
                                {workOrderId}
                            </p>
                        </div>

                        {/* Priority Badge */}
                        {maintenanceItem.priority && (
                            <div className="shrink-0">
                                <Badge
                                    className={`${getPriorityStyle(maintenanceItem.priority)} rounded-md px-3 py-1.5 text-xs font-semibold uppercase`}
                                >
                                    {maintenanceItem.priority}
                                </Badge>
                            </div>
                        )}

                        {/* Unit and Tenant Information */}
                        <div className="shrink-0 min-w-[140px]">
                            <p className="text-base text-gray-900 font-medium leading-tight">
                                {maintenanceItem.unit?._id}
                            </p>
                            <p className="text-sm text-gray-500 mt-0.5 leading-tight">
                                {maintenanceItem.tenant?._id}
                            </p>
                        </div>

                        {/* Vendor Information */}
                        <div className="flex items-center gap-2 shrink-0 min-w-[160px]">
                            <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-teal-600" />
                            </div>
                            <p className="text-base text-gray-900 truncate">
                                {maintenanceItem.assignedTo?.name || 'Unassigned'}
                            </p>
                        </div>

                        {/* Status Dropdown */}
                        <div className="shrink-0 min-w-[140px]">
                            <Select
                                value={formData.status}
                                onValueChange={handleStatusSelect}
                            >
                                <SelectTrigger className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700 rounded-md h-9">
                                    <SelectValue>
                                        {formatStatus(formData.status)}
                                    </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-white text-black">
                                    <SelectItem value="OPEN">Open</SelectItem>
                                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                                    <SelectItem value="COMPLETED">Completed</SelectItem>
                                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Expand/Collapse Button */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0 h-8 w-8 p-0"
                            onClick={toggleExpand}
                        >
                            {isExpanded ? (
                                <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                                <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                        </Button>
                    </div>

                    {/* Expanded Section */}
                    {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Scheduled Date</p>
                                    <p className="text-sm text-gray-900">
                                        {formatDate(maintenanceItem.scheduledDate)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Type</p>
                                    <p className="text-sm text-gray-900">
                                        {maintenanceItem.type || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Amount</p>
                                    <p className="text-sm text-gray-900">
                                        ₹{maintenanceItem.amount || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Paid Amount</p>
                                    <p className="text-sm text-gray-900">
                                        ₹{maintenanceItem.paidAmount || 0}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                                    <p className="text-sm text-gray-900 capitalize">
                                        {maintenanceItem.paymentStatus?.replace('_', ' ') || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Last Paid By</p>
                                    <p className="text-sm text-gray-900">
                                        {maintenanceItem.lastPaidBy?.name || 'N/A'}
                                    </p>
                                </div>
                                {maintenanceItem.description && (
                                    <div className="col-span-2 md:col-span-4">
                                        <p className="text-xs text-gray-500 mb-1">Description</p>
                                        <p className="text-sm text-gray-900">
                                            {maintenanceItem.description}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}