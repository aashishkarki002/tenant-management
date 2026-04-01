/**
 * dailychecks.jsx  — redesigned page
 *
 * Two-tab layout:
 *   Tab 1 "Today"   → TodayBoard  (primary, daily-use view)
 *   Tab 2 "History" → ChecklistCalendar  (month grid → click day → see results)
 *
 * The old card-grid history is gone.
 * No infinite scroll. No pagination of individual result cards.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import NepaliDate from "nepali-datetime";
import TodayBoard from "./components/TodayBoard";
import ChecklistCalendar from "./components/ChecklistCalendar";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Zero-padded Nepali ISO date string from a NepaliDate instance.
 * "2082-03-14"
 */
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
      </div>

      <div className="h-px bg-border/50" />

      {/* ── View content ────────────────────────────────────────────────── */}
      {activeTab === "today" ? (
        <TodayBoard
          propertyId={effectivePropertyId}
          onCardClick={handleCardClick}
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
    </div>
  );
}

export default DailyChecksPage;