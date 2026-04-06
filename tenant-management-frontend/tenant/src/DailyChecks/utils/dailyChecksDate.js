import {
    getTodayNepali,
    jsDateToNepali,
    NEPALI_MONTH_NAMES,
} from "@/utils/nepaliDate";

export function formatTime(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleTimeString("en-NP", {
        hour: "2-digit", minute: "2-digit", hour12: true,
    });
}

export function getNepaliDay(daysBack) {
    if (daysBack === 0) {
        const ndt = getTodayNepali();
        return {
            bsYear: ndt.year,
            bsMonth: ndt.month,
            bsDay: ndt.day,
            nepaliISO: ndt.isoString,
            monthName: ndt.monthName,
        };
    }
    const shifted = new Date();
    shifted.setDate(shifted.getDate() - daysBack);
    const ndt = jsDateToNepali(shifted);
    return {
        bsYear: ndt.year,
        bsMonth: ndt.month,
        bsDay: ndt.day,
        nepaliISO: ndt.isoString,
        monthName: ndt.monthName ?? NEPALI_MONTH_NAMES[ndt.month - 1],
    };
}
