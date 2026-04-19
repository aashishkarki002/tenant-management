import { useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { assignPersonnel, updatePersonnel } from "../services/vendorService";

const validationSchema = Yup.object({
  name: Yup.string().required("Name is required"),
  phone: Yup.string(),
  idType: Yup.string().required("ID type is required"),
  idNumber: Yup.string(),
  shift: Yup.string().required("Shift is required"),
  assignedFrom: Yup.string().required("Assigned from date is required"),
  assignedTo: Yup.string(),
  notes: Yup.string(),
});

const initialValues = {
  name: "",
  phone: "",
  idType: "citizenship",
  idNumber: "",
  shift: "day",
  assignedFrom: new Date().toISOString().slice(0, 10),
  assignedTo: "",
  notes: "",
};

const buildValues = (personnel) => ({
  name: personnel.name || "",
  phone: personnel.phone || "",
  idType: personnel.idType || "citizenship",
  idNumber: personnel.idNumber || "",
  shift: personnel.shift || "day",
  assignedFrom: personnel.assignedFrom
    ? new Date(personnel.assignedFrom).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10),
  assignedTo: personnel.assignedTo
    ? new Date(personnel.assignedTo).toISOString().slice(0, 10)
    : "",
  notes: personnel.notes || "",
});

export default function PersonnelForm({
  open,
  onClose,
  vendorId,
  contractId,
  personnel,
  onSuccess,
}) {
  const formik = useFormik({
    initialValues,
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const payload = {
          ...values,
          assignedTo: values.assignedTo || null,
          phone: values.phone || null,
          idNumber: values.idNumber || null,
          notes: values.notes || null,
        };
        if (personnel) {
          await updatePersonnel(personnel._id, payload);
          toast.success("Personnel updated");
        } else {
          await assignPersonnel({ ...payload, vendorId, contractId });
          toast.success("Personnel assigned");
        }
        onSuccess?.();
        onClose();
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to save personnel");
      } finally {
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (open) {
      formik.resetForm({
        values: personnel ? buildValues(personnel) : initialValues,
      });
    }
  }, [open, personnel]);

  const fieldError = (field) =>
    formik.touched[field] && formik.errors[field] ? (
      <p className="text-xs text-destructive">{formik.errors[field]}</p>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="sm:max-w-md"
        style={{
          background: "var(--color-surface-raised)",
          borderColor: "var(--color-border)",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: "var(--color-text-strong)" }}>
            {personnel ? "Edit Personnel" : "Assign Personnel"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={formik.handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Name */}
            <div className="col-span-2 space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Full Name <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder="e.g. Ram Bahadur Thapa"
                {...formik.getFieldProps("name")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
              {fieldError("name")}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>Phone</Label>
              <Input
                placeholder="98XXXXXXXX"
                {...formik.getFieldProps("phone")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
            </div>

            {/* Shift */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>Shift</Label>
              <Select
                value={formik.values.shift}
                onValueChange={(v) => formik.setFieldValue("shift", v)}
              >
                <SelectTrigger
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-body)",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                  <SelectItem value="rotating">Rotating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ID Type */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>ID Type</Label>
              <Select
                value={formik.values.idType}
                onValueChange={(v) => formik.setFieldValue("idType", v)}
              >
                <SelectTrigger
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-body)",
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="citizenship">Citizenship</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="driving_license">Driving License</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ID Number */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>ID Number</Label>
              <Input
                placeholder="Document number"
                {...formik.getFieldProps("idNumber")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
            </div>

            {/* Assigned From */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Assigned From <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                {...formik.getFieldProps("assignedFrom")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
              {fieldError("assignedFrom")}
            </div>

            {/* Assigned To */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Assigned To (optional)
              </Label>
              <Input
                type="date"
                {...formik.getFieldProps("assignedTo")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2 space-y-1.5">
              <Label style={{ color: "var(--color-text-body)" }}>
                Notes (optional)
              </Label>
              <Input
                placeholder="Any remarks…"
                {...formik.getFieldProps("notes")}
                style={{
                  background: "var(--color-surface)",
                  borderColor: "var(--color-border)",
                  color: "var(--color-text-body)",
                }}
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={formik.isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={formik.isSubmitting}>
              {formik.isSubmitting ? "Saving…" : personnel ? "Update" : "Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
