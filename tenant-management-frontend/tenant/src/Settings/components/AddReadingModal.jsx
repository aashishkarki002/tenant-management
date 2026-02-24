import { useState } from "react";
import api from "../../../plugins/axios";
import { Button } from "@/components/ui/button";
import { METER_TYPE_META, NEPALI_MONTHS } from "./constants";
import Modal from "./Modal";
import MeterTypeBadge from "../../submeter/components/MeterTypeBadge";

export default function AddReadingModal({ subMeter, onClose, onSuccess }) {
  const today = new Date();

  // Safely initialise Nepali date — NepaliDate may not be available in all envs
  let defaultNpYear = new Date().getFullYear() + 57; // rough BS approximation
  let defaultNpMonth = today.getMonth() + 1;
  try {
    const NepaliDate = require("nepali-datetime").default;
    const npToday = new NepaliDate(today);
    defaultNpYear = npToday.getYear();
    defaultNpMonth = npToday.getMonth() + 1;
  } catch (_) { }

  const [form, setForm] = useState({
    currentReading: "",
    nepaliYear: defaultNpYear,
    nepaliMonth: defaultNpMonth,
    nepaliDate: `${NEPALI_MONTHS[defaultNpMonth - 1]} ${defaultNpYear}`,
    englishMonth: today.getMonth() + 1,
    englishYear: today.getFullYear(),
    readingDate: today.toISOString().split("T")[0],
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const meta = METER_TYPE_META[subMeter.meterType];
  const lastValue = subMeter.lastReading?.value;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const current = parseFloat(form.currentReading);
    if (isNaN(current) || current < 0) {
      setError("Please enter a valid reading value");
      return;
    }
    if (lastValue != null && current < lastValue) {
      setError(`Reading cannot be less than previous reading (${lastValue})`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.post("/api/electricity/sub-meters/create-reading", {
        subMeterId: subMeter._id,
        currentReading: current,
        nepaliMonth: form.nepaliMonth,
        nepaliYear: form.nepaliYear,
        nepaliDate: form.nepaliDate,
        englishMonth: form.englishMonth,
        englishYear: form.englishYear,
        readingDate: form.readingDate,
        notes: form.notes,
      });
      if (res.data.success) {
        onSuccess(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record reading");
    } finally {
      setSaving(false);
    }
  };

  const consumption =
    form.currentReading !== "" && lastValue != null
      ? Math.max(0, parseFloat(form.currentReading || 0) - lastValue)
      : null;

  return (
    <Modal title={`Record Reading — ${subMeter.name}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <MeterTypeBadge type={subMeter.meterType} />
          {subMeter.locationLabel && (
            <span className="text-sm text-gray-500">{subMeter.locationLabel}</span>
          )}
        </div>

        {/* Previous reading */}
        {lastValue != null && (
          <div className={`p-3 rounded-lg border ${meta.bg} ${meta.border}`}>
            <p className="text-xs text-gray-500 mb-0.5">Previous Reading</p>
            <p className={`text-xl font-bold ${meta.text}`}>
              {lastValue}{" "}
              <span className="text-sm font-normal text-gray-500">kWh</span>
            </p>
            {subMeter.lastReading?.readingDate && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(subMeter.lastReading.readingDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Current reading */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Current Reading (kWh) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            required
            step="0.01"
            min={lastValue ?? 0}
            placeholder={lastValue != null ? `Min: ${lastValue}` : "Enter reading"}
            value={form.currentReading}
            onChange={(e) => setForm((f) => ({ ...f, currentReading: e.target.value }))}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-lg font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Live preview */}
        {consumption !== null && form.currentReading !== "" && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Consumption this period</span>
              <span className="font-semibold text-green-700">
                {consumption.toFixed(2)} kWh
              </span>
            </div>
            {subMeter.currentRatePerUnit && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Estimated charge</span>
                <span className="font-bold text-green-800">
                  Rs {(consumption * subMeter.currentRatePerUnit).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Nepali date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nepali Year
            </label>
            <input
              type="number"
              required
              value={form.nepaliYear}
              onChange={(e) =>
                setForm((f) => ({ ...f, nepaliYear: parseInt(e.target.value) }))
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nepali Month
            </label>
            <select
              value={form.nepaliMonth}
              onChange={(e) => {
                const m = parseInt(e.target.value);
                setForm((f) => ({
                  ...f,
                  nepaliMonth: m,
                  nepaliDate: `${NEPALI_MONTHS[m - 1]} ${f.nepaliYear}`,
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {NEPALI_MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* English date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Reading Date
          </label>
          <input
            type="date"
            value={form.readingDate}
            onChange={(e) => {
              const d = new Date(e.target.value);
              setForm((f) => ({
                ...f,
                readingDate: e.target.value,
                englishMonth: d.getMonth() + 1,
                englishYear: d.getFullYear(),
              }));
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Notes
          </label>
          <input
            type="text"
            placeholder="Optional notes"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex-1  hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : "Record Reading"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
