import { BuildingIcon, CarIcon, ServerIcon, HomeIcon } from "lucide-react";
import { NEPALI_MONTH_NAMES } from "@/utils/nepaliDate";

export const METER_TYPE_META = {
  unit: {
    label: "Unit (Tenant)",
    icon: HomeIcon,
    bg: "bg-green-50",
    text: "text-green-600",
    border: "border-green-200",
    badge: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  common_area: {
    label: "Common Area",
    icon: BuildingIcon,
    bg: "bg-blue-50",
    text: "text-blue-600",
    border: "border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
  parking: {
    label: "Parking",
    icon: CarIcon,
    bg: "bg-amber-50",
    text: "text-amber-600",
    border: "border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
  },
  sub_meter: {
    label: "Sub-Meter",
    icon: ServerIcon,
    bg: "bg-purple-50",
    text: "text-purple-600",
    border: "border-purple-200",
    badge: "bg-purple-100 text-purple-700",
    dot: "bg-purple-500",
  },
};

/** English month names in BS order (same reference as `@/utils/nepaliDate`). */
export const NEPALI_MONTHS = NEPALI_MONTH_NAMES;
