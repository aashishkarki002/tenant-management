import { useState, useRef, useCallback, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { CalendarDays, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCalendarEvents } from "./hooks/useCalendarEvents";
import EventPopover from "./components/EventPopover";

// ── Event type definitions ─────────────────────────────────────────────────────

const EVENT_TYPES = {
  MAINTENANCE:     { label: "Maintenance",     color: "#f97316" },
  DAILY_CHECK:     { label: "Daily Checks",    color: "#10b981" },
  RENT_DUE:        { label: "Rent Due",         color: "#3b82f6" },
  RENT_OVERDUE:    { label: "Rent Overdue",     color: "#dc2626" },
  LEASE_START:     { label: "Tenant Join",      color: "#14b8a6" },
  LEASE_END:       { label: "Lease End",        color: "#8b5cf6" },
  RENT_ESCALATION: { label: "Rent Escalation", color: "#f59e0b" },
};

// Daily checks with issues get a distinct red colour
function resolveColor(event) {
  if (event.type === "DAILY_CHECK" && event.extendedProps?.hasIssues) {
    return "#ef4444";
  }
  return EVENT_TYPES[event.type]?.color ?? "#6b7280";
}

// Map raw API events → FullCalendar event objects
function toFCEvents(rawEvents, activeFilters) {
  return rawEvents
    .filter((e) => activeFilters.has(e.type))
    .map((e) => {
      const color = resolveColor(e);
      return {
        id: e.id,
        title: e.title,
        start: e.start,
        allDay: true,
        backgroundColor: color,
        borderColor: color,
        textColor: "#ffffff",
        extendedProps: { ...e.extendedProps, type: e.type },
      };
    });
}

// ── iCal generation ────────────────────────────────────────────────────────────

function toICSDate(dateInput) {
  const d = new Date(dateInput);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("");
}

function generateICS(events) {
  const now = new Date()
    .toISOString()
    .replace(/[-:.]/g, "")
    .slice(0, 15) + "Z";

  const vevents = events.map((e) => {
    const typeLabel = EVENT_TYPES[e.type]?.label ?? e.type ?? "";
    const desc = [
      e.extendedProps?.status ? `Status: ${e.extendedProps.status}` : "",
      e.extendedProps?.tenantName
        ? `Tenant: ${e.extendedProps.tenantName}`
        : "",
      e.extendedProps?.nepaliDate
        ? `BS Date: ${e.extendedProps.nepaliDate}`
        : "",
    ]
      .filter(Boolean)
      .join("\\n");

    return [
      "BEGIN:VEVENT",
      `UID:${e.id}@sallyanhouse.com`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${toICSDate(e.start)}`,
      `SUMMARY:${e.title.replace(/,/g, "\\,")}`,
      typeLabel && `CATEGORIES:${typeLabel}`,
      desc && `DESCRIPTION:${desc}`,
      "END:VEVENT",
    ]
      .filter(Boolean)
      .join("\r\n");
  });

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sallyan House//Property Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...vevents,
    "END:VCALENDAR",
  ].join("\r\n");
}

function downloadICS(events) {
  const content = generateICS(events);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sallyan-calendar.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Filter chip ────────────────────────────────────────────────────────────────

function FilterChip({ type, config, active, onToggle }) {
  return (
    <button
      onClick={() => onToggle(type)}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
        active
          ? "text-white border-transparent"
          : "bg-transparent text-text-sub border-border opacity-50 hover:opacity-70"
      )}
      style={active ? { backgroundColor: config.color, borderColor: config.color } : {}}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: active ? "#fff" : config.color }}
      />
      {config.label}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const FC_PLUGINS = [dayGridPlugin, listPlugin, interactionPlugin];

export default function CalendarPage() {
  const calendarRef = useRef(null);
  const [visibleRange, setVisibleRange] = useState(null);
  const [activeFilters, setActiveFilters] = useState(
    new Set(Object.keys(EVENT_TYPES).filter((t) => t !== "DAILY_CHECK"))
  );
  const [popover, setPopover] = useState(null); // { event, position }

  const { events: rawEvents, isLoading, error } = useCalendarEvents(visibleRange);

  const fcEvents = useMemo(
    () => toFCEvents(rawEvents, activeFilters),
    [rawEvents, activeFilters]
  );

  const handleDatesSet = useCallback((info) => {
    setVisibleRange({ start: info.start, end: info.end });
  }, []);

  const handleEventClick = useCallback(({ event, jsEvent }) => {
    jsEvent.stopPropagation();
    setPopover({
      event,
      position: { x: jsEvent.clientX, y: jsEvent.clientY },
    });
  }, []);

  const toggleFilter = useCallback((type) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const handleExport = () => {
    const exportable = rawEvents.filter((e) => activeFilters.has(e.type));
    downloadICS(exportable);
  };

  return (
    <div className="p-6 space-y-4 max-w-[1400px] mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-text-sub shrink-0" />
          <h1 className="text-base font-semibold text-text-strong tracking-tight">
            Calendar
          </h1>
          {isLoading && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-text-sub" />
          )}
        </div>

        <button
          onClick={handleExport}
          disabled={rawEvents.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-md bg-background hover:bg-muted-fill transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          Export iCal
        </button>
      </div>

      {/* ── Filter chips ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(EVENT_TYPES).map(([type, config]) => (
          <FilterChip
            key={type}
            type={type}
            config={config}
            active={activeFilters.has(type)}
            onToggle={toggleFilter}
          />
        ))}
      </div>

      {/* ── Error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* ── Calendar ─────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden unified-fc">
        <FullCalendar
          ref={calendarRef}
          plugins={FC_PLUGINS}
          initialView="dayGridMonth"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,listMonth",
          }}
          buttonText={{ today: "Today", month: "Month", listMonth: "List" }}
          height="auto"
          events={fcEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          eventDisplay="block"
          dayMaxEvents={4}
          moreLinkContent={(args) => `+${args.num} more`}
          nowIndicator
          eventClassNames="cursor-pointer rounded text-xs font-medium px-1"
          dayCellClassNames="hover:bg-muted-fill/50 transition-colors"
        />
      </div>

      {/* ── Event popover ─────────────────────────────────────────────────── */}
      {popover && (
        <EventPopover
          event={popover.event}
          position={popover.position}
          onClose={() => setPopover(null)}
          eventTypes={EVENT_TYPES}
        />
      )}

      {/* ── Scoped FullCalendar style overrides ──────────────────────────── */}
      <style>{`
        .unified-fc .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-text-strong);
        }
        .unified-fc .fc-button {
          background: var(--color-background) !important;
          border: 1px solid var(--color-border) !important;
          color: var(--color-text-body) !important;
          border-radius: 0.5rem !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          padding: 0.25rem 0.75rem !important;
          box-shadow: none !important;
          text-transform: capitalize !important;
        }
        .unified-fc .fc-button:hover {
          background: var(--color-muted-fill) !important;
        }
        .unified-fc .fc-button-active,
        .unified-fc .fc-button-primary:not(:disabled).fc-button-active {
          background: var(--color-accent) !important;
          border-color: var(--color-accent) !important;
          color: var(--color-text-strong) !important;
        }
        .unified-fc .fc-col-header-cell {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-sub);
          padding: 0.5rem 0;
        }
        .unified-fc .fc-daygrid-day-number {
          font-size: 0.8rem;
          color: var(--color-text-body);
          padding: 0.25rem 0.5rem;
        }
        .unified-fc .fc-day-today {
          background: var(--color-accent-light) !important;
        }
        .unified-fc .fc-day-today .fc-daygrid-day-number {
          background: var(--color-accent);
          color: var(--color-surface-raised);
          border-radius: 9999px;
          width: 1.5rem;
          height: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0.25rem;
        }
        .unified-fc .fc-more-link {
          font-size: 0.7rem;
          color: var(--color-text-sub);
        }
        .unified-fc .fc-list-event:hover td {
          background: var(--color-muted-fill);
        }
        .unified-fc .fc-list-day-cushion {
          background: var(--color-surface);
        }
        .unified-fc td,
        .unified-fc th {
          border-color: var(--color-border) !important;
        }
        .unified-fc .fc-list-event-dot {
          border-width: 6px;
        }
      `}</style>
    </div>
  );
}
