
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NepaliDate from "nepali-datetime";
import { toast } from "sonner";
import TodayBoard from "./components/TodayBoard";
import ChecklistCalendar from "./components/CheckListCalendar";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";
import TemplateEditor from "./components/TemplateEditor";
import api from "../../plugins/axios";


function toNepaliISO(nd) {
  const y = nd.getYear();
  const m = String(nd.getMonth() + 1).padStart(2, "0");
  const d = String(nd.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getCurrentNepaliYearMonth() {
  const nd = new NepaliDate(new Date());
  return { year: nd.getYear(), month: nd.getMonth() + 1 };
}

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const TABS = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
];

function TabBar({ activeTab, onTabChange }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-1 w-fit">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          onClick={() => onTabChange(id)}
          className={[
            "px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-100",
            activeTab === id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
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

  const [activeTab, setActiveTab] = useState("today");
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

  // Today's Nepali date — used to highlight calendar cell and as TodayBoard default
  const todayNepaliDate = toNepaliISO(new NepaliDate(new Date()));
  const { year: currentYear, month: currentMonth } = getCurrentNepaliYearMonth();

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
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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

      <div className="h-px bg-border/50" />

      {/* ── View content ────────────────────────────────────────────────── */}
      {activeTab === "today" ? (
        <TodayBoard
          propertyId={effectivePropertyId}
          onCardClick={handleCardClick}
          refreshKey={todayRefreshKey}
        />
      ) : (
        <ChecklistCalendar
          propertyId={effectivePropertyId}
          initialYear={currentYear}
          initialMonth={currentMonth}
          todayNepaliDate={todayNepaliDate}
          onCardClick={handleCardClick}
        />
      )}
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