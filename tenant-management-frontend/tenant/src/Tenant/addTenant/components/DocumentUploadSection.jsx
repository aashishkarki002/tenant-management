import { useRef, useState } from "react";
import { XIcon, UploadCloudIcon, FileTextIcon, ImageIcon, BuildingIcon, ReceiptIcon, ShieldIcon } from "lucide-react";
import { DOCUMENT_TYPES } from "../constants/tenant.constant";

const DOCUMENT_ZONES = [
    {
        type: DOCUMENT_TYPES.CITIZENSHIP,
        label: "Citizenship",
        description: "ID card, passport, or citizenship certificate",
        accept: "image/*,application/pdf",
        icon: ShieldIcon,
    },
    {
        type: DOCUMENT_TYPES.AGREEMENT,
        label: "Lease Agreement",
        description: "Signed lease or rental agreement document",
        accept: "application/pdf,image/*",
        icon: FileTextIcon,
    },
    {
        type: DOCUMENT_TYPES.PHOTO,
        label: "Photo",
        description: "Tenant's recent passport-size or profile photo",
        accept: "image/*",
        icon: ImageIcon,
    },
    {
        type: DOCUMENT_TYPES.COMPANY_DOCUMENT,
        label: "Company Document",
        description: "PAN certificate, company registration, or MOA",
        accept: "application/pdf,image/*",
        icon: BuildingIcon,
    },
    {
        type: DOCUMENT_TYPES.TDS,
        label: "TDS Certificate",
        description: "Tax deduction at source certificate",
        accept: "application/pdf,image/*",
        icon: ReceiptIcon,
    },
];

function UploadZone({ zone, files = [], onAdd, onRemove, isRequired }) {
    const inputRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const Icon = zone.icon;
    const hasFiles = files.length > 0;

    const processFiles = (newFiles) => {
        if (!newFiles.length) return;
        onAdd(zone.type, newFiles);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        processFiles(Array.from(e.dataTransfer.files));
    };

    return (
        <div style={{ borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            {/* Drop trigger row */}
            <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "11px 14px",
                    background: isDragging ? "var(--color-accent-light)" : "var(--color-surface-raised)",
                    border: `1px solid ${isDragging ? "var(--color-accent)" : "var(--color-border)"}`,
                    borderStyle: isDragging ? "dashed" : "solid",
                    borderRadius: hasFiles ? "var(--radius-md) var(--radius-md) 0 0" : "var(--radius-md)",
                    cursor: "pointer",
                    transition: "border-color 0.15s, background 0.15s",
                    userSelect: "none",
                }}
                onMouseOver={(e) => {
                    if (!isDragging) e.currentTarget.style.borderColor = "var(--color-muted-fill)";
                }}
                onMouseOut={(e) => {
                    if (!isDragging) e.currentTarget.style.borderColor = "var(--color-border)";
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept={zone.accept}
                    style={{ display: "none" }}
                    onChange={(e) => {
                        processFiles(Array.from(e.target.files || []));
                        e.target.value = "";
                    }}
                />

                {/* Icon pill */}
                <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                }}>
                    <Icon size={14} color="var(--color-text-sub)" />
                </div>

                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "1px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)" }}>
                            {zone.label}
                        </span>

                        {/* Required / Optional badge */}
                        <span style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            color: isRequired ? "var(--color-danger)" : "var(--color-text-weak)",
                            background: isRequired ? "var(--color-danger-bg)" : "var(--color-surface)",
                            border: `1px solid ${isRequired ? "var(--color-danger-border)" : "var(--color-border)"}`,
                        }}>
                            {isRequired ? "Required" : "Optional"}
                        </span>

                        {/* File count pill */}
                        {hasFiles && (
                            <span style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                color: "var(--color-accent)",
                                background: "var(--color-accent-light)",
                                border: "1px solid var(--color-accent-mid)",
                                padding: "1px 7px",
                                borderRadius: "20px",
                            }}>
                                {files.length} {files.length > 1 ? "files" : "file"}
                            </span>
                        )}
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--color-text-weak)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {zone.description}
                    </div>
                </div>

                {/* Upload action hint */}
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "var(--color-text-weak)",
                    flexShrink: 0,
                }}>
                    <UploadCloudIcon size={12} />
                    <span>{hasFiles ? "Add more" : "Upload"}</span>
                </div>
            </div>

            {/* File list — expands beneath trigger */}
            {hasFiles && (
                <div>
                    {files.map((file, i) => (
                        <div
                            key={i}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 14px",
                                background: "var(--color-surface)",
                                border: "1px solid var(--color-border)",
                                borderTop: "none",
                                borderRadius: i === files.length - 1 ? "0 0 var(--radius-md) var(--radius-md)" : "0",
                                fontSize: "12px",
                                color: "var(--color-text-body)",
                            }}
                            className="file-item-row"
                        >
                            <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "var(--color-muted-fill)", flexShrink: 0 }} />
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {file.name}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--color-text-weak)", flexShrink: 0 }}>
                                {(file.size / 1024).toFixed(0)} KB
                            </span>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onRemove(zone.type, i); }}
                                style={{
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "4px",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "var(--color-text-weak)",
                                    flexShrink: 0,
                                    padding: 0,
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.background = "var(--color-danger-bg)";
                                    e.currentTarget.style.color = "var(--color-danger)";
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.background = "none";
                                    e.currentTarget.style.color = "var(--color-text-weak)";
                                }}
                            >
                                <XIcon size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export const DocumentUploadSection = ({ formik, requiredTypes = new Set() }) => {
    const handleAdd = (type, newFiles) => {
        const current = formik.values.documents?.[type] || [];
        formik.setFieldValue("documents", {
            ...formik.values.documents,
            [type]: [...current, ...newFiles],
        });
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

    const total = Object.values(formik.values.documents || {}).reduce((s, f) => s + f.length, 0);
    const allRequiredMet = DOCUMENT_ZONES
        .filter((z) => requiredTypes.has(z.type))
        .every((z) => (formik.values.documents?.[z.type] || []).length > 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Status bar */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 14px",
                borderRadius: "var(--radius-md)",
                background: allRequiredMet ? "var(--color-success-bg)" : "var(--color-surface)",
                border: `1px solid ${allRequiredMet ? "var(--color-success-border)" : "var(--color-border)"}`,
                transition: "background 0.3s, border-color 0.3s",
            }}>
                <div style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: allRequiredMet ? "var(--color-success)" : "var(--color-muted-fill)",
                    transition: "background 0.3s",
                }} />
                <span style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: allRequiredMet ? "var(--color-success)" : "var(--color-text-sub)",
                    transition: "color 0.3s",
                }}>
                    {allRequiredMet
                        ? "All required documents uploaded"
                        : `${DOCUMENT_ZONES.filter((z) => requiredTypes.has(z.type) && !(formik.values.documents?.[z.type] || []).length).length} required document(s) needed`}
                </span>
                {allRequiredMet && (
                    <span style={{
                        marginLeft: "auto",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--color-success)",
                    }}>
                        Ready
                    </span>
                )}
            </div>

            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-strong)", margin: 0 }}>
                        Upload Documents
                    </p>
                    <p style={{ fontSize: "11px", color: "var(--color-text-weak)", margin: "2px 0 0" }}>
                        Click or drag files into any section · Max 10 MB per file · PDF or image
                    </p>
                </div>
                {total > 0 && (
                    <span style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        background: "var(--color-text-strong)",
                        color: "var(--color-bg)",
                        padding: "3px 10px",
                        borderRadius: "20px",
                    }}>
                        {total} total
                    </span>
                )}
            </div>

            {/* Zone list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {DOCUMENT_ZONES.map((zone) => (
                    <UploadZone
                        key={zone.type}
                        zone={zone}
                        files={formik.values.documents?.[zone.type] || []}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        isRequired={requiredTypes.has(zone.type)}
                    />
                ))}
            </div>
        </div>
    );
};