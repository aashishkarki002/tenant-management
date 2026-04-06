import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle2Icon } from "lucide-react";
import { DocumentUploadSection } from "./DocumentUploadSection";
import { DOCUMENT_TYPES } from "../constants/tenant.constant";

// Which document types are required vs optional
const REQUIRED_DOCUMENT_TYPES = new Set([
    DOCUMENT_TYPES.CITIZENSHIP,
    DOCUMENT_TYPES.AGREEMENT,
]);

export const DocumentsTab = ({ formik, isLoading, onPrevious, onClose }) => {
    const documents = formik.values.documents || {};

    const requiredUploaded = [...REQUIRED_DOCUMENT_TYPES].filter(
        (type) => documents[type]?.length > 0
    ).length;

    const totalRequired = REQUIRED_DOCUMENT_TYPES.size;
    const allRequiredDone = requiredUploaded === totalRequired;

    return (
        <Card className="shadow-sm">
            <CardContent className="p-6 space-y-5">

                {/* Completion status bar */}
                <div className={[
                    "flex items-center justify-between rounded-lg px-4 py-3 border",
                    allRequiredDone
                        ? "bg-green-50 border-green-200"
                        : "bg-amber-50 border-amber-200",
                ].join(" ")}>
                    <div className="flex items-center gap-2">
                        {allRequiredDone ? (
                            <CheckCircle2Icon className="w-4 h-4 text-green-600 shrink-0" />
                        ) : (
                            <span className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
                        )}
                        <p className={`text-sm font-medium ${allRequiredDone ? "text-green-700" : "text-amber-700"}`}>
                            {allRequiredDone
                                ? "All required documents uploaded"
                                : `${requiredUploaded} of ${totalRequired} required documents uploaded`}
                        </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${allRequiredDone ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        }`}>
                        {allRequiredDone ? "Ready" : "Incomplete"}
                    </span>
                </div>

                <DocumentUploadSection
                    formik={formik}
                    requiredTypes={REQUIRED_DOCUMENT_TYPES}
                />

                <div className="flex gap-3">
                    <Button type="button" variant="outline" onClick={onPrevious}>
                        Previous
                    </Button>
                    <Button
                        type="submit"
                        className="flex-1 bg-primary hover:bg-primary/90"
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner /> : "Save & Register"}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};