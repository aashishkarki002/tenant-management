import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
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

const validationSchema = Yup.object({
  name: Yup.string().required("Vendor name is required"),
  vendor_type: Yup.string().required("Vendor type is required"),
  serviceType: Yup.string().required("Service type is required"),
  phone: Yup.string().required("Phone is required"),
  email: Yup.string().email("Invalid email address"),
  contactPerson: Yup.string(),
  address: Yup.string(),
  panNumber: Yup.string(),
  vatRegistered: Yup.boolean(),
  bankDetails: Yup.object({
    bankName: Yup.string(),
    accountNumber: Yup.string(),
    branchName: Yup.string(),
  }),
  notes: Yup.string(),
});

const initialValues = {
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
};

const SERVICE_TYPES = [
  { value: "security", label: "Security" },
  { value: "cleaning", label: "Cleaning" },
  { value: "maintenance", label: "Maintenance" },
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing" },
  { value: "it", label: "IT Services" },
  { value: "courtyard_vendor", label: "Courtyard Vendor" },
  { value: "other", label: "Other" },
];

export default function VendorForm({
  open,
  onClose,
  onSubmit,
  vendor,
  submeters = [],
}) {
  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: (values) => {
      onSubmit(values);
    },
  });

  useEffect(() => {
    if (open) {
      if (vendor) {
        formik.resetForm({
          values: {
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
          },
        });
      } else {
        formik.resetForm({ values: initialValues });
      }
    }
  }, [vendor, open]);

  const fieldError = (field) =>
    formik.touched[field] && formik.errors[field] ? (
      <p className="text-xs text-destructive">{formik.errors[field]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-lg sm:max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
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

        <form onSubmit={formik.handleSubmit} className="space-y-4">

          {/* GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Name */}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">
                Vendor Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                {...formik.getFieldProps("name")}
                placeholder="Enter vendor name"
              />
              {fieldError("name")}
            </div>

            {/* Vendor Type */}
            <div className="space-y-2">
              <Label>Vendor Type *</Label>
              <Select
                value={formik.values.vendor_type}
                onValueChange={(value) =>
                  formik.setFieldValue("vendor_type", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vendor type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Service Vendor</SelectItem>
                  <SelectItem value="stall">Stall Vendor</SelectItem>
                </SelectContent>
              </Select>
              {fieldError("vendor_type")}
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <Label>Service Type *</Label>
              <Select
                value={formik.values.serviceType}
                onValueChange={(value) =>
                  formik.setFieldValue("serviceType", value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select service type" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldError("serviceType")}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label>Phone *</Label>
              <Input
                {...formik.getFieldProps("phone")}
                placeholder="+977-9XXXXXXXXX"
              />
              {fieldError("phone")}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                {...formik.getFieldProps("email")}
                placeholder="vendor@example.com"
              />
              {fieldError("email")}
            </div>

            {/* Contact */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Contact Person</Label>
              <Input
                {...formik.getFieldProps("contactPerson")}
                placeholder="Primary contact person"
              />
            </div>

            {/* Address */}
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input
                {...formik.getFieldProps("address")}
                placeholder="Vendor address"
              />
            </div>

            {/* PAN */}
            <div className="space-y-2">
              <Label>PAN Number</Label>
              <Input
                {...formik.getFieldProps("panNumber")}
                placeholder="PAN/Tax ID"
              />
            </div>

            {/* VAT */}
            <div className="flex items-center space-x-2 pt-6">
              <input
                type="checkbox"
                checked={formik.values.vatRegistered}
                onChange={(e) =>
                  formik.setFieldValue("vatRegistered", e.target.checked)
                }
                className="h-4 w-4"
              />
              <Label className="font-normal">VAT Registered</Label>
            </div>
          </div>

          {/* BANK DETAILS */}
          <div className="space-y-4 rounded-lg border p-4">
            <h3 className="font-semibold text-sm sm:text-base">
              Bank Details (Optional)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                {...formik.getFieldProps("bankDetails.bankName")}
                placeholder="Bank name"
              />
              <Input
                {...formik.getFieldProps("bankDetails.accountNumber")}
                placeholder="Account number"
              />
              <div className="sm:col-span-2">
                <Input
                  {...formik.getFieldProps("bankDetails.branchName")}
                  placeholder="Branch name"
                />
              </div>
            </div>
          </div>

          {/* NOTES */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              {...formik.getFieldProps("notes")}
              placeholder="Additional info..."
              rows={3}
            />
          </div>

          {/* FOOTER */}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4 sticky bottom-0 bg-background">
            <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              {vendor ? "Update" : "Add"} Vendor
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
