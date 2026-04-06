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

export default function VendorForm({
  open,
  onClose,
  onSubmit,
  vendor,
  submeters = [],
}) {
  const [formData, setFormData] = useState({
    name: "",
    vendor_type: "service",
    serviceType: "security",
    contact: "",
    phone: "",
    email: "",
    contactPerson: "",
    address: "",
    panNumber: "",
    vatRegistered: false,
    bankDetails: {
      bankName: "",
      accountNumber: "",
      branchName: "",
    },
    notes: "",
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        name: vendor.name || "",
        vendor_type: vendor.vendor_type || "service",
        serviceType: vendor.serviceType || "security",
        contact: vendor.contact || vendor.phone || "",
        phone: vendor.phone || "",
        email: vendor.email || "",
        contactPerson: vendor.contactPerson || "",
        address: vendor.address || "",
        panNumber: vendor.panNumber || "",
        vatRegistered: vendor.vatRegistered || false,
        bankDetails: vendor.bankDetails || {
          bankName: "",
          accountNumber: "",
          branchName: "",
        },
        notes: vendor.notes || "",
      });
    } else {
      setFormData({
        name: "",
        vendor_type: "service",
        serviceType: "security",
        contact: "",
        phone: "",
        email: "",
        contactPerson: "",
        address: "",
        panNumber: "",
        vatRegistered: false,
        bankDetails: {
          bankName: "",
          accountNumber: "",
          branchName: "",
        },
        notes: "",
      });
    }
  }, [vendor, open]);

  const handleChange = (field, value) => {
    if (field.startsWith("bankDetails.")) {
      const bankField = field.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        bankDetails: {
          ...prev.bankDetails,
          [bankField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const isStallVendor = formData.vendor_type === "stall";
  
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vendor ? "Edit Vendor" : "Add New Vendor"}
          </DialogTitle>
          <DialogDescription>
            {vendor
              ? "Update vendor information below"
              : "Fill in the vendor details below"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Vendor Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter vendor name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor_type">
                Vendor Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.vendor_type}
                onValueChange={(value) => handleChange("vendor_type", value)}
              >
                <SelectTrigger id="vendor_type">
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service Vendor</SelectItem>
                  <SelectItem value="stall">Stall Vendor</SelectItem>
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

            <div className="space-y-2">
              <Label htmlFor="phone">
                Phone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                placeholder="+977-9XXXXXXXXX"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="vendor@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => handleChange("contactPerson", e.target.value)}
                placeholder="Primary contact person"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleChange("address", e.target.value)}
                placeholder="Vendor address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="panNumber">PAN Number</Label>
              <Input
                id="panNumber"
                value={formData.panNumber}
                onChange={(e) => handleChange("panNumber", e.target.value)}
                placeholder="PAN/Tax ID"
              />
            </div>

            <div className="flex items-center space-x-2 pt-7">
              <input
                type="checkbox"
                id="vatRegistered"
                checked={formData.vatRegistered}
                onChange={(e) => handleChange("vatRegistered", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="vatRegistered" className="font-normal">
                VAT Registered
              </Label>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold">Bank Details (Optional)</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank Name</Label>
                <Input
                  id="bankName"
                  value={formData.bankDetails.bankName}
                  onChange={(e) => handleChange("bankDetails.bankName", e.target.value)}
                  placeholder="Bank name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountNumber">Account Number</Label>
                <Input
                  id="accountNumber"
                  value={formData.bankDetails.accountNumber}
                  onChange={(e) => handleChange("bankDetails.accountNumber", e.target.value)}
                  placeholder="Account number"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="branchName">Branch Name</Label>
                <Input
                  id="branchName"
                  value={formData.bankDetails.branchName}
                  onChange={(e) => handleChange("bankDetails.branchName", e.target.value)}
                  placeholder="Branch name"
                />
              </div>
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
            <Button type="submit">{vendor ? "Update" : "Add"} Vendor</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
