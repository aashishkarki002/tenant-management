import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2Icon } from "lucide-react";
import { DocumentUploadSection } from "./DocumentUploadSection";
import { SubmissionProgressOverlay } from "./SubmissionProgressOverlay";
import { DOCUMENT_TYPES } from "../constants/tenant.constant";

// Which document types are required vs optional
const REQUIRED_DOCUMENT_TYPES = new Set([
    DOCUMENT_TYPES.CITIZENSHIP,
    DOCUMENT_TYPES.AGREEMENT,
]);

export const DocumentsTab = ({ formik, isLoading, submissionProgress, onPrevious, onClose }) => {
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
      

                <DocumentUploadSection
                    formik={formik}
                    requiredTypes={REQUIRED_DOCUMENT_TYPES}
                />

                {isLoading && submissionProgress?.phase !== "idle" ? (
                    <SubmissionProgressOverlay progress={submissionProgress} />
                ) : (
                    <div className="flex gap-3">
                        <Button type="button" variant="outline" onClick={onPrevious}>
                            Previous
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-primary hover:bg-primary/90"
                            disabled={isLoading}
                        >
                            Save & Register
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
                )}
            </CardContent>
        </Card>
    );
};