import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    FileText,
    Image as ImageIcon,
    Trash2,
    Upload,
    ExternalLink,
    AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { isImageFile, isPdfFile, formatFileSize, formatDate } from "../utils/formatting.js";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

const DOCUMENT_TYPES = {
    image: "Profile Image",
    pdfAgreement: "Lease Agreement",
    citizenShip: "Citizenship",
    bank_guarantee: "Bank Guarantee",
    cheque: "Cheque",
    company_docs: "Company Documents",
    tax_certificate: "Tax Certificate",
    other: "Other Documents",
};

function DocumentCard({ doc, onDelete }) {
    const [deleteOpen, setDeleteOpen] = useState(false);
    const docIsImage = isImageFile(doc.url || "");
    const docIsPdf = isPdfFile(doc.url || "");

    const handleOpen = () => {
        if (doc.url) {
            const a = document.createElement("a");
            a.href = doc.url;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.click();
        }
    };

    return (
        <>
            <div className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm">
                {/* Icon */}
                <div
                    className={cn(
                        "shrink-0 rounded-md p-2",
                        docIsImage ? "bg-blue-100" : docIsPdf ? "bg-red-100" : "bg-muted"
                    )}
                >
                    {docIsImage ? (
                        <ImageIcon className="h-4 w-4 text-blue-600" />
                    ) : (
                        <FileText
                            className={cn("h-4 w-4", docIsPdf ? "text-red-600" : "text-muted-foreground")}
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                        {DOCUMENT_TYPES[doc.type] || doc.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {doc.uploadedAt ? formatDate(doc.uploadedAt) : "Date unknown"}
                    </p>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                    {doc.url && (
                        <Button variant="ghost" size="icon" onClick={handleOpen} title="Open document">
                            <ExternalLink className="h-4 w-4" />
                            <span className="sr-only">Open document</span>
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteOpen(true)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        title="Delete document"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete document</span>
                    </Button>
                </div>
            </div>

            {/* Image preview */}
            {docIsImage && doc.url && (
                <img
                    src={doc.url}
                    alt={DOCUMENT_TYPES[doc.type] || doc.type}
                    className="mt-1 h-24 w-full rounded-md object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={handleOpen}
                />
            )}

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete document?</DialogTitle>
                        <DialogDescription>
                            This will permanently remove the{" "}
                            <strong>{DOCUMENT_TYPES[doc.type] || doc.type}</strong> document.
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => {
                                onDelete(doc);
                                setDeleteOpen(false);
                                toast.success("Document removed");
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TenantDocuments({ formik }) {
    const [selectedType, setSelectedType] = useState("");

    const groupedDocs = (formik.values.existingDocuments || []).reduce((acc, doc) => {
        if (!acc[doc.type]) acc[doc.type] = [];
        if (Array.isArray(doc.files)) {
            doc.files.forEach((file) => acc[doc.type].push({ ...file, type: doc.type }));
        }
        return acc;
    }, {});

    const allExistingDocs = Object.values(groupedDocs).flat();

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";

        if (!selectedType) {
            toast.error("Select a document type first");
            return;
        }
        if (files.length === 0) return;

        const invalid = files.filter(
            (f) => !f.type.startsWith("image/") && f.type !== "application/pdf"
        );
        if (invalid.length > 0) {
            toast.error("Only images and PDFs are supported");
            return;
        }

        const oversized = files.filter((f) => f.size > MAX_FILE_BYTES);
        if (oversized.length > 0) {
            toast.error(`Files must be under ${formatFileSize(MAX_FILE_BYTES)} each`);
            return;
        }

        const current = formik.values.documents || {};
        formik.setFieldValue("documents", {
            ...current,
            [selectedType]: [...(current[selectedType] || []), ...files],
        });
        toast.success(`${files.length} file${files.length > 1 ? "s" : ""} added`);
    };

    const handleDeleteExisting = (doc) => {
        const updated = (formik.values.existingDocuments || []).map((group) => {
            if (group.type !== doc.type) return group;
            return { ...group, files: group.files.filter((f) => f.url !== doc.url) };
        });
        formik.setFieldValue("existingDocuments", updated);
    };

    const handleRemoveNew = (type, idx) => {
        const current = formik.values.documents || {};
        formik.setFieldValue("documents", {
            ...current,
            [type]: (current[type] || []).filter((_, i) => i !== idx),
        });
    };

    const pendingFiles = Object.entries(formik.values.documents || {}).filter(
        ([, files]) => files.length > 0
    );

    return (
        <div className="space-y-6">
            {/* Existing documents */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Current Documents
                </h3>

                {allExistingDocs.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {allExistingDocs.map((doc, idx) => (
                            <DocumentCard
                                key={`${doc.type}-${idx}`}
                                doc={doc}
                                onDelete={handleDeleteExisting}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed py-8 text-center">
                        <FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            Use the upload section below to add documents
                        </p>
                    </div>
                )}
            </div>

            {/* Upload new documents */}
            <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Upload New Documents
                </h3>

                <div className="rounded-lg border bg-card p-4 space-y-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label>Document Type</Label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select type…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(DOCUMENT_TYPES).map(([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                            {label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label>
                                Files
                                <span className="ml-1 font-normal text-muted-foreground">
                                    (images &amp; PDFs, max {formatFileSize(MAX_FILE_BYTES)} each)
                                </span>
                            </Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-start gap-2"
                                disabled={!selectedType}
                                onClick={() => document.getElementById("file-upload")?.click()}
                            >
                                <Upload className="h-4 w-4" />
                                {selectedType ? "Choose Files" : "Select a document type first"}
                            </Button>
                            <input
                                id="file-upload"
                                type="file"
                                multiple
                                accept="image/*,.pdf"
                                className="hidden"
                                onChange={handleFileSelect}
                                disabled={!selectedType}
                            />
                        </div>
                    </div>

                    {/* Pending uploads */}
                    {pendingFiles.length > 0 && (
                        <div className="space-y-2">
                            {pendingFiles.map(([type, files]) => (
                                <div
                                    key={type}
                                    className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5"
                                >
                                    <div className="mb-1.5 flex items-center justify-between">
                                        <Badge variant="outline" className="border-emerald-300 bg-emerald-100 text-emerald-700 text-xs">
                                            {DOCUMENT_TYPES[type] ?? type}
                                        </Badge>
                                        <span className="text-xs text-emerald-700">
                                            {files.length} file{files.length > 1 ? "s" : ""} pending
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {files.map((file, idx) => (
                                            <li key={idx} className="flex items-center justify-between text-xs">
                                                <span className="min-w-0 truncate text-foreground">
                                                    {file.name}
                                                </span>
                                                <span className="mx-2 shrink-0 text-muted-foreground">
                                                    {formatFileSize(file.size)}
                                                </span>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-5 w-5 shrink-0"
                                                    onClick={() => handleRemoveNew(type, idx)}
                                                >
                                                    <Trash2 className="h-3 w-3 text-destructive" />
                                                    <span className="sr-only">Remove</span>
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                            Pending files will be uploaded when you save the form. Deleted documents
                            are removed immediately on save.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TenantDocuments;
