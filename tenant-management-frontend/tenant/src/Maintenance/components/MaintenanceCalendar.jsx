/**
 * MaintenanceCalendar.jsx
 *
 * npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/interaction @fullcalendar/list
 */

import { useState, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Status & priority → colour mapping ──────────────────────────────────── */
const STATUS_COLOR = {
    OPEN: { bg: 'bg-muted-fill text-text-strong', text: 'text-text-strong' }, // amber
    IN_PROGRESS: { bg: 'bg-muted-fill text-text-strong', text: 'text-text-strong' }, // blue
    COMPLETED: { bg: 'bg-muted-fill text-text-strong', text: 'text-text-strong' }, // emerald
    CANCELLED: { bg: 'bg-muted-fill text-text-sub', text: 'text-text-sub' }, // gray
};

const PRIORITY_BORDER = {
    URGENT: 'bg-muted-fill text-text-strong',
    HIGH: 'bg-muted-fill text-text-strong',
    MEDIUM: 'bg-muted-fill text-text-strong',
    LOW: 'bg-muted-fill text-text-sub',
};

const STATUS_BADGE = {
    OPEN: 'bg-muted-fill text-text-strong',
    IN_PROGRESS: 'bg-muted-fill tex t-text-strong',
    COMPLETED: 'bg-muted-fill text-text-strong',
    CANCELLED: 'bg-muted-fill text-text-sub',
};

/* ── Convert maintenance items → FullCalendar events ────────────────────── */
function toFCEvents(maintenance) {
    return (maintenance || [])
        .filter((m) => m.scheduledDate)
        .map((m) => {
            const status = (m.status || 'OPEN').toUpperCase();
            const priority = (m.priority || 'LOW').toUpperCase();
            const color = STATUS_COLOR[status] ?? STATUS_COLOR.OPEN;
            return {
                id: m._id,
                title: m.title || 'Untitled',
                start: m.scheduledDate,
                backgroundColor: color.bg,
                borderColor: PRIORITY_BORDER[priority] ?? color.bg,
                textColor: color.text,
                extendedProps: { maintenance: m },
            };
        });
}

/* ── Popover for clicked event ───────────────────────────────────────────── */
function EventPopover({ event, position, onClose }) {
    if (!event) return null;
    const m = event.extendedProps.maintenance;
    const status = (m.status || 'OPEN').toUpperCase();

    return (
        /* Backdrop */
        <div className="fixed inset-0 z-50 flex items-start justify-center" onClick={onClose}>
            <div
                className="absolute z-50 w-72 rounded-xl border border-muted-fill bg-surface-raised p-4 shadow-xl"
                style={{ top: Math.min(position.y, window.innerHeight - 280), left: Math.min(position.x, window.innerWidth - 300) }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-text-strong">{m.title}</p>
                    <button onClick={onClose} className="shrink-0 rounded-md p-0.5 text-text-sub hover:bg-muted-fill">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Badges */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[status] ?? STATUS_BADGE.OPEN)}>
                        {status.replace('_', ' ')}
                    </span>
                    {m.priority && (
                        <span className="rounded-full bg-muted-fill px-2 py-0.5 text-xs font-medium capitalize text-text-sub">
                            {m.priority} priority
                        </span>
                    )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-text-sub">
                    {m.scheduledDate && (
                        <Row label="Date" value={new Date(m.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} />
                    )}
                    {m.type && <Row label="Type" value={m.type} />}
                    {m.assignedTo?.name && <Row label="Assigned" value={m.assignedTo.name} />}
                    {m.amount > 0 && <Row label="Estimated" value={`₹${Number(m.amount).toLocaleString('en-IN')}`} />}
                    {m.paidAmount > 0 && <Row label="Paid" value={`₹${Number(m.paidAmount).toLocaleString('en-IN')}`} />}
                    {m.description && (
                        <div className="mt-2 rounded-md bg-muted-fill p-2 text-text-sub leading-relaxed">
                            {m.description}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function Row({ label, value }) {
    return (
        <div className="flex items-start gap-2">
            <span className="w-16 shrink-0 font-medium text-text-sub">{label}</span>
            <span className="text-text-strong">{value}</span>
        </div>
    );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function MaintenanceCalendar({ maintenance = [] }) {
    const calendarRef = useRef(null);
    const [popover, setPopover] = useState(null); // { event, position }

    const events = useMemo(() => toFCEvents(maintenance), [maintenance]);

    const handleEventClick = ({ event, jsEvent }) => {
        jsEvent.stopPropagation();
        setPopover({
            event,
            position: { x: jsEvent.clientX + 8, y: jsEvent.clientY + 8 },
        });
    };

    return (
        <div className="relative">
            {/* Popover */}
            {popover && (
                <EventPopover
                    event={popover.event}
                    position={popover.position}
                    onClose={() => setPopover(null)}
                />
            )}

            {/* Legend */}
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-sub">
                {Object.entries(STATUS_COLOR).map(([status, { bg }]) => (
                    <span key={status} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bg }} />
                        {status.replace('_', ' ')}
                    </span>
                ))}
                <span className="ml-2 text-text-sub">|</span>
                <span className="text-text-sub">Border colour = priority</span>
            </div>

            {/* FullCalendar */}
            <div className="rounded-xl border border-muted-fill bg-surface-raised shadow-sm overflow-hidden fc-wrapper">
                <FullCalendar
                    ref={calendarRef}
                    plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
                    initialView="dayGridMonth"
                    headerToolbar={{
                        left: 'prev,next today',
                        center: 'title',
                        right: 'dayGridMonth,listMonth',
                    }}
                    height="auto"
                    events={events}
                    eventClick={handleEventClick}
                    eventDisplay="block"
                    dayMaxEvents={3}
                    moreLinkContent={(args) => `+${args.num} more`}
                    nowIndicator
                    buttonText={{
                        today: 'Today',
                        month: 'Month',
                        listMonth: 'List',
                    }}
                    /* Style tweaks via inline CSS vars */
                    eventClassNames="cursor-pointer rounded-md text-xs font-medium px-1"
                    dayCellClassNames="hover:bg-muted-fill transition-colors"
                />
            </div>

            {/* Scoped style overrides to match your Tailwind UI */}
            <style>{`
        .fc-wrapper .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
            color: var(--color-text-strong);
        }
        .fc-wrapper .fc-button {
          background: var(--color-surface-raised) !important;
          border: 1px solid var(--color-border) !important;
          color: var(--color-text-body) !important;
          border-radius: 0.5rem !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          padding: 0.25rem 0.75rem !important;
          box-shadow: none !important;
          text-transform: capitalize !important;
        }
        .fc-wrapper .fc-button:hover {
          background: var(--color-muted-fill) !important;
        }
        .fc-wrapper .fc-button-active,
        .fc-wrapper .fc-button-primary:not(:disabled).fc-button-active {
          background: var(--color-accent) !important;
          border-color: var(--color-accent) !important;
            color: var(--color-surface-raised) !important;
        }
        .fc-wrapper .fc-col-header-cell {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-sub);
          padding: 0.5rem 0;
        }
        .fc-wrapper .fc-daygrid-day-number {
          font-size: 0.8rem;
          color: var(--color-text-body);
          padding: 0.25rem 0.5rem;
        }
        .fc-wrapper .fc-day-today {
          background: var(--color-accent-light) !important;
        }
        .fc-wrapper .fc-day-today .fc-daygrid-day-number {
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
        .fc-wrapper .fc-more-link {
          font-size: 0.7rem;
          color: var(--color-text-sub);
        }
        .fc-wrapper .fc-list-event:hover td {
          background: var(--color-muted-fill);
        }
        .fc-wrapper .fc-list-day-cushion {
          background: var(--color-surface);
        }
        .fc-wrapper td, .fc-wrapper th {
          border-color: var(--color-border) !important;
        }
      `}</style>
        </div>
    );
}