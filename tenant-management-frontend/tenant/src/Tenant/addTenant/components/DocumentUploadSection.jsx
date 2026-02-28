/**
 * DocumentUploadSection.jsx  (UX REDESIGN)
 *
 * PROBLEM SOLVED:
 *   Previously the user had to:
 *     1. Open a dropdown → select a document type
 *     2. Click file input → upload files
 *     3. Repeat the entire cycle for every document type
 *
 *   This created friction and confusion — especially when uploading multiple
 *   document types in one session.
 *
 * SOLUTION:
 *   Render all document types as persistent "drop zones" simultaneously.
 *   Each zone has its own independent file input, drag-and-drop area, and
 *   uploaded-file list. No selection step needed — the user just drops or
 *   clicks the zone they want.
 *
 *   The formik shape is unchanged: documents[type] = File[]
 *   formik.values.documentType is still updated for backward compatibility
 *   but no longer drives the UI.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { XIcon, UploadCloudIcon, FileTextIcon, ImageIcon, BuildingIcon, ReceiptIcon, ShieldIcon } from "lucide-react";
import { toast } from "sonner";
import { DOCUMENT_TYPES } from "../constants/tenant.constant";

// ── Zone configuration ───────────────────────────────────────────────────────
const DOCUMENT_ZONES = [
    {
        type: DOCUMENT_TYPES.CITIZENSHIP,
        label: "Citizenship",
        description: "ID card, passport, or citizenship certificate",
        accept: "image/*,application/pdf",
        icon: ShieldIcon,
        color: "blue",
    },
    {
        type: DOCUMENT_TYPES.AGREEMENT,
        label: "Lease Agreement",
        description: "Signed lease or rental agreement document",
        accept: "application/pdf,image/*",
        icon: FileTextIcon,
        color: "purple",
    },
    {
        type: DOCUMENT_TYPES.PHOTO,
        label: "Photo",
        description: "Tenant's recent passport-size or profile photo",
        accept: "image/*",
        icon: ImageIcon,
        color: "green",
    },
    {
        type: DOCUMENT_TYPES.COMPANY_DOCUMENT,
        label: "Company Document",
        description: "PAN certificate, company registration, or MOA",
        accept: "application/pdf,image/*",
        icon: BuildingIcon,
        color: "orange",
    },
    {
        type: DOCUMENT_TYPES.TDS,
        label: "TDS Certificate",
        description: "Tax deduction at source certificate",
        accept: "application/pdf,image/*",
        icon: ReceiptIcon,
        color: "red",
    },
];

// Color variants for each zone
const COLOR_MAP = {
    blue: { border: "border-blue-200", bg: "bg-blue-50", icon: "text-blue-500", badge: "bg-blue-100 text-blue-700", hover: "hover:border-blue-400 hover:bg-blue-100", drag: "border-blue-400 bg-blue-100" },
    purple: { border: "border-purple-200", bg: "bg-purple-50", icon: "text-purple-500", badge: "bg-purple-100 text-purple-700", hover: "hover:border-purple-400 hover:bg-purple-100", drag: "border-purple-400 bg-purple-100" },
    green: { border: "border-green-200", bg: "bg-green-50", icon: "text-green-500", badge: "bg-green-100 text-green-700", hover: "hover:border-green-400 hover:bg-green-100", drag: "border-green-400 bg-green-100" },
    orange: { border: "border-orange-200", bg: "bg-orange-50", icon: "text-orange-500", badge: "bg-orange-100 text-orange-700", hover: "hover:border-orange-400 hover:bg-orange-100", drag: "border-orange-400 bg-orange-100" },
    red: { border: "border-red-200", bg: "bg-red-50", icon: "text-red-500", badge: "bg-red-100 text-red-700", hover: "hover:border-red-400 hover:bg-red-100", drag: "border-red-400 bg-red-100" },
};

// ── Single upload zone ───────────────────────────────────────────────────────
function UploadZone({ zone, files = [], onAdd, onRemove }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const colors = COLOR_MAP[zone.color];
    const Icon = zone.icon;

    const processFiles = (newFiles) => {
        if (!newFiles.length) return;
        onAdd(zone.type, newFiles);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    };

    const hasFiles = files.length > 0;

    return (
        <div className="space-y-2">
            {/* Drop zone */}
            <div
                className={[
                    "relative border-2 border-dashed rounded-xl transition-all duration-200 cursor-pointer",
                    colors.border,
                    isDragging ? colors.drag : `${colors.bg} ${colors.hover}`,
                ].join(" ")}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={zone.accept}
                    className="hidden"
                    onChange={(e) => {
                        processFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                    }}
                />

                <div className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${colors.bg} border ${colors.border}`}>
                        <Icon className={`w-4 h-4 ${colors.icon}`} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-gray-800">{zone.label}</span>
                            {hasFiles && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>
                                    {files.length} file{files.length > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{zone.description}</p>
                    </div>

                    {/* Upload button */}
                    <div className={`shrink-0 flex items-center gap-1.5 text-xs font-medium ${colors.icon} opacity-70`}>
                        <UploadCloudIcon className="w-4 h-4" />
                        <span className="hidden sm:inline">{hasFiles ? "Add more" : "Upload"}</span>
                    </div>
                </div>
            </div>

            {/* Uploaded files list */}
            {hasFiles && (
                <ul className="space-y-1 pl-1">
                    {files.map((file, i) => (
                        <li
                            key={i}
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-100 rounded-lg shadow-sm group"
                        >
                            <FileTextIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="flex-1 text-xs text-gray-700 truncate">{file.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">
                                {(file.size / 1024).toFixed(0)} KB
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onRemove(zone.type, i); }}
                                className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                            >
                                <XIcon className="w-3 h-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

// ── Main export ──────────────────────────────────────────────────────────────
export const DocumentUploadSection = ({ formik }) => {
    const handleAdd = (type, newFiles) => {
        const current = formik.values.documents?.[type] || [];
        formik.setFieldValue("documents", {
            ...formik.values.documents,
            [type]: [...current, ...newFiles],
        });
        // Keep documentType in sync for backward compat
        formik.setFieldValue("documentType", type);
    };

    const handleRemove = (type, index) => {
        const files = formik.values.documents?.[type] || [];
        const updated = files.filter((_, i) => i !== index);

        if (updated.length === 0) {
            const next = { ...formik.values.documents };
            delete next[type];
            formik.setFieldValue("documents", next);
        } else {
            formik.setFieldValue("documents", {
                ...formik.values.documents,
                [type]: updated,
            });
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
                <div>
                    <p className="text-sm font-semibold text-gray-800">Upload Documents</p>
                    <p className="text-xs text-gray-500">Click or drag files into any section below</p>
                </div>
                {/* Total uploaded count badge */}
                {(() => {
                    const total = Object.values(formik.values.documents || {}).reduce((s, f) => s + f.length, 0);
                    return total > 0 ? (
                        <span className="text-xs bg-gray-900 text-white px-2.5 py-1 rounded-full font-medium">
                            {total} total
                        </span>
                    ) : null;
                })()}
            </div>

            {DOCUMENT_ZONES.map((zone) => (
                <UploadZone
                    key={zone.type}
                    zone={zone}
                    files={formik.values.documents?.[zone.type] || []}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                />
            ))}
        </div>
    );
};