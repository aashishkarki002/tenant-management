/**
 * EntityFormDialog.jsx
 *
 * Modal dialog for creating or editing an OwnershipEntity.
 *
 * Props:
 *   open          boolean
 *   onOpenChange  (open: boolean) => void
 *   entity        OwnershipEntity | null   (null = create mode)
 *   onSave        (data) => Promise<void>  (calls createEntity or updateEntity)
 */

import { useState, useEffect } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SCHEMA = Yup.object({
    name: Yup.string().trim().required("Name is required"),
    type: Yup.string().oneOf(["private", "company"]).required("Type is required"),
    pan: Yup.string().trim(),
    vatNumber: Yup.string().trim(),
    registrationNo: Yup.string().trim(),
    contactEmail: Yup.string().email("Invalid email").trim(),
    chartOfAccountsPrefix: Yup.string().trim().uppercase(),
    "address.street": Yup.string().trim(),
    "address.city": Yup.string().trim(),
    "address.district": Yup.string().trim(),
    "address.province": Yup.string().trim(),
});

const EMPTY = {
    name: "", type: "private", pan: "", vatNumber: "", registrationNo: "",
    contactEmail: "", chartOfAccountsPrefix: "",
    "address.street": "", "address.city": "", "address.district": "", "address.province": "",
};

function flatToNested(flat) {
    return {
        name: flat.name,
        type: flat.type,
        pan: flat.pan,
        vatNumber: flat.vatNumber,
        registrationNo: flat.registrationNo,
        contactEmail: flat.contactEmail,
        chartOfAccountsPrefix: flat.chartOfAccountsPrefix?.toUpperCase() || (flat.type === "company" ? "CO" : "PVT"),
        address: {
            street: flat["address.street"],
            city: flat["address.city"],
            district: flat["address.district"],
            province: flat["address.province"],
        },
    };
}

function entityToFlat(entity) {
    return {
        name: entity.name ?? "",
        type: entity.type ?? "private",
        pan: entity.pan ?? "",
        vatNumber: entity.vatNumber ?? "",
        registrationNo: entity.registrationNo ?? "",
        contactEmail: entity.contactEmail ?? "",
        chartOfAccountsPrefix: entity.chartOfAccountsPrefix ?? "",
        "address.street": entity.address?.street ?? "",
        "address.city": entity.address?.city ?? "",
        "address.district": entity.address?.district ?? "",
        "address.province": entity.address?.province ?? "",
    };
}

export function EntityFormDialog({ open, onOpenChange, entity, onSave }) {
    const isEdit = Boolean(entity);

    const formik = useFormik({
        initialValues: entity ? entityToFlat(entity) : EMPTY,
        enableReinitialize: true,
        validationSchema: SCHEMA,
        onSubmit: async (values, { setSubmitting, resetForm }) => {
            try {
                await onSave(flatToNested(values));
                toast.success(isEdit ? "Entity updated" : "Entity created");
                resetForm();
                onOpenChange(false);
            } catch (err) {
                toast.error(err?.message ?? "Failed to save entity");
            } finally {
                setSubmitting(false);
            }
        },
    });

    // Auto-set prefix when type changes (only in create mode)
    useEffect(() => {
        if (!isEdit) {
            formik.setFieldValue(
                "chartOfAccountsPrefix",
                formik.values.type === "company" ? "CO" : "PVT",
            );
        }
    }, [formik.values.type]);

    const isCompany = formik.values.type === "company";

    function FieldError({ name }) {
        if (!formik.errors[name] || !formik.touched[name]) return null;
        return <p className="text-[11px] text-destructive mt-1">{formik.errors[name]}</p>;
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) formik.resetForm(); onOpenChange(o); }}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEdit ? "Edit Entity" : "Create Ownership Entity"}</DialogTitle>
                    <DialogDescription>
                        {isEdit
                            ? "Update the details of this ownership entity."
                            : "Add a new private or company entity to assign buildings to."}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={formik.handleSubmit} className="space-y-5 mt-2">
                    {/* Name + Type */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Entity Name <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                name="name"
                                placeholder="Ram Prasad Sharma"
                                value={formik.values.name}
                                onChange={formik.handleChange}
                                onBlur={formik.handleBlur}
                                className="h-9"
                            />
                            <FieldError name="name" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Type <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={formik.values.type}
                                onValueChange={(v) => formik.setFieldValue("type", v)}
                                disabled={isEdit} // type cannot be changed after creation
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="private">Private</SelectItem>
                                    <SelectItem value="company">Company</SelectItem>
                                </SelectContent>
                            </Select>
                            {isEdit && (
                                <p className="text-[11px] text-muted-foreground">Type cannot be changed after creation.</p>
                            )}
                        </div>
                    </div>

                    {/* Chart of Accounts Prefix */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Chart of Accounts Prefix
                        </Label>
                        <Input
                            name="chartOfAccountsPrefix"
                            placeholder={isCompany ? "CO" : "PVT"}
                            value={formik.values.chartOfAccountsPrefix}
                            onChange={(e) =>
                                formik.setFieldValue("chartOfAccountsPrefix", e.target.value.toUpperCase())
                            }
                            onBlur={formik.handleBlur}
                            className="h-9 font-mono uppercase w-32"
                            maxLength={10}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Used as a prefix for ledger accounts (e.g. <span className="font-mono">PVT-4000</span>). Must be unique.
                        </p>
                    </div>

                    {/* PAN + Contact Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">PAN</Label>
                            <Input name="pan" placeholder="123-456-789" value={formik.values.pan}
                                onChange={formik.handleChange} onBlur={formik.handleBlur} className="h-9 font-mono" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact Email</Label>
                            <Input name="contactEmail" type="email" placeholder="owner@example.com"
                                value={formik.values.contactEmail} onChange={formik.handleChange}
                                onBlur={formik.handleBlur} className="h-9" />
                            <FieldError name="contactEmail" />
                        </div>
                    </div>

                    {/* Company-only fields */}
                    {isCompany && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border bg-secondary/30 px-4 py-4">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider col-span-full">
                                Company Registration
                            </p>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">VAT Number</Label>
                                <Input name="vatNumber" placeholder="VR-00123" value={formik.values.vatNumber}
                                    onChange={formik.handleChange} onBlur={formik.handleBlur} className="h-9 font-mono" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registration No.</Label>
                                <Input name="registrationNo" placeholder="REG-2024-001" value={formik.values.registrationNo}
                                    onChange={formik.handleChange} onBlur={formik.handleBlur} className="h-9 font-mono" />
                            </div>
                        </div>
                    )}

                    {/* Address */}
                    <div className="space-y-3">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Address (optional)</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[
                                { name: "address.street", label: "Street", placeholder: "Durbar Marg" },
                                { name: "address.city", label: "City", placeholder: "Kathmandu" },
                                { name: "address.district", label: "District", placeholder: "Kathmandu" },
                                { name: "address.province", label: "Province", placeholder: "Bagmati" },
                            ].map(({ name, label, placeholder }) => (
                                <div key={name} className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">{label}</Label>
                                    <Input name={name} placeholder={placeholder} value={formik.values[name]}
                                        onChange={formik.handleChange} onBlur={formik.handleBlur} className="h-9" />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                        <Button type="button" variant="outline" className="flex-1 h-9"
                            onClick={() => { formik.resetForm(); onOpenChange(false); }}>
                            Cancel
                        </Button>
                        <Button type="submit" className="flex-1 h-9" disabled={formik.isSubmitting}>
                            {formik.isSubmitting
                                ? (isEdit ? "Saving…" : "Creating…")
                                : (isEdit ? "Save Changes" : "Create Entity")}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}