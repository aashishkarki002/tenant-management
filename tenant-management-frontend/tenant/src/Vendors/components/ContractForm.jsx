import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

export default function ContractForm({
  open,
  onClose,
  onSubmit,
  contract,
  vendorId,
  properties = [],
}) {
  const [formData, setFormData] = useState({
    vendorId: vendorId || "",
    propertyId: "",
    serviceType: "security",
    description: "",
    billingCycle: "monthly",
    contractAmountPaisa: "",
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
    autoRenew: false,
    expenseAccountCode: "",
    notes: "",
  });

  useEffect(() => {
    if (contract) {
      setFormData({
        vendorId: contract.vendorId || vendorId || "",
        propertyId: contract.propertyId || "",
        serviceType: contract.serviceType || "security",
        description: contract.description || "",
        billingCycle: contract.billingCycle || "monthly",
        contractAmountPaisa: contract.contractAmountPaisa
          ? contract.contractAmountPaisa / 100
          : "",
        startDate: contract.startDate
          ? new Date(contract.startDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        endDate: contract.endDate
          ? new Date(contract.endDate).toISOString().split("T")[0]
          : "",
        autoRenew: contract.autoRenew || false,
        expenseAccountCode: contract.expenseAccountCode || "",
        notes: contract.notes || "",
      });
    } else {
      setFormData({
        vendorId: vendorId || "",
        propertyId: "",
        serviceType: "security",
        description: "",
        billingCycle: "monthly",
        contractAmountPaisa: "",
        startDate: new Date().toISOString().split("T")[0],
        endDate: "",
        autoRenew: false,
        expenseAccountCode: "",
        notes: "",
      });
    }
  }, [contract, vendorId, open]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      contractAmountPaisa: Math.round(parseFloat(formData.contractAmountPaisa) * 100),
    };
    
    onSubmit(submitData);
  };

  const serviceTypes = [
    { value: "security", label: "Security" },
    { value: "cleaning", label: "Cleaning" },
    { value: "maintenance", label: "Maintenance" },
    { value: "electrical", label: "Electrical" },
    { value: "plumbing", label: "Plumbing" },
    { value: "it", label: "IT Services" },
    { value: "courtyard_vendor", label: "Courtyard Vendor" },
    { value: "other", label: "Other" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {contract ? "Edit Contract" : "Create New Contract"}
          </DialogTitle>
          <DialogDescription>
            {contract
              ? "Update contract details below"
              : "Fill in the contract details below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyId">
                Property <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.propertyId}
                onValueChange={(value) => handleChange("propertyId", value)}
              >
                <SelectTrigger id="propertyId">
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {properties.map((property) => (
                    <SelectItem key={property._id} value={property._id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="serviceType">
                Service Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.serviceType}
                onValueChange={(value) => handleChange("serviceType", value)}
              >
                <SelectTrigger id="serviceType">
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {serviceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="e.g., 24-hour security guard deployment - 2 guards"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="billingCycle">
                Billing Cycle <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.billingCycle}
                onValueChange={(value) => handleChange("billingCycle", value)}
              >
                <SelectTrigger id="billingCycle">
                  <SelectValue placeholder="Select billing cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="one_time">One Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contractAmountPaisa">
                Contract Amount (रू) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="contractAmountPaisa"
                type="number"
                value={formData.contractAmountPaisa}
                onChange={(e) =>
                  handleChange("contractAmountPaisa", e.target.value)
                }
                placeholder="0"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange("startDate", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange("endDate", e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="expenseAccountCode">
                Expense Account Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="expenseAccountCode"
                value={formData.expenseAccountCode}
                onChange={(e) =>
                  handleChange("expenseAccountCode", e.target.value)
                }
                placeholder="e.g., 6100-SECURITY-GARUD"
                required
              />
              <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
                Chart of accounts code for this expense type
              </p>
            </div>

            <div className="flex items-center space-x-2 pt-7 md:col-span-2">
              <input
                type="checkbox"
                id="autoRenew"
                checked={formData.autoRenew}
                onChange={(e) => handleChange("autoRenew", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="autoRenew" className="font-normal">
                Auto-renew contract
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              placeholder="Additional information..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {contract ? "Update" : "Create"} Contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
