/**
 * TENANT DOCUMENTS COMPONENT
 * 
 * Features:
 * - View existing documents with preview
 * - Upload new documents
 * - Delete documents with confirmation
 * - Organized by document type
 * - File type validation
 */

import { useState } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
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

// Document type labels
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

// Document card component
function DocumentCard({ doc, onDelete, onPreview }) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDelete = () => {
        setDeleteDialogOpen(true);
    };

    const confirmDelete = () => {
        onDelete(doc);
        setDeleteDialogOpen(false);
        toast.success("Document deleted");
    };

    const isPdf = doc.url?.toLowerCase().includes(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.url || "");

    return (
        <>
            <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div
                            className={cn(
                                "p-2 rounded-lg",
                                isPdf ? "bg-red-100" : isImage ? "bg-blue-100" : "bg-gray-100"
                            )}
                        >
                            {isImage ? (
                                <ImageIcon className="h-5 w-5 text-blue-600" />
                            ) : (
                                <FileText
                                    className={cn(
                                        "h-5 w-5",
                                        isPdf ? "text-red-600" : "text-gray-600"
                                    )}
                                />
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-medium truncate">
                                        {DOCUMENT_TYPES[doc.type] || doc.type}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Uploaded:{" "}
                                        {new Date(doc.uploadedAt || Date.now()).toLocaleDateString()}
                                    </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    {doc.url && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(doc.url, "_blank")}
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleDelete}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Preview for images */}
                            {isImage && doc.url && (
                                <div className="mt-2">
                                    <img
                                        src={doc.url}
                                        alt={doc.type}
                                        className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => onPreview(doc.url)}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Document</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this document? This action cannot be
                            undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function TenantDocuments({ formik, tenantId }) {
    const [selectedType, setSelectedType] = useState("");
    const [previewUrl, setPreviewUrl] = useState(null);

    // Group existing documents by type
    const groupedDocs = (formik.values.existingDocuments || []).reduce(
        (acc, doc) => {
            if (!acc[doc.type]) acc[doc.type] = [];
            if (doc.files && Array.isArray(doc.files)) {
                doc.files.forEach((file) => {
                    acc[doc.type].push({
                        ...file,
                        type: doc.type,
                    });
                });
            }
            return acc;
        },
        {}
    );

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files || []);

        if (!selectedType) {
            toast.error("Please select a document type first");
            return;
        }

        if (files.length === 0) return;

        // Validate file types
        const invalidFiles = files.filter(
            (file) =>
                !file.type.startsWith("image/") && file.type !== "application/pdf"
        );

        if (invalidFiles.length > 0) {
            toast.error("Only images and PDFs are allowed");
            return;
        }

        // Add to formik state
        const currentDocs = formik.values.documents || {};
        const currentTypeFiles = currentDocs[selectedType] || [];

        formik.setFieldValue("documents", {
            ...currentDocs,
            [selectedType]: [...currentTypeFiles, ...files],
        });

        toast.success(`${files.length} file(s) added`);
        e.target.value = ""; // Reset input
    };

    const handleDeleteExisting = (doc) => {
        // Remove from existing documents
        const updated = formik.values.existingDocuments.map((docGroup) => {
            if (docGroup.type === doc.type) {
                return {
                    ...docGroup,
                    files: docGroup.files.filter((f) => f.url !== doc.url),
                };
            }
            return docGroup;
        });

        formik.setFieldValue("existingDocuments", updated);
    };

    const handleDeleteNew = (type, fileIndex) => {
        const currentDocs = formik.values.documents || {};
        const currentTypeFiles = currentDocs[type] || [];

        formik.setFieldValue("documents", {
            ...currentDocs,
            [type]: currentTypeFiles.filter((_, i) => i !== fileIndex),
        });

        toast.success("File removed");
    };

    return (
        <div className="space-y-6">
            {/* Existing Documents */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    Current Documents
                </h3>

                {Object.keys(groupedDocs).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(groupedDocs).map(([type, docs]) =>
                            docs.map((doc, idx) => (
                                <DocumentCard
                                    key={`${type}-${idx}`}
                                    doc={doc}
                                    onDelete={handleDeleteExisting}
                                    onPreview={setPreviewUrl}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <Card className="border-dashed">
                        <CardContent className="p-6 text-center text-muted-foreground">
                            <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                            <p>No documents uploaded yet</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Upload New Documents */}
            <div className="space-y-4">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase">
                    Upload New Documents
                </h3>

                <Card>
                    <CardContent className="p-6 space-y-4">
                        {/* Document Type Selector */}
                        <div className="space-y-2">
                            <Label>Document Type</Label>
                            <Select value={selectedType} onValueChange={setSelectedType}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select document type" />
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

                        {/* File Upload */}
                        <div className="space-y-2">
                            <Label>Choose Files</Label>
                            <div className="flex items-center gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        document.getElementById("file-upload")?.click()
                                    }
                                    disabled={!selectedType}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Select Files
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
                                <span className="text-sm text-muted-foreground">
                                    Images and PDFs only
                                </span>
                            </div>
                        </div>

                        {/* Show newly selected files */}
                        {formik.values.documents &&
                            Object.entries(formik.values.documents).map(([type, files]) =>
                                files.length > 0 ? (
                                    <div
                                        key={type}
                                        className="p-3 bg-green-50 rounded-lg border border-green-200"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <Badge variant="secondary" className="bg-green-100">
                                                {DOCUMENT_TYPES[type]}
                                            </Badge>
                                            <span className="text-sm text-green-700">
                                                {files.length} file(s) ready to upload
                                            </span>
                                        </div>
                                        <ul className="space-y-1">
                                            {files.map((file, idx) => (
                                                <li
                                                    key={idx}
                                                    className="flex items-center justify-between text-sm"
                                                >
                                                    <span className="truncate flex-1">{file.name}</span>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDeleteNew(type, idx)}
                                                        className="ml-2"
                                                    >
                                                        <Trash2 className="h-3 w-3 text-red-600" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ) : null
                            )}

                        {/* Info */}
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4 mt-0.5" />
                            <p>
                                New documents will be uploaded when you save the form. You can upload
                                multiple files at once.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Image Preview Dialog */}
            {previewUrl && (
                <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
                    <DialogContent className="max-w-3xl">
                        <DialogHeader>
                            <DialogTitle>Document Preview</DialogTitle>
                        </DialogHeader>
                        <div className="mt-4">
                            <img
                                src={previewUrl}
                                alt="Document preview"
                                className="w-full h-auto rounded-lg"
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}

export default TenantDocuments;