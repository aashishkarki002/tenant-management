import { useState } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { METER_TYPE_META } from "./constants";
import { Input } from "@/components/ui/input";
import Modal from "./Modal";
import { Label } from "@/components/ui/Label";

export default function RateFormDialog({ propertyId, rateData, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    ratePerUnit: rateData?.currentRatePerUnit?.toString() ?? "",
    note: "",
    // Per-type overrides — includes "unit" for tenant-billed readings
    unit: rateData?.meterTypeRates?.unit?.toString() ?? "",
    common_area: rateData?.meterTypeRates?.common_area?.toString() ?? "",
    parking: rateData?.meterTypeRates?.parking?.toString() ?? "",
    sub_meter: rateData?.meterTypeRates?.sub_meter?.toString() ?? "",
  });

  // All four meter types that can have a per-type rate override.
  // "unit" is first — it's the most commonly overridden type (tenant billing).
  const PER_TYPE_FIELDS = [
    { key: "unit", label: "Unit (Tenant)", meta: METER_TYPE_META.unit },
    { key: "common_area", label: "Common Area", meta: METER_TYPE_META.common_area },
    { key: "parking", label: "Parking", meta: METER_TYPE_META.parking },
    { key: "sub_meter", label: "Sub-Meter", meta: METER_TYPE_META.sub_meter },
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rate = parseFloat(form.ratePerUnit);
    if (!rate || rate <= 0) {
      toast.error("Please enter a valid rate per unit");
      return;
    }
    setSaving(true);
    try {
      // Build meterTypeRates — send all four keys so the backend can
      // clear overrides that were blanked out by the user.
      const meterTypeRates = {};
      for (const { key } of PER_TYPE_FIELDS) {
        const val = form[key];
        // Non-empty positive value → set override; empty string → clear override
        meterTypeRates[key] = val !== "" && parseFloat(val) > 0
          ? parseFloat(val)
          : null;
      }

      const res = await api.post(`/api/electricity/rate/${propertyId}`, {
        ratePerUnit: rate,
        note: form.note || "",
        meterTypeRates,
      });
      if (res.data.success) {
        toast.success(res.data.message || "Rate updated successfully");
        onSaved();
        onClose();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update rate");
    } finally {
      setSaving(false);
    }
  };

  const previewBill = form.ratePerUnit
    ? (250 * parseFloat(form.ratePerUnit || 0)).toFixed(2)
    : null;

  return (
    <Modal
      title={rateData?.configured ? "Update Electricity Rate" : "Set Electricity Rate"}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Default rate */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1.5">
            Default Rate (Rs / kWh) <span className="text-red-500">*</span>
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
              Rs
            </span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max="999"
              required
              autoFocus
              placeholder="12.50"
              value={form.ratePerUnit}
              onChange={(e) => setForm((f) => ({ ...f, ratePerUnit: e.target.value }))}
              className="w-full pl-9 pr-16 py-2.5 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">
              / kWh
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Applies to all meter types unless overridden below
          </p>
        </div>

        {/* Live bill preview */}
        {previewBill && (
          <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm">
            <span className="text-gray-500">250 kWh × Rs {parseFloat(form.ratePerUnit).toFixed(2)}</span>
            <span className="font-bold text-blue-700">= Rs {previewBill}</span>
          </div>
        )}

        {/* Per-type overrides — 2-column grid to fit all four types */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-sm font-medium text-gray-700">Per-Type Overrides</p>
            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
              optional
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {PER_TYPE_FIELDS.map(({ key, label, meta }) => {
              const Icon = meta.icon;
              return (
                <div key={key}>
                  <label className={`flex items-center gap-1 text-xs font-medium mb-1.5 ${meta.text}`}>
                    <Icon className="w-3 h-3" />
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      Rs
                    </span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="999"
                      placeholder="—"
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                      className={`w-full h-9 bg-gray-100 ${meta.border} ${meta.bg}`}
                    />
                  </div>
                  {form[key] && parseFloat(form[key]) > 0 && form.ratePerUnit && (
                    <p className={`text-xs mt-1 ${meta.text}`}>
                      250 kWh = Rs {(250 * parseFloat(form[key])).toFixed(2)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Leave blank to use the default rate. Clear a field to remove its override.
          </p>
        </div>

        {/* Note */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1.5">
            Note{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </Label>
          <Input
            type="text"
            placeholder="e.g. NEA tariff revision Q1 2082"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full h-9 bg-gray-100"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="flex-1  text-white"
          >
            {saving
              ? "Saving..."
              : rateData?.configured
                ? "Update Rate"
                : "Set Rate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}