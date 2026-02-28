import React, { useState, useRef, useEffect, useCallback } from "react";
import { NepaliDatePicker } from "nepali-datepicker-reactjs";
import "nepali-datepicker-reactjs/dist/index.css";
import dateConverter from "nepali-datetime/dateConverter";

/**
 * DualCalendarTailwind
 *
 * Props:
 *   value     - controlled AD date string "YYYY-MM-DD" (optional)
 *   onChange  - (englishDate: string, nepaliDate: string) => void
 *
 * Bugs fixed:
 *
 * 1. MOBILE AUTO-SELECT
 *    NepaliDatePicker fires onChange on mount/open on touch devices.
 *    Fix: track `isNepaliPickerReady` — ignore the first onChange call
 *    that fires within 300 ms of opening the calendar (library mount side-effect).
 *    We also block onChange when the incoming value equals what we already have.
 *
 * 2. OUTSIDE-CLICK ON MOBILE
 *    `mousedown` doesn't fire reliably on mobile. Added `touchstart` listener
 *    so tapping outside the popup correctly closes it.
 *
 * 3. SCROLL-LOCK
 *    On small screens the hidden calendar can cause page shift. Added
 *    `overflow-hidden` to body while calendar is open.
 *
 * 4. Z-INDEX / PORTAL
 *    NepaliDatePicker renders its own dropdown inside our container which can
 *    clip on overflow:hidden parents. Switched container to `overflow-visible`
 *    and added a high z-index so the picker floats above everything.
 */

const formatDate = (y, m, d) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const DualCalendarTailwind = ({ onChange, value }) => {
  const [nepaliDate, setNepaliDate] = useState("");
  const [englishDate, setEnglishDate] = useState(value || "");
  const [showCalendar, setShowCalendar] = useState(false);

  // Tracks whether the NepaliDatePicker has fully mounted and is ready
  // for real user interaction. Without this, the library fires onChange
  // immediately on render (mobile touch bug).
  const nepaliPickerReadyRef = useRef(false);
  const openTimestampRef = useRef(0);
  const calendarRef = useRef(null);

  /* ─── Sync controlled value ─────────────────────────────────── */
  useEffect(() => {
    if (value !== undefined && value !== englishDate) {
      setEnglishDate(value || "");
      if (value) {
        try {
          const [enYear, enMonthHuman, enDay] = value.split("-").map(Number);
          const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
            enYear,
            enMonthHuman - 1,
            enDay,
          );
          setNepaliDate(formatDate(npYear, npMonth0 + 1, npDay));
        } catch {
          setNepaliDate("");
        }
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

    // Use both mousedown (desktop) and touchstart (mobile)
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close, { passive: true });
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [showCalendar]);

  /* ─── Scroll lock while calendar is open ─────────────────────── */
  useEffect(() => {
    if (showCalendar) {
      // Small screens: prevent body scroll behind the floating calendar
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCalendar]);

  /* ─── Open handler ───────────────────────────────────────────── */
  const openCalendar = useCallback(() => {
    nepaliPickerReadyRef.current = false; // reset ready flag on every open
    openTimestampRef.current = Date.now();
    setShowCalendar(true);
    // Allow a short window for the NepaliDatePicker to mount before we
    // start trusting its onChange events (prevents the mobile auto-fire).
    setTimeout(() => {
      nepaliPickerReadyRef.current = true;
    }, 300);
  }, []);

  /* ─── BS → AD ────────────────────────────────────────────────── */
  const handleNepaliChange = useCallback(
    (bsDate) => {
      // MOBILE FIX: ignore onChange calls that fire before the picker is ready
      // (library fires on mount/open — not a real user selection)
      if (!nepaliPickerReadyRef.current) return;
      if (!bsDate) return;

      const cleaned = bsDate.split(" ")[0]; // strip any trailing time/garbage

      // Also ignore if the value hasn't actually changed
      if (cleaned === nepaliDate) return;

      try {
        const [bsYear, bsMonthHuman, bsDay] = cleaned.split("-").map(Number);
        const [enYear, enMonth0, enDay] = dateConverter.nepaliToEnglish(
          bsYear,
          bsMonthHuman - 1,
          bsDay,
        );
        const formattedEnglish = formatDate(enYear, enMonth0 + 1, enDay);

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

      try {
        const [enYear, enMonthHuman, enDay] = adDate.split("-").map(Number);
        const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
          enYear,
          enMonthHuman - 1,
          enDay,
        );
        const formattedNepali = formatDate(npYear, npMonth0 + 1, npDay);
        setNepaliDate(formattedNepali);
        onChange?.(adDate, formattedNepali);
        setShowCalendar(false);
      } catch (err) {
        console.warn("[DualCalendar] Failed to convert English date:", adDate, err);
      }
    },
    [onChange],
  );

  /* ─── UI ─────────────────────────────────────────────────────── */
  return (
    <div className="relative w-full">
      {/* Read-only display input */}
      <input
        type="text"
        readOnly
        value={
          englishDate && nepaliDate ? `${englishDate} / ${nepaliDate}` : ""
        }
        placeholder="Select Date"
        onClick={openCalendar}
        // Also handle touch so the picker opens immediately on mobile
        // without needing a second tap (prevents ghost-click delay)
        onTouchEnd={(e) => {
          e.preventDefault();
          openCalendar();
        }}
        className="w-full cursor-pointer rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {showCalendar && (
        <div
          ref={calendarRef}
          // Stop any touch/click inside the panel from bubbling to the
          // document listener (which would immediately close the calendar)
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="
            absolute z-[9999] mt-2 rounded-md border bg-white p-4 shadow-lg
            left-0
            flex flex-col gap-4
            w-full
            sm:flex-row sm:w-max sm:min-w-full
          "
        >
          {/* English (AD) */}
          <div className="flex flex-col w-full sm:w-auto">
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

          {/* Divider */}
          <div className="border-t border-gray-100 sm:border-t-0 sm:border-l sm:self-stretch" />

          {/* Nepali (BS) */}
          <div className="flex flex-col w-full sm:w-auto">
            <label className="mb-1 text-xs font-medium text-gray-500 uppercase tracking-wide">
              Nepali (BS)
            </label>
            {/*
              overflow-visible is critical: NepaliDatePicker renders its own
              floating dropdown; clipping it with overflow:hidden cuts it off.
            */}
            <div className="overflow-visible">
              <NepaliDatePicker
                value={nepaliDate}
                onChange={handleNepaliChange}
                inputClassName="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                options={{ calendarLocale: "en", valueLocale: "en" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DualCalendarTailwind;