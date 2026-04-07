import { useState, useEffect, useRef } from "react";
import { Flag, Wrench, X, ImagePlus, Trash2 } from "lucide-react";

export function IssueDialog({ item, onConfirm, onCancel }) {
    const [description, setDescription] = useState(item.notes ?? "");
    const [images, setImages] = useState(item.images ?? []);
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        document.body.style.overflow = "hidden";
        const t = setTimeout(() => textareaRef.current?.focus(), 150);
        return () => { document.body.style.overflow = ""; clearTimeout(t); };
    }, []);

    function handleImageSelect(e) {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        const remaining = 5 - images.length;
        files.slice(0, remaining).forEach((file) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setImages((prev) => [
                    ...prev,
                    {
                        dataUrl: ev.target.result,
                        name: file.name,
                        file,
                    },
                ]);
            };
            reader.readAsDataURL(file);
        });
        e.target.value = "";
    }

    function removeImage(index) {
        setImages((prev) => prev.filter((_, i) => i !== index));
    }

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
            <div
                className="bg-[var(--color-surface)] rounded-t-3xl flex flex-col overflow-hidden"
                style={{ maxHeight: "90dvh", animation: "slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1) both" }}
            >
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                    <div className="w-12 h-1.5 rounded-full bg-[var(--color-border)]" />
                </div>
                <div className="px-5 pb-4 pt-2 flex items-start gap-3 shrink-0 border-b border-[var(--color-border)]">
                    <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                        <Flag className="w-6 h-6 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-base font-bold text-[var(--color-text-strong)]">Report an Issue</p>
                        <p className="text-sm text-[var(--color-text-sub)] mt-0.5 line-clamp-2">{item.label}</p>
                    </div>
                    <button onClick={onCancel} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--color-surface-raised)] hover:bg-[var(--color-muted)] transition-colors">
                        <X className="w-5 h-5 text-[var(--color-text-sub)]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-[var(--color-text-body)] mb-2">
                            What is the problem? <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. 2 bulbs fused in right corridor"
                            rows={4}
                            className="w-full text-base rounded-2xl px-4 py-3 resize-none border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] placeholder:text-[var(--color-text-weak)] text-[var(--color-text-body)] focus:outline-none focus:border-red-400 transition-all"
                        />
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-[var(--color-text-body)]">
                                Attach Photos
                                <span className="ml-1.5 font-normal text-[var(--color-text-weak)]">(optional, up to 5)</span>
                            </label>
                            {images.length < 5 && (
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-sub)] hover:border-red-300 hover:text-red-500 transition-all"
                                >
                                    <ImagePlus className="w-4 h-4" />
                                    Add Photo
                                </button>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleImageSelect}
                        />
                        {images.length === 0 ? (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full flex flex-col items-center justify-center gap-2 py-6 rounded-2xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)] text-[var(--color-text-weak)] hover:border-red-300 hover:text-red-400 transition-all"
                            >
                                <ImagePlus className="w-7 h-7" />
                                <span className="text-sm">Tap to add a photo of the issue</span>
                            </button>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {images.map((img, i) => (
                                    <div key={i} className="relative aspect-square rounded-xl overflow-hidden border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)]">
                                        <img src={img.dataUrl ?? img.remotePath} alt={img.name} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(i)}
                                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-600 transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-white" />
                                        </button>
                                    </div>
                                ))}
                                {images.length < 5 && (
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-xl border-2 border-dashed border-[var(--color-border)] flex flex-col items-center justify-center gap-1 text-[var(--color-text-weak)] hover:border-red-300 hover:text-red-400 transition-all"
                                    >
                                        <ImagePlus className="w-5 h-5" />
                                        <span className="text-xs">Add</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200">
                        <Wrench className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-800">A <strong>repair task</strong> will be auto-created once submitted.</p>
                    </div>
                </div>

                <div className="px-5 py-4 border-t border-[var(--color-border)] flex gap-3 shrink-0">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 rounded-2xl border-2 border-[var(--color-border)] bg-[var(--color-surface-raised)] text-base font-bold hover:bg-[var(--color-muted)] transition-colors active:scale-[0.98]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { if (description.trim()) onConfirm({ notes: description.trim(), isOk: false, images }); else textareaRef.current?.focus(); }}
                        disabled={!description.trim()}
                        className={`flex-[2] py-4 rounded-2xl text-white text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${description.trim() ? "bg-red-500 hover:bg-red-600" : "bg-[var(--color-muted)] text-[var(--color-text-weak)] cursor-not-allowed"}`}
                    >
                        <Flag className="w-5 h-5" /> Log Issue
                    </button>
                </div>
            </div>
            <style>{`@keyframes slideUp { from { transform: translateY(100%); opacity: 0.6; } to { transform: translateY(0); opacity: 1; } }`}</style>
        </div>
    );
}
