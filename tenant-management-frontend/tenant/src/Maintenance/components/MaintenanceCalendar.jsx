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
    OPEN: { bg: '#f59e0b', text: '#fff' }, // amber
    IN_PROGRESS: { bg: '#3b82f6', text: '#fff' }, // blue
    COMPLETED: { bg: '#10b981', text: '#fff' }, // emerald
    CANCELLED: { bg: '#9ca3af', text: '#fff' }, // gray
};

const PRIORITY_BORDER = {
    URGENT: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#f59e0b',
    LOW: '#6b7280',
};

const STATUS_BADGE = {
    OPEN: 'bg-amber-100 text-amber-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
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
                className="absolute z-50 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl"
                style={{ top: Math.min(position.y, window.innerHeight - 280), left: Math.min(position.x, window.innerWidth - 300) }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold leading-snug text-gray-900">{m.title}</p>
                    <button onClick={onClose} className="shrink-0 rounded-md p-0.5 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Badges */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[status] ?? STATUS_BADGE.OPEN)}>
                        {status.replace('_', ' ')}
                    </span>
                    {m.priority && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-600">
                            {m.priority} priority
                        </span>
                    )}
                </div>

                {/* Details */}
                <div className="space-y-1.5 text-xs text-gray-500">
                    {m.scheduledDate && (
                        <Row label="Date" value={new Date(m.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} />
                    )}
                    {m.type && <Row label="Type" value={m.type} />}
                    {m.assignedTo?.name && <Row label="Assigned" value={m.assignedTo.name} />}
                    {m.amount > 0 && <Row label="Estimated" value={`₹${Number(m.amount).toLocaleString('en-IN')}`} />}
                    {m.paidAmount > 0 && <Row label="Paid" value={`₹${Number(m.paidAmount).toLocaleString('en-IN')}`} />}
                    {m.description && (
                        <div className="mt-2 rounded-md bg-gray-50 p-2 text-gray-600 leading-relaxed">
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
            <span className="w-16 shrink-0 font-medium text-gray-400">{label}</span>
            <span className="text-gray-700">{value}</span>
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
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                {Object.entries(STATUS_COLOR).map(([status, { bg }]) => (
                    <span key={status} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bg }} />
                        {status.replace('_', ' ')}
                    </span>
                ))}
                <span className="ml-2 text-gray-300">|</span>
                <span className="text-gray-400">Border colour = priority</span>
            </div>

            {/* FullCalendar */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden fc-wrapper">
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
                    dayCellClassNames="hover:bg-gray-50 transition-colors"
                />
            </div>

            {/* Scoped style overrides to match your Tailwind UI */}
            <style>{`
        .fc-wrapper .fc-toolbar-title {
          font-size: 1rem;
          font-weight: 600;
          color: #111827;
        }
        .fc-wrapper .fc-button {
          background: #fff !important;
          border: 1px solid #e5e7eb !important;
          color: #374151 !important;
          border-radius: 0.5rem !important;
          font-size: 0.75rem !important;
          font-weight: 500 !important;
          padding: 0.25rem 0.75rem !important;
          box-shadow: none !important;
          text-transform: capitalize !important;
        }
        .fc-wrapper .fc-button:hover {
          background: #f9fafb !important;
        }
        .fc-wrapper .fc-button-active,
        .fc-wrapper .fc-button-primary:not(:disabled).fc-button-active {
          background: #1e40af !important;
          border-color: #1e40af !important;
          color: #fff !important;
        }
        .fc-wrapper .fc-col-header-cell {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #9ca3af;
          padding: 0.5rem 0;
        }
        .fc-wrapper .fc-daygrid-day-number {
          font-size: 0.8rem;
          color: #374151;
          padding: 0.25rem 0.5rem;
        }
        .fc-wrapper .fc-day-today {
          background: #eff6ff !important;
        }
        .fc-wrapper .fc-day-today .fc-daygrid-day-number {
          background: #2563eb;
          color: #fff;
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
          color: #6b7280;
        }
        .fc-wrapper .fc-list-event:hover td {
          background: #f9fafb;
        }
        .fc-wrapper .fc-list-day-cushion {
          background: #f3f4f6;
        }
        .fc-wrapper td, .fc-wrapper th {
          border-color: #f3f4f6 !important;
        }
      `}</style>
        </div>
    );
}