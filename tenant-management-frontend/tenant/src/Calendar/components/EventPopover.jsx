import { X } from "lucide-react";

const paisaToRupees = (p) =>
  Number(p / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });

/**
 * Click-to-open detail popover for a calendar event.
 * Renders next to the cursor, bounded to the viewport.
 */
export default function EventPopover({ event, position, onClose, eventTypes }) {
  const props = event.extendedProps ?? {};
  const type = props.type;
  const config = eventTypes[type] ?? { label: type ?? "Event", color: "#888" };

  const POPOVER_W = 288;
  const POPOVER_H = 280;
  const MARGIN = 12;
  const top = Math.max(
    MARGIN,
    Math.min(position.y + MARGIN, window.innerHeight - POPOVER_H - MARGIN)
  );
  const left = Math.max(
    MARGIN,
    Math.min(position.x + MARGIN, window.innerWidth - POPOVER_W - MARGIN)
  );

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className="absolute z-50 w-72 rounded-xl border border-border bg-background p-4 shadow-xl"
        style={{ top, left }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Type label + close */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: config.color }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-sub">
              {config.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center h-6 w-6 rounded-md text-text-sub hover:bg-muted-fill"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-text-strong mb-3 leading-snug">
          {event.title}
        </p>

        {/* Details */}
        <div className="space-y-1.5 text-xs">
          <Row
            label="Date"
            value={new Date(event.start).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          {props.nepaliDate && <Row label="BS" value={props.nepaliDate} />}
          {props.status && (
            <Row label="Status" value={props.status.replace(/_/g, " ")} />
          )}
          {props.priority && <Row label="Priority" value={props.priority} />}
          {props.tenantName && <Row label="Tenant" value={props.tenantName} />}
          {props.assignedTo && <Row label="Assigned" value={props.assignedTo} />}
          {props.category && (
            <Row
              label="Category"
              value={props.category.replace(/_/g, " ")}
            />
          )}
          {props.hasIssues && (
            <Row
              label="Issues"
              value={`${props.failedItems ?? 0} found`}
              danger
            />
          )}
          {props.grossRentAmountPaisa > 0 && (
            <Row
              label="Amount"
              value={`Rs. ${paisaToRupees(props.grossRentAmountPaisa)}`}
            />
          )}
          {props.amountPaisa > 0 && (
            <Row
              label="Est. Cost"
              value={`Rs. ${paisaToRupees(props.amountPaisa)}`}
            />
          )}
          {props.description && (
            <div className="mt-2 rounded-md bg-muted-fill p-2 text-text-sub leading-relaxed">
              {props.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, danger }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-16 shrink-0 font-medium text-text-sub">{label}</span>
      <span className={danger ? "text-destructive font-medium" : "text-text-strong capitalize"}>
        {value}
      </span>
    </div>
  );
}
