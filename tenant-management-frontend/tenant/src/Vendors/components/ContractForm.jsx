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

const validationSchema = Yup.object({
  contractType: Yup.string().required(),
  propertyId: Yup.string().required("Property is required"),
  serviceType: Yup.string().required("Service type is required"),
  description: Yup.string(),
  billingCycle: Yup.string().required("Billing cycle is required"),
  contractAmountPaisa: Yup.number()
    .typeError("Amount must be a number")
    .positive("Amount must be greater than 0")
    .required("Amount is required"),
  startDate: Yup.string().required("Start date is required"),
  endDate: Yup.string(),
  autoRenew: Yup.boolean(),
  expenseAccountCode: Yup.string().when("contractType", {
    is: "service",
    then: (s) => s.required("Expense account code is required"),
  }),
  revenueAccountCode: Yup.string().when("contractType", {
    is: "stall_lease",
    then: (s) => s.required("Revenue account code is required"),
  }),
  stallDescription: Yup.string(),
  eventName: Yup.string(),
  leaseDays: Yup.number().integer().positive().nullable(),
  notes: Yup.string(),
});

const emptyForm = (vendorId) => ({
  vendorId: vendorId || "",
  propertyId: "",
  contractType: "service",
  serviceType: "security",
  description: "",
  billingCycle: "monthly",
  contractAmountPaisa: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  autoRenew: false,
  expenseAccountCode: "",
  revenueAccountCode: "",
  stallDescription: "",
  eventName: "",
  leaseDays: "",
  notes: "",
});

const buildValues = (contract, vendorId) => ({
  vendorId: contract.vendorId || vendorId || "",
  propertyId: contract.property?._id || contract.propertyId || "",
  contractType: contract.contractType || "service",
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
  revenueAccountCode: contract.revenueAccountCode || "",
  stallDescription: contract.stallDescription || "",
  eventName: contract.eventName || "",
  leaseDays: contract.leaseDays || "",
  notes: contract.notes || "",
});

export default function ContractForm({
  open,
  onClose,
  onSubmit,
  contract,
  vendorId,
  properties = [],
}) {
  const formik = useFormik({
    initialValues: emptyForm(vendorId),
    validationSchema,
    onSubmit: (values) => {
      const submitData = {
        ...values,
        contractAmountPaisa: Math.round(
          parseFloat(values.contractAmountPaisa) * 100
        ),
        leaseDays: values.leaseDays ? parseInt(values.leaseDays, 10) : null,
      };
      onSubmit(submitData);
    },
  });

  useEffect(() => {
    if (open) {
      formik.resetForm({
        values: contract ? buildValues(contract, vendorId) : emptyForm(vendorId),
      });
    }
  }, [contract, vendorId, open]);

  const fieldError = (field) =>
    formik.touched[field] && formik.errors[field] ? (
      <p className="text-xs text-destructive">{formik.errors[field]}</p>
    ) : null;

  const isStallLease = formik.values.contractType === "stall_lease";

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

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          {/* Contract Type Toggle */}
          <div className="space-y-2">
            <Label>
              Contract Type <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              {[
                { value: "service", label: "Service (we pay vendor)" },
                { value: "stall_lease", label: "Stall Lease (vendor pays us)" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    formik.setFieldValue("contractType", opt.value)
                  }
                  className="flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor:
                      formik.values.contractType === opt.value
                        ? "var(--color-accent)"
                        : "var(--color-border)",
                    backgroundColor:
                      formik.values.contractType === opt.value
                        ? "var(--color-accent-bg)"
                        : "var(--color-surface)",
                    color:
                      formik.values.contractType === opt.value
                        ? "var(--color-accent)"
                        : "var(--color-text-body)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Property */}
            <div className="space-y-2">
              <Label htmlFor="propertyId">
                Property <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formik.values.propertyId}
                onValueChange={(value) =>
                  formik.setFieldValue("propertyId", value)
                }
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
              {fieldError("propertyId")}
            </div>

            {/* Service Type */}
            <div className="space-y-2">
              <Label htmlFor="serviceType">
                Service Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formik.values.serviceType}
                onValueChange={(value) =>
                  formik.setFieldValue("serviceType", value)
                }
              >
                <SelectTrigger id="serviceType">
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

            {/* Description */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...formik.getFieldProps("description")}
                placeholder={
                  isStallLease
                    ? "e.g., Dashain Fair stall for selling handicrafts"
                    : "e.g., 24-hour security guard deployment — 2 guards"
                }
                rows={2}
              />
            </div>

            {/* Stall Lease fields */}
            {isStallLease && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="stallDescription">Stall / Space</Label>
                  <Input
                    id="stallDescription"
                    {...formik.getFieldProps("stallDescription")}
                    placeholder="e.g., Stall A3 — Ground Floor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="eventName">Event Name (optional)</Label>
                  <Input
                    id="eventName"
                    {...formik.getFieldProps("eventName")}
                    placeholder="e.g., Dashain Fair 2081"
                  />
                </div>
              </>
            )}

            {/* Billing Cycle */}
            <div className="space-y-2">
              <Label htmlFor="billingCycle">
                Billing Cycle <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formik.values.billingCycle}
                onValueChange={(value) =>
                  formik.setFieldValue("billingCycle", value)
                }
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
              {fieldError("billingCycle")}
            </div>

            {/* Lease Days — only for one_time stall leases */}
            {isStallLease && formik.values.billingCycle === "one_time" && (
              <div className="space-y-2">
                <Label htmlFor="leaseDays">Number of Days</Label>
                <Input
                  id="leaseDays"
                  type="number"
                  min="1"
                  {...formik.getFieldProps("leaseDays")}
                  placeholder="e.g., 5"
                />
              </div>
            )}

            {/* Contract Amount */}
            <div className="space-y-2">
              <Label htmlFor="contractAmountPaisa">
                {isStallLease ? "Lease Amount (रू)" : "Contract Amount (रू)"}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                id="contractAmountPaisa"
                type="number"
                {...formik.getFieldProps("contractAmountPaisa")}
                placeholder="0"
                min="0"
                step="0.01"
              />
              {fieldError("contractAmountPaisa")}
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="startDate">
                Start Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="startDate"
                type="date"
                {...formik.getFieldProps("startDate")}
              />
              {fieldError("startDate")}
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date (Optional)</Label>
              <Input
                id="endDate"
                type="date"
                {...formik.getFieldProps("endDate")}
              />
            </div>

            {/* Account Code */}
            {!isStallLease ? (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="expenseAccountCode">
                  Expense Account Code{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="expenseAccountCode"
                  {...formik.getFieldProps("expenseAccountCode")}
                  placeholder="e.g., 6100-SECURITY-GARUD"
                />
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  Chart of accounts code for this expense type
                </p>
                {fieldError("expenseAccountCode")}
              </div>
            ) : (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="revenueAccountCode">
                  Revenue Account Code{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="revenueAccountCode"
                  {...formik.getFieldProps("revenueAccountCode")}
                  placeholder="e.g., 4200-STALL-RENT"
                />
                <p
                  className="text-xs"
                  style={{ color: "var(--color-text-sub)" }}
                >
                  Chart of accounts code for stall lease revenue
                </p>
                {fieldError("revenueAccountCode")}
              </div>
            )}

            {/* Auto-renew */}
            <div className="flex items-center space-x-2 pt-7 md:col-span-2">
              <input
                type="checkbox"
                id="autoRenew"
                checked={formik.values.autoRenew}
                onChange={(e) =>
                  formik.setFieldValue("autoRenew", e.target.checked)
                }
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
              {...formik.getFieldProps("notes")}
              placeholder="Additional information..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={formik.isSubmitting}>
              {contract ? "Update" : "Create"} Contract
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
