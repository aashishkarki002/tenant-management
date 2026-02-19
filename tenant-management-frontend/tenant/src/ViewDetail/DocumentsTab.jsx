import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  FileText,
  File,
  Image as ImageIcon,
  Eye,
  Download,
  Printer,
  Share2,
  ZoomIn,
  ZoomOut,
  FolderOpen,
} from "lucide-react";

export function DocumentsTab({
  tenant,
  viewMode,
  onViewModeChange,
  selectedDocument,
  selectedFile,
  onSelectFile,
}) {
  return (
    <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
      <CardHeader className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
            <CardTitle className="text-lg sm:text-xl">
              Documents & Verification
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onViewModeChange("grid")}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Grid View
            </button>
            <button
              onClick={() => onViewModeChange("timeline")}
              className={`px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors ${
                viewMode === "timeline"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Timeline
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row h-[400px] sm:h-[500px] md:h-[600px] border-t">
          <div className="w-full md:w-1/3 border-r border-b md:border-b-0 bg-background overflow-y-auto">
            <div className="p-4 space-y-2">
              {tenant?.documents?.length > 0 ? (
                tenant.documents.map((document) =>
                  document.files?.map((file, fileIndex) => {
                    const isSelected = selectedFile?._id === file._id;
                    const fileType = file.url.split(".").pop().toLowerCase();
                    const isPdf = fileType === "pdf";
                    const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(fileType);
                    const documentTypeLabel =
                      document.type === "citizenShip"
                        ? "Citizenship"
                        : document.type === "pdfAgreement"
                          ? "Lease Agreement"
                          : document.type === "image"
                            ? "Property Photos"
                            : document.type === "bank_guarantee"
                              ? "Bank Guarantee"
                              : document.type;
                    const urlParts = file.url.split("/");
                    const urlFileName = urlParts[urlParts.length - 1].split("?")[0];
                    const fileName =
                      urlFileName && urlFileName.length > 5
                        ? urlFileName
                        : `${documentTypeLabel.replace(/\s+/g, "_")}_${fileIndex + 1}.${fileType}`;

                    return (
                      <div
                        key={file._id}
                        onClick={() => onSelectFile(document, file)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-background"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {isPdf ? (
                              <FileText className="w-5 h-5 text-red-600" />
                            ) : isImage ? (
                              <ImageIcon className="w-5 h-5 text-blue-600" />
                            ) : (
                              <File className="w-5 h-5 text-gray-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{fileName}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Uploaded:{" "}
                              {new Date(file.uploadedAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {documentTypeLabel}
                            </p>
                          </div>
                          <Eye className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No documents available</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 bg-background flex flex-col min-h-[300px] md:min-h-0">
            {selectedFile ? (
              <>
                <div className="border-b p-2 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide truncate">
                      Preview{" "}
                      {(() => {
                        const urlParts = selectedFile.url.split("/");
                        const fileName = urlParts[urlParts.length - 1].split("?")[0];
                        return fileName.length > 20
                          ? fileName.substring(0, 20) + "..."
                          : fileName;
                      })().toUpperCase()}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2">
                    <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-background rounded border">
                      <ZoomOut className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span className="text-xs font-medium">100%</span>
                      <ZoomIn className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <button
                      className="p-1.5 sm:p-2 hover:bg-accent rounded-md transition-colors"
                      title="Print"
                    >
                      <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      className="p-1.5 sm:p-2 hover:bg-accent rounded-md transition-colors"
                      title="Share"
                    >
                      <Share2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <a
                      href={selectedFile.url}
                      download
                      className="p-1.5 sm:p-2 hover:bg-accent rounded-md transition-colors"
                      title="Download"
                    >
                      <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                    </a>
                  </div>
                </div>

                <div className="flex-1 overflow-auto bg-gray-100 p-2 sm:p-4 md:p-8 flex items-center justify-center">
                  {selectedFile.url.split(".").pop().toLowerCase() === "pdf" ? (
                    <iframe
                      src={selectedFile.url}
                      className="w-full h-full min-h-[300px] sm:min-h-[400px] md:min-h-[500px] border border-border rounded-lg shadow-lg bg-white"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="max-w-4xl w-full">
                      <img
                        src={selectedFile.url}
                        alt="Document preview"
                        className="w-full h-auto rounded-lg border border-border shadow-lg bg-white"
                      />
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-4">
                <div className="text-center">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-base sm:text-lg font-medium">
                    Select a document to preview
                  </p>
                  <p className="text-xs sm:text-sm mt-2">
                    Click on any document from the list to view it here
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
