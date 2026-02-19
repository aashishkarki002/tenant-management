import { useMemo } from "react";
import api from "../../../plugins/axios";
import { Button } from "@/components/ui/button";
import { METER_TYPE_META } from "./constants";
import Modal from "./Modal";
import { Label } from "@/components/ui/Label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormik } from "formik";
import { toast } from "sonner";
import useProperty from "@/hooks/use-property";

export default function CreateSubMeterModal({ propertyId, onClose, onSuccess }) {
  const { property } = useProperty();

  const formik = useFormik({
    initialValues: {
      propertyId: propertyId,
      blockId: "",
      innerBlockId: "",
      name: "",
      meterType: "common_area",
      description: "",
      locationLabel: "",
      meterSerialNumber: "",
      installedOn: "",
    },
    onSubmit: async (values) => {
      try {
        const payload = {
          propertyId: values.propertyId,
          name: values.name,
          meterType: values.meterType,
          description: values.description ?? "",
          locationLabel: values.locationLabel ?? "",
          meterSerialNumber: values.meterSerialNumber ?? "",
          installedOn: values.installedOn || undefined,
          ...(values.blockId && { blockId: values.blockId }),
          ...(values.innerBlockId && { innerBlockId: values.innerBlockId }),
        };
        const res = await api.post("/api/electricity/sub-meters/create", payload);
        if (res.data.success) {
          onSuccess(res.data.data);
          onClose();
        } else {
          toast.error(res.data.error || "Failed to create sub-meter");
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to create sub-meter");
      }
    },
  });

  const blocks = useMemo(() => {
    if (!propertyId || !property || !Array.isArray(property)) return [];
    const prop = property.find((p) => p._id === propertyId);
    return prop?.blocks ?? [];
  }, [propertyId, property]);

  const selectedBlock = useMemo(
    () => blocks.find((b) => b._id === formik.values.blockId),
    [blocks, formik.values.blockId]
  );

  const innerBlocks = useMemo(
    () => (Array.isArray(selectedBlock?.innerBlocks) ? selectedBlock.innerBlocks : []),
    [selectedBlock]
  );

  return (
    <Modal title="Add New Sub-Meter" onClose={onClose}>
      <form onSubmit={formik.handleSubmit} className="space-y-4">


        {/* Meter Type selector */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-2">
            Meter Type <span className="text-red-500">*</span>
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(METER_TYPE_META).map(([type, meta]) => {
              const Icon = meta.icon;
              const isActive = formik.values.meterType === type;

              return (
                <Button
                  key={type}
                  type="button"
                  variant={isActive ? "default" : "outline"}
                  onClick={() => formik.setFieldValue("meterType", type)}
                  className={` gap-1  transition-all
        ${isActive ? "bg-gray-600 text-white hover:bg-gray-700" : ""}
      `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs">{meta.label}</span>
                </Button>
              );
            })}

          </div>
        </div>

        {/* Name */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1.5">
            Meter Name <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            name="name"
            placeholder="e.g. Block A - Main Lobby"
            value={formik.values.name}
            onChange={formik.handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description
          </Label>
          <Textarea
            rows={2}
            name="description"
            placeholder="Short description of this meter's coverage"
            value={formik.values.description}
            onChange={formik.handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* Block (optional) */}
        {blocks.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                Block <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Select
                value={formik.values.blockId || "__none__"}
                onValueChange={(val) => {
                  formik.setFieldValue("blockId", val === "__none__" ? "" : val);
                  formik.setFieldValue("innerBlockId", "");
                }}
              >
                <SelectTrigger className="w-full h-9 border border-gray-300 rounded-lg bg-white">
                  <SelectValue placeholder="Select block" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {blocks.map((block) => (
                    <SelectItem key={block._id} value={block._id}>
                      {block.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Inner Block (optional) - only when block selected and has inner blocks */}
            {formik.values.blockId && innerBlocks.length > 0 && (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Inner Block <span className="text-gray-400 font-normal">(optional)</span>
                </Label>
                <Select
                  value={formik.values.innerBlockId || "__none__"}
                  onValueChange={(val) =>
                    formik.setFieldValue("innerBlockId", val === "__none__" ? "" : val)
                  }
                >
                  <SelectTrigger className="w-full h-9 border border-gray-300 rounded-lg bg-white">
                    <SelectValue placeholder="Select inner block" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {innerBlocks.map((ib) => (
                      <SelectItem key={ib._id} value={ib._id}>
                        {ib.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1.5">
              Location Label
            </Label>
            <Input
              type="text"
              name="locationLabel"
              placeholder="e.g. Block A"
              value={formik.values.locationLabel}
              onChange={formik.handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <Label className="block text-sm font-medium text-gray-700 mb-1.5">
              Serial Number
            </Label>
            <Input
              type="text"
              name="meterSerialNumber"
              placeholder="e.g. NEA-001234"
              value={formik.values.meterSerialNumber}
              onChange={formik.handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <Label className="block text-sm font-medium text-gray-700 mb-1.5">
            Installation Date
          </Label>
          <Input
            type="date"
            name="installedOn"
            value={formik.values.installedOn}
            onChange={formik.handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={formik.isSubmitting}
            className="flex-1  hover:bg-blue-700 text-white"
          >
            {formik.isSubmitting ? "Creating..." : "Create Meter"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
