import { useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";

export default function DragDropFileUpload({
    value,
    onChange,
    label = "Upload File",
    maxSizeMB = 5,
    acceptedTypes = ["image/jpeg", "image/png", "application/pdf"],
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);

    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    const validateFile = (file) => {
        if (!acceptedTypes.includes(file.type)) {
            setError("Invalid file type.");
            return false;
        }

        if (file.size > maxSizeBytes) {
            setError(`File must be smaller than ${maxSizeMB}MB.`);
            return false;
        }

        setError(null);
        return true;
    };

    const handleFile = (file) => {
        if (validateFile(file)) {
            onChange(file);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files?.[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const isImage = value?.type.startsWith("image/");

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium">{label}</label>

            {/* Upload Box */}
            {!value && (
                <div
                    onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer
            ${isDragging
                            ? "border-primary bg-primary/5"
                            : "border-muted-foreground/25 hover:border-primary/50"
                        }`}
                >
                    <input
                        type="file"
                        accept={acceptedTypes.join(",")}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => {
                            if (e.target.files?.[0]) {
                                handleFile(e.target.files[0]);
                            }
                        }}
                    />

                    <UploadCloud className="w-10 h-10 text-muted-foreground mb-3" />

                    <p className="text-sm font-medium">
                        Drag & drop file here
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Max size: {maxSizeMB}MB
                    </p>
                </div>
            )}

            {/* Preview */}
            {value && (
                <div className="relative rounded-xl border bg-muted/40 p-4">
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="absolute top-2 right-2 text-muted-foreground hover:text-red-500"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {isImage ? (
                        <img
                            src={URL.createObjectURL(value)}
                            alt="preview"
                            className="max-h-48 rounded-lg mx-auto object-contain"
                        />
                    ) : (
                        <div className="flex items-center justify-center gap-2">
                            <FileText className="w-6 h-6 text-primary" />
                            <span className="text-sm truncate">{value.name}</span>
                        </div>
                    )}
                </div>
            )}

            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}
        </div>
    );
}
