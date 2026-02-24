import { useState, useCallback } from "react";
import api from "../../../plugins/axios";
import {
  MapPinIcon,
  HashIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { METER_TYPE_META } from "../../Settings/components/constants";
import MeterTypeBadge from "./MeterTypeBadge";

export default function SubMeterCard({ meter, onAddReading, onDeactivate }) {
  const [expanded, setExpanded] = useState(false);
  const [readings, setReadings] = useState([]);
  const [loadingReadings, setLoadingReadings] = useState(false);
  const meta = METER_TYPE_META[meter.meterType];
  const Icon = meta.icon;

  const loadReadings = useCallback(async () => {
    if (readings.length > 0) {
      setExpanded((v) => !v);
      return;
    }
    setLoadingReadings(true);
    try {
      const res = await api.get(
        `/api/electricity/sub-meters/readings/${meter._id}`,
        { params: { limit: 6 } }
      );
      if (res.data.success) setReadings(res.data.data.readings);
    } catch (err) {
      console.error("Failed to load readings", err);
    } finally {
      setLoadingReadings(false);
      setExpanded(true);
    }
  }, [meter._id, readings.length]);

  return (
    <div
      className={`border rounded-2xl overflow-hidden transition-all duration-200 bg-white
        ${meter.isActive ? "border-gray-200 shadow-sm" : "border-gray-100 opacity-60"}`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${meta.bg}`}>
              <Icon className={`w-5 h-5 ${meta.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900 text-sm">{meter.name}</h4>
                {!meter.isActive && (
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full">
                    Inactive
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <MeterTypeBadge type={meter.meterType} />
                {meter.locationLabel && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPinIcon className="w-3 h-3" />
                    {meter.locationLabel}
                  </span>
                )}
              </div>
            </div>
          </div>

          {meter.isActive && (
            <div className="flex gap-1.5 flex-shrink-0">

              <button
                onClick={() => onDeactivate(meter)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Deactivate meter"
              >
                <Trash2Icon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2.5 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Last Reading</p>
            <p className="font-bold text-gray-900 text-sm">
              {meter.lastReading?.value != null ? meter.lastReading.value : "—"}
            </p>
            <p className="text-xs text-gray-400">kWh</p>
          </div>
          <div className="text-center p-2.5 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Rate</p>
            <p className="font-bold text-gray-900 text-sm">
              {meter.currentRatePerUnit != null
                ? `Rs ${meter.currentRatePerUnit.toFixed(2)}`
                : "—"}
            </p>
            <p className="text-xs text-gray-400">/ kWh</p>
          </div>
          <div className="text-center p-2.5 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Readings</p>
            <p className="font-bold text-gray-900 text-sm">{meter.totalReadings ?? 0}</p>
            <p className="text-xs text-gray-400">total</p>
          </div>
        </div>

        {/* Meta info */}
        {(meter.meterSerialNumber || meter.description) && (
          <div className="mt-3 space-y-1">
            {meter.meterSerialNumber && (
              <p className="text-xs text-gray-500 flex items-center gap-1.5">
                <HashIcon className="w-3 h-3" />
                S/N: {meter.meterSerialNumber}
              </p>
            )}
            {meter.description && (
              <p className="text-xs text-gray-500">{meter.description}</p>
            )}
          </div>
        )}

        {/* History toggle */}
        {meter.totalReadings > 0 && (
          <button
            onClick={loadReadings}
            disabled={loadingReadings}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 mt-3 font-medium"
          >
            {loadingReadings ? (
              "Loading..."
            ) : expanded ? (
              <>
                <ChevronUpIcon className="w-3.5 h-3.5" /> Hide history
              </>
            ) : (
              <>
                <ChevronDownIcon className="w-3.5 h-3.5" /> View history
              </>
            )}
          </button>
        )}
      </div>

      {/* Inline reading history */}
      {expanded && readings.length > 0 && (
        <div className={`border-t ${meta.border} ${meta.bg} px-5 py-4`}>
          <p className="text-xs font-semibold text-gray-600 mb-3 uppercase tracking-wide">
            Recent Readings
          </p>
          <div className="space-y-2">
            {readings.map((r, i) => (
              <div
                key={r._id}
                className="flex items-center justify-between py-2 border-b border-white/60 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${i === 0 ? meta.dot : "bg-gray-300"
                      }`}
                  />
                  <div>
                    <p className="text-xs font-medium text-gray-700">{r.nepaliDate}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(r.readingDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-800">
                    {r.consumption} kWh
                  </p>
                  <p className="text-xs text-gray-500">
                    Rs {r.totalAmount?.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
