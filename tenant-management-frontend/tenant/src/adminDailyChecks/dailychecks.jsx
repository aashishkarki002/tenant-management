
import { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import NepaliDate from "nepali-datetime";
import { toast } from "sonner";
import TodayBoard from "./components/TodayBoard";
import { Button } from "@/components/ui/button";
import { Settings2, CalendarDays } from "lucide-react";
import TemplateEditor from "./components/TemplateEditor";
import api from "../../plugins/axios";


function toNepaliISO(nd) {
  const y = nd.getYear();
  const m = String(nd.getMonth() + 1).padStart(2, "0");
  const d = String(nd.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  /** Opens the editor using the first active template for this property (Settings button). */
  const handleOpenTemplateSettings = useCallback(async () => {
    try {
      const res = await api.get("/api/checklists/templates", {
        params: { propertyId: effectivePropertyId, isActive: true },
      });
      const list = res.data?.data ?? [];
      if (!list.length) {
        toast.error("No active checklist templates for this property.");
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
    </div>
  );
}

export default DailyChecksPage;