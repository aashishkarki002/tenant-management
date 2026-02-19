import { METER_TYPE_META } from "./constants";

export default function MeterTypeBadge({ type }) {
  const meta = METER_TYPE_META[type];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.badge}`}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}
