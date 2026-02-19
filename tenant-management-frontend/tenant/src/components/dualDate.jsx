import React, { useState, useRef, useEffect } from "react";
import { NepaliDatePicker } from "nepali-datepicker-reactjs";
import "nepali-datepicker-reactjs/dist/index.css";
import dateConverter from "nepali-datetime/dateConverter";

const DualCalendarTailwind = ({ onChange, value }) => {
  const [nepaliDate, setNepaliDate] = useState("");
  const [englishDate, setEnglishDate] = useState(value || "");
  const [showCalendar, setShowCalendar] = useState(false);

  const calendarRef = useRef(null);

  /* -------------------- helpers -------------------- */

  const formatDate = (y, m, d) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  useEffect(() => {
    if (value !== undefined && value !== englishDate) {
      setEnglishDate(value);
      if (value) {
        const [enYear, enMonthHuman, enDay] = value.split("-").map(Number);
        const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
          enYear,
          enMonthHuman - 1,
          enDay
        );
        setNepaliDate(formatDate(npYear, npMonth0 + 1, npDay));
      } else {
        setNepaliDate("");
      }
    }
  }, [value, englishDate]);

  /* -------------------- outside click -------------------- */

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* -------------------- BS → AD -------------------- */
  const handleNepaliChange = (bsDate) => {
    if (!bsDate) return;
    const cleaned = bsDate.split(" ")[0];
    setNepaliDate(cleaned);
    const [bsYear, bsMonthHuman, bsDay] = cleaned.split("-").map(Number);
    const [enYear, enMonth0, enDay] = dateConverter.nepaliToEnglish(
      bsYear,
      bsMonthHuman - 1,
      bsDay
    );
    const formattedEnglish = formatDate(enYear, enMonth0 + 1, enDay);
    setEnglishDate(formattedEnglish);
    onChange?.(formattedEnglish, cleaned);
    setShowCalendar(false);
  };

  /* -------------------- AD → BS -------------------- */
  const handleEnglishChange = (e) => {
    const adDate = e.target.value;
    setEnglishDate(adDate);
    if (!adDate) {
      setNepaliDate("");
      onChange?.("", "");
      return;
    }
    const [enYear, enMonthHuman, enDay] = adDate.split("-").map(Number);
    const [npYear, npMonth0, npDay] = dateConverter.englishToNepali(
      enYear,
      enMonthHuman - 1,
      enDay
    );
    const formattedNepali = formatDate(npYear, npMonth0 + 1, npDay);
    setNepaliDate(formattedNepali);
    onChange?.(adDate, formattedNepali);
    setShowCalendar(false);
  };

  /* -------------------- UI -------------------- */

  return (
    <div className="relative w-full">
      <input
        type="text"
        readOnly
        value={englishDate && nepaliDate ? `${englishDate} / ${nepaliDate}` : ""}
        placeholder="Select Date"
        onClick={() => setShowCalendar(true)}
        className="w-full cursor-pointer rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {showCalendar && (
        <div
          ref={calendarRef}
          className="
            absolute z-50 mt-2 rounded-md border bg-white p-4 shadow-lg
            left-0 right-0
            flex flex-col gap-4
            sm:flex-row sm:w-max sm:min-w-full sm:right-auto
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