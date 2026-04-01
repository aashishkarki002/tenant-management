/**
 * TemplateEditor.jsx
 *
 * Sheet-based editor for a ChecklistTemplate.
 * Lets admin/super_admin:
 *   - Add / rename / remove sections
 *   - Add / edit / remove items within a section
 *   - Reorder sections via up/down controls
 *
 * Usage:
 *   <TemplateEditor
 *     templateId={template._id}
 *     open={open}
 *     onOpenChange={setOpen}
 *     onSaved={() => refetchTemplates()}
 *   />
 *
 * API routes consumed:
 *   GET    /api/checklists/templates/:id
 *   POST   /api/checklists/templates/:id/sections
 *   PATCH  /api/checklists/templates/:id/sections/:sectionKey
 *   DELETE /api/checklists/templates/:id/sections/:sectionKey
 *   POST   /api/checklists/templates/:id/sections/:sectionKey/items
 *   PATCH  /api/checklists/templates/:id/sections/:sectionKey/items/:itemId
 *   DELETE /api/checklists/templates/:id/sections/:sectionKey/items/:itemId
 *   PATCH  /api/checklists/templates/:id/sections/reorder
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    Plus,
    Trash2,
    Pencil,
    Check,
    X,
    ChevronDown,
    ChevronUp,
    Loader2,
    GripVertical,
    LayoutList,
    AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import api from "@/plugins/axios";

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = "/api/checklists/templates";

async function fetchTemplate(id) {
    const res = await api.get(`${BASE}/${id}`);
    return res.data.data;
}
async function apiAddSection(id, payload) {
    const res = await api.post(`${BASE}/${id}/sections`, payload);
    return res.data;
}
async function apiUpdateSection(id, sectionKey, payload) {
    const res = await api.patch(`${BASE}/${id}/sections/${sectionKey}`, payload);
    return res.data;
}
async function apiRemoveSection(id, sectionKey) {
    const res = await api.delete(`${BASE}/${id}/sections/${sectionKey}`);
    return res.data;
}
async function apiAddItem(id, sectionKey, payload) {
    const res = await api.post(`${BASE}/${id}/sections/${sectionKey}/items`, payload);
    return res.data;
}
async function apiUpdateItem(id, sectionKey, itemId, payload) {
    const res = await api.patch(`${BASE}/${id}/sections/${sectionKey}/items/${itemId}`, payload);
    return res.data;
}
async function apiRemoveItem(id, sectionKey, itemId) {
    const res = await api.delete(`${BASE}/${id}/sections/${sectionKey}/items/${itemId}`);
    return res.data;
}
async function apiReorderSections(id, orderedSectionKeys) {
    const res = await api.patch(`${BASE}/${id}/sections/reorder`, { orderedSectionKeys });
    return res.data;
}

// ─── Inline editable label ────────────────────────────────────────────────────

function InlineEdit({ value, onSave, placeholder, className }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    function commit() {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === value) {
            setDraft(value);
            setEditing(false);
            return;
        }
        onSave(trimmed);
        setEditing(false);
    }

    if (editing) {
        return (
            <div className="flex items-center gap-1 min-w-0 flex-1">
                <Input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") {
                            setDraft(value);
                            setEditing(false);
                        }
                    }}
                    className="h-7 text-xs px-2 py-0"
                    placeholder={placeholder}
                />
                <button onClick={commit} className="text-emerald-500 hover:text-emerald-600 flex-shrink-0">
                    <Check className="h-3.5 w-3.5" />
                </button>
                <button
                    onClick={() => { setDraft(value); setEditing(false); }}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => { setDraft(value); setEditing(true); }}
            className={cn("group flex items-center gap-1.5 text-left min-w-0 flex-1", className)}
        >
            <span className="truncate">
                {value || <span className="text-muted-foreground italic">{placeholder}</span>}
            </span>
            <Pencil className="h-3 w-3 text-muted-foreground/0 group-hover:text-muted-foreground/60 flex-shrink-0 transition-colors" />
        </button>
    );
}

// ─── Quantity inline edit ─────────────────────────────────────────────────────

function QuantityEdit({ value, onSave }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value ?? "");
    const inputRef = useRef(null);

    useEffect(() => {
        if (editing) inputRef.current?.focus();
    }, [editing]);

    function commit() {
        onSave(draft);
        setEditing(false);
    }

    if (editing) {
        return (
            <Input
                ref={inputRef}
                type="number"
                min={0}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditing(false);
                }}
                className="h-6 w-14 text-xs px-1.5 py-0 text-center"
            />
        );
    }

    return (
        <button
            onClick={() => { setDraft(value ?? ""); setEditing(true); }}
            title="Edit quantity"
            className="text-[10px] text-muted-foreground hover:text-foreground w-14 text-center border border-transparent hover:border-border rounded px-1 py-0.5 transition-all"
        >
            {value != null ? `qty ${value}` : "qty —"}
        </button>
    );
}

// ─── Single item row ──────────────────────────────────────────────────────────

function ItemRow({ item, templateId, sectionKey, onUpdate, onRemove, isMutating }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [saving, setSaving] = useState(false);

    async function handleLabelSave(label) {
        setSaving(true);
        try {
            const res = await apiUpdateItem(templateId, sectionKey, item._id, { label });
            if (res.success) { onUpdate(res.data); toast.success("Item updated"); }
        } catch { toast.error("Failed to update item"); }
        finally { setSaving(false); }
    }

    async function handleQuantitySave(rawVal) {
        const quantity = rawVal === "" ? null : Number(rawVal);
        setSaving(true);
        try {
            const res = await apiUpdateItem(templateId, sectionKey, item._id, { quantity });
            if (res.success) onUpdate(res.data);
        } catch { toast.error("Failed to update quantity"); }
        finally { setSaving(false); }
    }

    return (
        <>
            <div
                className={cn(
                    "group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 transition-colors",
                    (saving || isMutating) && "opacity-50 pointer-events-none",
                )}
            >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <InlineEdit
                        value={item.label}
                        onSave={handleLabelSave}
                        placeholder="Item label"
                        className="text-xs text-foreground"
                    />
                </div>
                <QuantityEdit value={item.quantity} onSave={handleQuantitySave} />
                <button
                    onClick={() => setConfirmDelete(true)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                    aria-label="Remove item"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </button>
            </div>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Remove this item?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium">{item.label}</span> will be removed from the template.
                            Existing results referencing it will show "Item removed."
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onRemove(item._id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ─── Add item inline form ─────────────────────────────────────────────────────

function AddItemForm({ templateId, sectionKey, onAdded }) {
    const [label, setLabel] = useState("");
    const [quantity, setQuantity] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleAdd() {
        if (!label.trim()) return;
        setSaving(true);
        try {
            const res = await apiAddItem(templateId, sectionKey, {
                label: label.trim(),
                quantity: quantity === "" ? null : Number(quantity),
            });
            if (res.success) {
                onAdded(res.data);
                setLabel("");
                setQuantity("");
                toast.success("Item added");
            } else {
                toast.error(res.message);
            }
        } catch { toast.error("Failed to add item"); }
        finally { setSaving(false); }
    }

    return (
        <div className="flex items-center gap-1.5 px-2 pt-1.5">
            <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="New item label…"
                className="h-7 text-xs flex-1"
                disabled={saving}
            />
            <Input
                type="number"
                min={0}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="qty"
                className="h-7 text-xs w-14 text-center"
                disabled={saving}
            />
            <Button size="sm" onClick={handleAdd} disabled={!label.trim() || saving} className="h-7 px-2.5">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
        </div>
    );
}

// ─── Section block ────────────────────────────────────────────────────────────

function SectionBlock({
    section,
    templateId,
    onTemplateUpdate,
    onRemoveSection,
    onMoveUp,
    onMoveDown,
    isFirst,
    isLast,
}) {
    const [open, setOpen] = useState(true);
    const [removingItemId, setRemovingItemId] = useState(null);
    const [confirmRemove, setConfirmRemove] = useState(false);

    async function handleRenameSection(sectionLabel) {
        try {
            const res = await apiUpdateSection(templateId, section.sectionKey, { sectionLabel });
            if (res.success) { onTemplateUpdate(res.data); toast.success("Section renamed"); }
        } catch { toast.error("Failed to rename section"); }
    }

    async function handleRemoveItem(itemId) {
        setRemovingItemId(itemId);
        try {
            const res = await apiRemoveItem(templateId, section.sectionKey, itemId);
            if (res.success) { onTemplateUpdate(res.data); toast.success("Item removed"); }
        } catch { toast.error("Failed to remove item"); }
        finally { setRemovingItemId(null); }
    }

    return (
        <>
            <div className="rounded-lg border bg-card overflow-hidden">
                <Collapsible open={open} onOpenChange={setOpen}>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button
                                onClick={onMoveUp}
                                disabled={isFirst}
                                className="disabled:opacity-20 text-muted-foreground hover:text-foreground"
                            >
                                <ChevronUp className="h-3 w-3" />
                            </button>
                            <button
                                onClick={onMoveDown}
                                disabled={isLast}
                                className="disabled:opacity-20 text-muted-foreground hover:text-foreground"
                            >
                                <ChevronDown className="h-3 w-3" />
                            </button>
                        </div>

                        <InlineEdit
                            value={section.sectionLabel}
                            onSave={handleRenameSection}
                            placeholder="Section label"
                            className="text-xs font-semibold text-foreground"
                        />

                        <span className="text-[10px] text-muted-foreground/50 font-mono flex-shrink-0">
                            {section.sectionKey}
                        </span>

                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full flex-shrink-0">
                            {section.items.length}
                        </Badge>

                        <button
                            onClick={() => setConfirmRemove(true)}
                            className="text-muted-foreground/30 hover:text-destructive transition-colors flex-shrink-0"
                            aria-label="Remove section"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <CollapsibleTrigger asChild>
                            <button className="text-muted-foreground/60 hover:text-foreground flex-shrink-0">
                                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-150", open && "rotate-180")} />
                            </button>
                        </CollapsibleTrigger>
                    </div>

                    <CollapsibleContent>
                        <div className="px-1 py-1.5 space-y-0.5">
                            {section.items.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/50 px-2 py-1 italic">
                                    No items yet — add one below
                                </p>
                            )}
                            {section.items.map((item) => (
                                <ItemRow
                                    key={item._id}
                                    item={item}
                                    templateId={templateId}
                                    sectionKey={section.sectionKey}
                                    onUpdate={onTemplateUpdate}
                                    onRemove={handleRemoveItem}
                                    isMutating={removingItemId === item._id}
                                />
                            ))}
                        </div>
                        <Separator className="mx-3" />
                        <AddItemForm
                            templateId={templateId}
                            sectionKey={section.sectionKey}
                            onAdded={onTemplateUpdate}
                        />
                        <div className="h-2" />
                    </CollapsibleContent>
                </Collapsible>
            </div>

            <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                            Remove section?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium">{section.sectionLabel}</span> and all{" "}
                            <span className="font-medium">{section.items.length} item(s)</span> will be permanently
                            removed. Old results referencing these items will show "Item removed."
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => onRemoveSection(section.sectionKey)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Remove section
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// ─── Add section form ─────────────────────────────────────────────────────────

function AddSectionForm({ templateId, onAdded }) {
    const [open, setOpen] = useState(false);
    const [sectionKey, setSectionKey] = useState("");
    const [sectionLabel, setSectionLabel] = useState("");
    const [saving, setSaving] = useState(false);

    async function handleAdd() {
        if (!sectionKey.trim() || !sectionLabel.trim()) return;
        setSaving(true);
        try {
            const res = await apiAddSection(templateId, {
                sectionKey: sectionKey.trim().toUpperCase().replace(/\s+/g, "_"),
                sectionLabel: sectionLabel.trim(),
            });
            if (res.success) {
                onAdded(res.data);
                setSectionKey("");
                setSectionLabel("");
                setOpen(false);
                toast.success("Section added");
            } else {
                toast.error(res.message);
            }
        } catch { toast.error("Failed to add section"); }
        finally { setSaving(false); }
    }

    if (!open) {
        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="w-full h-9 gap-2 text-xs border-dashed text-muted-foreground hover:text-foreground"
            >
                <Plus className="h-3.5 w-3.5" />
                Add section
            </Button>
        );
    }

    return (
        <div className="rounded-lg border border-dashed bg-muted/20 p-3 space-y-2.5">
            <p className="text-xs font-medium text-foreground">New section</p>
            <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Key
                    </label>
                    <Input
                        value={sectionKey}
                        onChange={(e) => setSectionKey(e.target.value)}
                        placeholder="e.g. ROOFTOP"
                        className="h-7 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">Auto-uppercased, immutable</p>
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Display label
                    </label>
                    <Input
                        value={sectionLabel}
                        onChange={(e) => setSectionLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                        placeholder="e.g. Rooftop Area"
                        className="h-7 text-xs"
                    />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Button
                    size="sm"
                    onClick={handleAdd}
                    disabled={!sectionKey.trim() || !sectionLabel.trim() || saving}
                    className="h-7 text-xs"
                >
                    {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                    Add section
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)} className="h-7 text-xs">
                    Cancel
                </Button>
            </div>
        </div>
    );
}

// ─── Main export ──────────────────────────────────────────────────────────────

function TemplateEditor({ templateId, open, onOpenChange, onSaved }) {
    const [template, setTemplate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open || !templateId) return;
        setLoading(true);
        setError(null);
        fetchTemplate(templateId)
            .then(setTemplate)
            .catch((e) => setError(e.message ?? "Failed to load template"))
            .finally(() => setLoading(false));
    }, [open, templateId]);

    const handleTemplateUpdate = useCallback(
        (updated) => {
            setTemplate(updated);
            onSaved?.();
        },
        [onSaved],
    );

    async function handleRemoveSection(sectionKey) {
        try {
            const res = await apiRemoveSection(templateId, sectionKey);
            if (res.success) { handleTemplateUpdate(res.data); toast.success("Section removed"); }
            else toast.error(res.message);
        } catch { toast.error("Failed to remove section"); }
    }

    async function moveSection(index, direction) {
        if (!template) return;
        const keys = template.sections.map((s) => s.sectionKey);
        const newIdx = index + direction;
        if (newIdx < 0 || newIdx >= keys.length) return;

        // Optimistic UI swap
        const swapped = [...keys];
        [swapped[index], swapped[newIdx]] = [swapped[newIdx], swapped[index]];
        const reordered = swapped.map((k) => template.sections.find((s) => s.sectionKey === k));
        setTemplate((prev) => ({ ...prev, sections: reordered }));

        try {
            const res = await apiReorderSections(templateId, swapped);
            if (res.success) { setTemplate(res.data); onSaved?.(); }
            else {
                setTemplate((prev) => ({ ...prev, sections: template.sections }));
                toast.error(res.message);
            }
        } catch {
            setTemplate((prev) => ({ ...prev, sections: template.sections }));
            toast.error("Failed to reorder");
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="right"
                className="w-full sm:max-w-xl flex flex-col gap-0 p-0 overflow-hidden"
            >
                <SheetHeader className="px-5 pt-5 pb-4 border-b flex-shrink-0">
                    <SheetTitle className="text-base font-semibold">Edit Template</SheetTitle>
                    {template && (
                        <SheetDescription className="text-xs flex items-center gap-1.5 mt-0.5">
                            <LayoutList className="h-3 w-3 flex-shrink-0" />
                            {template.name || template.category} · {template.sections?.length ?? 0} sections ·{" "}
                            {template.totalItems ?? 0} items total
                        </SheetDescription>
                    )}
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                    {loading && (
                        <div className="flex items-center justify-center py-20 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin mr-2" />
                            <span className="text-sm">Loading template…</span>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-5 text-center">
                            <p className="text-sm text-destructive">{error}</p>
                        </div>
                    )}

                    {template && !loading && (
                        <>
                            {template.sections.map((section, idx) => (
                                <SectionBlock
                                    key={section.sectionKey}
                                    section={section}
                                    templateId={templateId}
                                    onTemplateUpdate={handleTemplateUpdate}
                                    onRemoveSection={handleRemoveSection}
                                    onMoveUp={() => moveSection(idx, -1)}
                                    onMoveDown={() => moveSection(idx, 1)}
                                    isFirst={idx === 0}
                                    isLast={idx === template.sections.length - 1}
                                />
                            ))}
                            <AddSectionForm templateId={templateId} onAdded={handleTemplateUpdate} />
                        </>
                    )}
                </div>

                {template && (
                    <div className="border-t px-5 py-3 flex items-center justify-between gap-3 flex-shrink-0 bg-muted/20">
                        <p className="text-[11px] text-muted-foreground">
                            Changes take effect on tomorrow's check results.
                        </p>
                        <Button size="sm" variant="outline" onClick={() => onOpenChange(false)} className="h-7 text-xs">
                            Done
                        </Button>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

export default TemplateEditor;