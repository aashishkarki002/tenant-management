import React, { useState, useRef, useEffect, useCallback } from "react";
import { NepaliDatePicker } from "nepali-datepicker-reactjs";
import "nepali-datepicker-reactjs/dist/index.css";
import dateConverter from "nepali-datetime/dateConverter";
import { adIsoToBsIso, formatNepaliISO } from "@/utils/nepaliDate";

/**
 * DualCalendarTailwind
 *
 * Props:
 *   value     - controlled AD date string "YYYY-MM-DD" (optional)
 *   onChange  - (englishDate: string, nepaliDate: string) => void
 */
const DualCalendarTailwind = ({ onChange, value }) => {
  const [nepaliDate, setNepaliDate] = useState("");
  const [englishDate, setEnglishDate] = useState(value || "");
  const [showCalendar, setShowCalendar] = useState(false);

  // true after the mount-burst window has passed; blocks library's auto-fire onChange
  const nepaliPickerReadyRef = useRef(false);
  const calendarRef = useRef(null);

  /* ─── Sync controlled value ─────────────────────────────────── */
  useEffect(() => {
    if (value !== undefined && value !== englishDate) {
      setEnglishDate(value || "");
      if (value) {
        const bs = adIsoToBsIso(value);
        setNepaliDate(bs || "");
      } else {
        setNepaliDate("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  /* ─── Outside click / tap ────────────────────────────────────── */
  useEffect(() => {
    if (!showCalendar) return;

    const close = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [showCalendar]);

  /* ─── Escape key ─────────────────────────────────────────────── */
  useEffect(() => {
    if (!showCalendar) return;
    const onKey = (e) => {
      if (e.key === "Escape") setShowCalendar(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showCalendar]);

  /* ─── Open handler ───────────────────────────────────────────── */
  const openCalendar = useCallback(() => {
    nepaliPickerReadyRef.current = false;
    setShowCalendar(true);
    // Give the NepaliDatePicker enough time to finish mounting before we
    // trust its onChange events. 500 ms covers slower Android WebViews.
    setTimeout(() => {
      nepaliPickerReadyRef.current = true;
    }, 500);
  }, [nepaliDate]);

  /* ─── BS → AD ────────────────────────────────────────────────── */
  const handleNepaliChange = useCallback(
    (bsDate) => {
      if (!bsDate) return;
      const cleaned = bsDate.split(" ")[0];

      // MOBILE AUTO-FIRE FIX: the library fires onChange on mount regardless
      // of what value is set. Block ALL events until the mount window passes.
      // 500 ms covers slow Android WebViews where the burst fires later.
      if (!nepaliPickerReadyRef.current) return;

      // Same date re-selected: just close without re-firing onChange.
      // This also fixes the "can't select today" bug — previously this guard
      // returned early without closing, leaving the calendar stuck open.
      if (cleaned === nepaliDate) {
        setShowCalendar(false);
        return;
      }

      try {
        const [bsYear, bsMonthHuman, bsDay] = cleaned.split("-").map(Number);
        const [enYear, enMonth0, enDay] = dateConverter.nepaliToEnglish(
          bsYear,
          bsMonthHuman - 1,
          bsDay,
        );
        const formattedEnglish = formatNepaliISO(enYear, enMonth0 + 1, enDay);

        setNepaliDate(cleaned);
        setEnglishDate(formattedEnglish);
        onChange?.(formattedEnglish, cleaned);
        setShowCalendar(false);
      } catch (err) {
        console.warn("[DualCalendar] Failed to convert Nepali date:", bsDate, err);
      }
    },
    [nepaliDate, onChange],
  );

  /* ─── AD → BS ────────────────────────────────────────────────── */
  const handleEnglishChange = useCallback(
    (e) => {
      const adDate = e.target.value;
      setEnglishDate(adDate);

      if (!adDate) {
        setNepaliDate("");
        onChange?.("", "");
        return;
      }

      const formattedNepali = adIsoToBsIso(adDate);
      if (!formattedNepali) {
        console.warn("[DualCalendar] Failed to convert English date:", adDate);
        return;
      }
      setNepaliDate(formattedNepali);
      onChange?.(adDate, formattedNepali);
      setShowCalendar(false);
    },
    [onChange],
  );

  /* ─── Today shortcut ─────────────────────────────────────────── */
  const handleToday = useCallback(() => {
    const todayAD = new Date().toISOString().slice(0, 10);
    const todayBS = adIsoToBsIso(todayAD);
    if (!todayBS) return;
    setEnglishDate(todayAD);
    setNepaliDate(todayBS);
    onChange?.(todayAD, todayBS);
    setShowCalendar(false);
  }, [onChange]);

  /* ─── Clear ──────────────────────────────────────────────────── */
  const handleClear = useCallback(
    (e) => {
      e.stopPropagation();
      setEnglishDate("");
      setNepaliDate("");
      onChange?.("", "");
    },
    [onChange],
  );

  const displayValue =
    englishDate && nepaliDate ? `${nepaliDate}  ·  ${englishDate}` : "";

  /* ─── UI ─────────────────────────────────────────────────────── */
  return (
    <div className="relative w-full">
      {/* Trigger — shows BS date first since that's the primary calendar */}
      <div className="relative flex items-center">
        <input
          type="text"
          readOnly
          value={displayValue}
          placeholder="Select date"
          onClick={openCalendar}
          onTouchEnd={(e) => {
            e.preventDefault();
            openCalendar();
          }}
          className="w-full cursor-pointer rounded-md border px-3 py-2 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        {displayValue && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear date"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-base leading-none"
          >
            ×
          </button>
        )}
      </div>

      {showCalendar && (
        <div
          ref={calendarRef}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="absolute z-[9999] mt-1 rounded-md border bg-white shadow-lg left-0 w-full sm:w-max sm:min-w-full"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Nepali (BS) — primary, shown first */}
            <div className="flex flex-col p-4 w-full sm:w-auto">
              <label className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Nepali (BS)
              </label>
              {/* overflow-visible is critical: NepaliDatePicker renders its own
                  floating dropdown and gets clipped by overflow:hidden parents */}
              <div className="overflow-visible">
                <NepaliDatePicker
                  value={nepaliDate}
                  onChange={handleNepaliChange}
                  inputClassName="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  options={{ calendarLocale: "en", valueLocale: "en" }}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 sm:border-t-0 sm:border-l sm:self-stretch" />

            {/* English (AD) */}
            <div className="flex flex-col p-4 w-full sm:w-auto">
              <label className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
                English (AD)
              </label>
              <input
                type="date"
                value={englishDate}
                onChange={handleEnglishChange}
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between">
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setShowCalendar(false)}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DualCalendarTailwind;
