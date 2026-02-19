import React, { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PlusCircleIcon,
  PlusIcon,
  GaugeIcon,
  CheckCircleIcon,
  ToggleLeftIcon,
  ActivityIcon,
} from "lucide-react";
import { METER_TYPE_META } from "./constants";
import CreateSubMeterModal from "./CreateSubMeterModal";
import AddReadingModal from "./AddReadingModal";
import SubMeterCard from "./SubMeterCard";

export default function SubMetersTab({ propertyId }) {
  const [meters, setMeters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [readingTarget, setReadingTarget] = useState(null);

  const loadMeters = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const res = await api.get("/api/electricity/sub-meters", {
        params: { propertyId },
      });
      if (res.data?.success) setMeters(res.data.data?.subMeters ?? []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sub-meters");
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (propertyId) {
      loadMeters();
    }
  }, [propertyId, loadMeters]);

  const handleCreated = (newMeter) => {
    setMeters((prev) => [newMeter, ...prev]);
    toast.success("Sub-meter created successfully");
  };

  const handleReadingSuccess = () => {
    loadMeters();
    toast.success("Reading recorded successfully");
  };

  const handleDeactivate = async (meter) => {
    if (
      !window.confirm(
        `Deactivate "${meter.name}"? Reading history will be preserved.`
      )
    )
      return;
    try {
      await api.delete(`/api/electricity/sub-meters/deactivate/${meter._id}`);
      setMeters((prev) =>
        prev.map((m) => (m._id === meter._id ? { ...m, isActive: false } : m))
      );
      toast.success("Sub-meter deactivated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to deactivate");
    }
  };

  const active = meters.filter((m) => m.isActive);
  const inactive = meters.filter((m) => !m.isActive);
  const totalReadings = meters.reduce((s, m) => s + (m.totalReadings ?? 0), 0);

  const filtered =
    filterType === "all" ? meters : meters.filter((m) => m.meterType === filterType);



  return (
    <div className="mt-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Sub-Meters</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage meters for common areas, parking &amp; shared infrastructure
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2  text-white rounded-xl px-4 py-2.5"
        >
          <PlusCircleIcon className="w-4 h-4" />
          Add Meter
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Meters", value: meters.length, icon: GaugeIcon },
          { label: "Active", value: active.length, icon: CheckCircleIcon },
          { label: "Inactive", value: inactive.length, icon: ToggleLeftIcon },
          { label: "Total Readings", value: totalReadings, icon: ActivityIcon },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {["all", "common_area", "parking", "sub_meter"].map((type) => {
          const isSelected = filterType === type;
          const meta = type !== "all" ? METER_TYPE_META[type] : null;
          const count =
            type === "all"
              ? meters.length
              : meters.filter((m) => m.meterType === type).length;

          return (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border
                ${isSelected
                  ? meta
                    ? `${meta.bg} ${meta.text} ${meta.border}`
                    : "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
                }`}
            >
              {meta?.icon &&
                React.createElement(meta.icon, { className: "w-3.5 h-3.5" })}
              {type === "all" ? "All" : METER_TYPE_META[type].label}
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ml-0.5
                  ${isSelected ? "bg-white/30" : "bg-gray-100 text-gray-600"}`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          <GaugeIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No sub-meters found</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {filterType !== "all"
              ? "Try a different filter or add a new meter"
              : "Add your first meter to start tracking"}
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            variant="outline"
            className="gap-2"
          >
            <PlusIcon className="w-4 h-4" />
            Add Meter
          </Button>
        </div>
      )}

      {/* Meter grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((meter) => (
            <SubMeterCard
              key={meter._id}
              meter={meter}
              onAddReading={setReadingTarget}
              onDeactivate={handleDeactivate}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateSubMeterModal
          propertyId={propertyId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreated}
        />
      )}
      {readingTarget && (
        <AddReadingModal
          subMeter={readingTarget}
          onClose={() => setReadingTarget(null)}
          onSuccess={handleReadingSuccess}
        />
      )}
    </div>
  );
}
