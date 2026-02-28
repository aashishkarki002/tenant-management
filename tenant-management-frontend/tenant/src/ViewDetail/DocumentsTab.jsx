import { useState } from "react";
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
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function getFileType(url) {
  const ext = url.split(".").pop().split("?")[0].toLowerCase();
  const isPdf = ext === "pdf";
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  return { ext, isPdf, isImage };
}

function getDocLabel(type) {
  const map = {
    citizenShip: "Citizenship",
    pdfAgreement: "Lease Agreement",
    image: "Property Photos",
    bank_guarantee: "Bank Guarantee",
    company_docs: "Company Documents",
    tax_certificate: "Tax Certificate",
  };
  return map[type] ?? type;
}

function getFileName(url, docLabel, index, ext) {
  const urlParts = url.split("/");
  const raw = urlParts[urlParts.length - 1].split("?")[0];
  return raw && raw.length > 5 ? raw : `${docLabel.replace(/\s+/g, "_")}_${index + 1}.${ext}`;
}

// Flatten all files with metadata into a single list
function flattenFiles(documents = []) {
  const all = [];
  documents.forEach((doc) => {
    const label = getDocLabel(doc.type);
    doc.files?.forEach((file, i) => {
      const { ext, isPdf, isImage } = getFileType(file.url);
      all.push({
        ...file,
        docType: doc.type,
        docLabel: label,
        fileName: getFileName(file.url, label, i, ext),
        ext,
        isPdf,
        isImage,
        uploadedAtDate: new Date(file.uploadedAt),
      });
    });
  });
  return all;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function FileIcon({ isPdf, isImage, size = "md" }) {
  const cls = size === "lg" ? "w-8 h-8" : "w-5 h-5";
  if (isPdf) return <FileText className={`${cls} text-red-500`} />;
  if (isImage) return <ImageIcon className={`${cls} text-blue-500`} />;
  return <File className={`${cls} text-gray-500`} />;
}

function Thumbnail({ file }) {
  if (file.isImage) {
    return (
      <img
        src={file.url}
        alt={file.fileName}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/40">
      <FileIcon isPdf={file.isPdf} isImage={false} size="lg" />
      <span className="text-xs font-medium text-muted-foreground uppercase">{file.ext}</span>
    </div>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({ files, currentIndex, onClose, onPrev, onNext }) {
  const file = files[currentIndex];
  if (!file) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 text-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon isPdf={file.isPdf} isImage={file.isImage} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{file.fileName}</p>
            <p className="text-xs text-white/60">{file.docLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={file.url}
            download
            className="p-2 hover:bg-white/10 rounded-md transition-colors"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </a>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-auto relative">
        {files.length > 1 && (
          <>
            <button
              onClick={onPrev}
              className="absolute left-2 sm:left-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={onNext}
              className="absolute right-2 sm:right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {file.isPdf ? (
          <iframe
            src={file.url}
            className="w-full max-w-4xl h-[70vh] rounded-lg border border-white/10 bg-white"
            title="PDF Preview"
          />
        ) : file.isImage ? (
          <img
            src={file.url}
            alt={file.fileName}
            className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain"
          />
        ) : (
          <div className="text-white/60 text-center">
            <File className="w-16 h-16 mx-auto mb-3 opacity-50" />
            <p>Preview not available</p>
            <a href={file.url} download className="text-blue-400 underline text-sm mt-2 inline-block">
              Download file
            </a>
          </div>
        )}
      </div>

      {/* Counter */}
      {files.length > 1 && (
        <div className="text-center text-white/60 text-xs py-2 shrink-0">
          {currentIndex + 1} / {files.length}
        </div>
      )}
    </div>
  );
}

// ─── Grid View ───────────────────────────────────────────────────────────────

function GridView({ files, onOpenLightbox }) {
  return (
    <div className="p-4 sm:p-6">
      {files.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
          {files.map((file, i) => (
            <div
              key={file._id}
              onClick={() => onOpenLightbox(i)}
              className="group cursor-pointer rounded-xl border border-border overflow-hidden bg-background hover:border-primary hover:shadow-md transition-all"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted relative">
                <Thumbnail file={file} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-medium truncate">{file.fileName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{file.docLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {file.uploadedAtDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────

function TimelineView({ files, onOpenLightbox }) {
  if (files.length === 0) return <div className="p-4"><EmptyState /></div>;

  // Sort by upload date ascending
  const sorted = [...files].sort((a, b) => a.uploadedAtDate - b.uploadedAtDate);

  // Group by doc type to show category badges
  const groups = sorted.reduce((acc, file) => {
    const dateKey = file.uploadedAtDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(file);
    return acc;
  }, {});

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-3.5 top-2 bottom-2 w-px bg-border" />

        <div className="space-y-6">
          {Object.entries(groups).map(([dateKey, groupFiles]) => (
            <div key={dateKey}>
              {/* Date label */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0 z-10">
                  <Clock className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {dateKey}
                </span>
              </div>

              {/* Files for this date */}
              <div className="ml-10 space-y-2">
                {groupFiles.map((file) => {
                  const globalIndex = sorted.findIndex((f) => f._id === file._id);
                  return (
                    <div
                      key={file._id}
                      onClick={() => onOpenLightbox(globalIndex)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:border-primary hover:bg-accent/50 cursor-pointer transition-all group"
                    >
                      {/* Thumbnail preview for images */}
                      {file.isImage ? (
                        <img
                          src={file.url}
                          alt={file.fileName}
                          className="w-12 h-12 rounded-md object-cover border border-border shrink-0"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center border border-border shrink-0">
                          <FileIcon isPdf={file.isPdf} isImage={false} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.fileName}</p>
                        <span className="inline-block text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 mt-1">
                          {file.docLabel}
                        </span>
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar+Preview View (default) ──────────────────────────────────────────

function SidebarPreviewView({ files, selectedFile, onSelectFile }) {
  return (
    <div className="flex flex-col md:flex-row h-[400px] sm:h-[500px] md:h-[600px] border-t">
      {/* Sidebar */}
      <div className="w-full md:w-1/3 border-r border-b md:border-b-0 bg-background overflow-y-auto">
        <div className="p-4 space-y-2">
          {files.length === 0 ? (
            <EmptyState />
          ) : (
            files.map((file, i) => {
              const isSelected = selectedFile?._id === file._id;
              return (
                <div
                  key={file._id}
                  onClick={() => onSelectFile(file)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent ${isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background"
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 mt-1">
                      <FileIcon isPdf={file.isPdf} isImage={file.isImage} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.fileName}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {file.uploadedAtDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">{file.docLabel}</p>
                    </div>
                    <Eye className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Preview pane */}
      <div className="flex-1 bg-background flex flex-col min-h-[300px] md:min-h-0">
        {selectedFile ? (
          <>
            <div className="border-b p-2 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-muted/30">
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide truncate">
                {selectedFile.fileName.length > 24
                  ? selectedFile.fileName.substring(0, 24) + "…"
                  : selectedFile.fileName}
              </h3>
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-background rounded border">
                  <ZoomOut className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="text-xs font-medium">100%</span>
                  <ZoomIn className="w-3 h-3 sm:w-4 sm:h-4" />
                </div>
                <button className="p-1.5 sm:p-2 hover:bg-accent rounded-md transition-colors" title="Print">
                  <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>
                <button className="p-1.5 sm:p-2 hover:bg-accent rounded-md transition-colors" title="Share">
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
              {selectedFile.isPdf ? (
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
              <p className="text-base sm:text-lg font-medium">Select a document to preview</p>
              <p className="text-xs sm:text-sm mt-2">Click any document from the list</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <File className="w-12 h-12 mx-auto mb-2 opacity-50" />
      <p>No documents available</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DocumentsTab({ tenant, viewMode, onViewModeChange }) {
  const files = flattenFiles(tenant?.documents);

  // Sidebar view state
  const [sidebarSelected, setSidebarSelected] = useState(null);

  // Lightbox state (used by grid + timeline)
  const [lightboxIndex, setLightboxIndex] = useState(null);

  const openLightbox = (index) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);
  const prevLightbox = () => setLightboxIndex((i) => (i - 1 + files.length) % files.length);
  const nextLightbox = () => setLightboxIndex((i) => (i + 1) % files.length);

  return (
    <>
      <Card className="border border-border shadow-sm rounded-xl bg-gray-50">
        <CardHeader className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5" />
              <CardTitle className="text-lg sm:text-xl">Documents & Verification</CardTitle>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 ml-1">
                {files.length}
              </span>
            </div>
            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg">
              {[
                { key: "list", label: "List" },
                { key: "grid", label: "Grid" },
                { key: "timeline", label: "Timeline" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => onViewModeChange(key)}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-md transition-colors font-medium ${viewMode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {viewMode === "grid" && (
            <GridView files={files} onOpenLightbox={openLightbox} />
          )}
          {viewMode === "timeline" && (
            <TimelineView files={files} onOpenLightbox={openLightbox} />
          )}
          {viewMode === "list" && (
            <SidebarPreviewView
              files={files}
              selectedFile={sidebarSelected}
              onSelectFile={setSidebarSelected}
            />
          )}
        </CardContent>
      </Card>

      {/* Lightbox portal */}
      {lightboxIndex !== null && (
        <Lightbox
          files={files}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onPrev={prevLightbox}
          onNext={nextLightbox}
        />
      )}
    </>
  );
}