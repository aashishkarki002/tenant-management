import {
    Flame,
    Droplets,
    Zap,
    Camera,
    Car,
    Waves,
    LayoutGrid,
} from "lucide-react";

export const DATE_NAV_MAX_DAYS_BACK = 3;

export const CATEGORY_META = {
    FIRE: { icon: Flame, label: "Fire Safety", urgency: "critical", iconBg: "bg-red-100", iconColor: "text-red-600", color: "#ef4444" },
    WATER_TANK: { icon: Droplets, label: "Water Tanks", urgency: "high", iconBg: "bg-blue-100", iconColor: "text-blue-600", color: "#3b82f6" },
    ELECTRICAL: { icon: Zap, label: "Electrical", urgency: "high", iconBg: "bg-yellow-100", iconColor: "text-yellow-600", color: "#f59e0b" },
    CCTV: { icon: Camera, label: "CCTV", urgency: null, iconBg: "bg-purple-100", iconColor: "text-purple-600", color: "#8b5cf6" },
    PARKING: { icon: Car, label: "Parking", urgency: null, iconBg: "bg-stone-100", iconColor: "text-stone-600", color: "#78716c" },
    SANITARY: { icon: Waves, label: "Sanitary", urgency: null, iconBg: "bg-cyan-100", iconColor: "text-cyan-600", color: "#06b6d4" },
    COMMON_AREA: { icon: LayoutGrid, label: "Common Areas", urgency: null, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", color: "#10b981" },
};

export const ALL_CATEGORIES = [
    "FIRE", "WATER_TANK", "ELECTRICAL", "CCTV", "PARKING", "SANITARY", "COMMON_AREA",
];

export const CHECKLIST_HISTORY_FETCH_LIMIT = 200;
export const CHECKLIST_HISTORY_DAY_SLICE = 30;
