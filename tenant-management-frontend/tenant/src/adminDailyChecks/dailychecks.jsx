
import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import NepaliDate from "nepali-datetime";
import { toast } from "sonner";
import TodayBoard from "./components/TodayBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Settings2, CalendarDays, Loader2 } from "lucide-react";
import TemplateEditor from "./components/TemplateEditor";
import api from "../../plugins/axios";

const CATEGORIES = [
  { value: "CCTV", label: "CCTV" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "SANITARY", label: "Sanitary" },
  { value: "COMMON_AREA", label: "Common Area" },
  { value: "PARKING", label: "Parking" },
  { value: "FIRE", label: "Fire Safety" },
  { value: "WATER_TANK", label: "Water Tank" },
];

function toNepaliISO(nd) {
  const y = nd.getYear();
  const m = String(nd.getMonth() + 1).padStart(2, "0");
  const d = String(nd.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ─── Create Template Dialog ───────────────────────────────────────────────────

function CreateTemplateDialog({ open, onOpenChange, propertyId, onCreated }) {
  const [category, setCategory] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!category) return;
    setSaving(true);
    try {
      const res = await api.post("/api/checklists/templates", {
        propertyId,
        category,
        name: name.trim() || undefined,
      });
      if (res.data?.success) {
        toast.success("Template created");
        onCreated(res.data.data._id);
        setCategory("");
        setName("");
        onOpenChange(false);
      } else {
        toast.error(res.data?.message ?? "Failed to create template");
      }
    } catch (e) {
      toast.error(e.response?.data?.message ?? e.message ?? "Failed to create template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Create Checklist Template</DialogTitle>
          <DialogDescription className="text-xs">
            No templates found for this property. Create one to start tracking daily checks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Category</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`text-xs px-3 py-2 rounded-md border text-left transition-colors ${
                    category === c.value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Name <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Block A Daily"
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} className="h-8 text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!category || saving}
            className="h-8 text-xs"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
            Create template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const OWNERSHIP_ENTITY_ID = "6970f5a7464f3514eb16051c";

/**
 * DailyChecksPage
 *
 * Props:
 *   propertyId  string   — passed in from route/parent
 */
function DailyChecksPage({ propertyId }) {
  const navigate = useNavigate();
  const effectivePropertyId = propertyId ?? OWNERSHIP_ENTITY_ID;

  // ── Template editor state ─────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState(null);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  /** Opens the editor using the first active template for this property (Settings button). */
  const handleOpenTemplateSettings = useCallback(async () => {
    try {
      const res = await api.get("/api/checklists/templates", {
        params: { propertyId: effectivePropertyId, isActive: true },
      });
      const list = res.data?.data ?? [];
      if (!list.length) {
        setCreateDialogOpen(true);
        return;
      }
      setEditingTemplateId(list[0]._id);
      setEditorOpen(true);
    } catch (e) {
      toast.error(e.message ?? "Failed to load templates");
    }
  }, [effectivePropertyId]);

  const handleEditorOpenChange = useCallback((open) => {
    setEditorOpen(open);
    if (!open) setEditingTemplateId(null);
  }, []);

  const handleTemplateCreated = useCallback((newTemplateId) => {
    setEditingTemplateId(newTemplateId);
    setEditorOpen(true);
  }, []);

  const todayNepaliDate = toNepaliISO(new NepaliDate(new Date()));

  const handleCardClick = useCallback(
    (result) => {
      navigate(`/admin-daily-checks/check-result-details/${result._id}`);
    },
    [navigate],
  );

  return (
    <div className="space-y-5 p-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-foreground tracking-tight">
            Daily Checks
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {todayNepaliDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/calendar"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium border border-border rounded-md hover:bg-muted-fill transition-colors text-muted-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            View Calendar
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={handleOpenTemplateSettings}
            title="Manage templates"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* ── View content ────────────────────────────────────────────────── */}
      <TodayBoard
        propertyId={effectivePropertyId}
        onCardClick={handleCardClick}
        refreshKey={todayRefreshKey}
      />
      {editingTemplateId && (
        <TemplateEditor
          templateId={editingTemplateId}
          open={editorOpen}
          onOpenChange={handleEditorOpenChange}
          onSaved={() => setTodayRefreshKey((k) => k + 1)}
        />
      )}
      <CreateTemplateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        propertyId={effectivePropertyId}
        onCreated={handleTemplateCreated}
      />
    </div>
  );
}

export default DailyChecksPage;