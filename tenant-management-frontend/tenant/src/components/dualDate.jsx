// DualCalendarTailwind.jsx
import React, { useState, useRef, useEffect } from "react";
import { NepaliDatePicker } from "nepali-datepicker-reactjs";
import "nepali-datepicker-reactjs/dist/index.css";
import dateConverter from "nepali-datetime/dateConverter";

const DualCalendarTailwind = ({ onChange }) => {
  const [nepaliDate, setNepaliDate] = useState("");
  const [englishDate, setEnglishDate] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);

  const calendarRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setShowCalendar(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNepaliChange = (bsDate) => {
    if (!bsDate) return;
    const cleaned = bsDate.split(" ")[0];
    setNepaliDate(cleaned);

    const [bsYear, bsMonth, bsDay] = cleaned.split("-").map(Number);
    const [enYear, enMonth0, enDay] = dateConverter.nepaliToEnglish(
      bsYear,
      bsMonth + 1,
      bsDay
    );

    const formattedEnglish = `${enYear}-${String(enMonth0 + 1).padStart(
      2,
      "0"
    )}-${String(enDay).padStart(2, "0")}`;
    setEnglishDate(formattedEnglish);

    if (onChange) onChange(formattedEnglish, cleaned);
  };

  const handleEnglishChange = (e) => {
    const adDate = e.target.value;
    setEnglishDate(adDate);

    if (!adDate) {
      setNepaliDate("");
      if (onChange) onChange("", "");
      return;
    }

    const [enYear, enMonth, enDay] = adDate.split("-").map(Number);
    const [npYear, npMonth, npDay] = dateConverter.englishToNepali(
      enYear,
      enMonth,
      enDay
    );

    const formattedNepali = `${npYear}-${String(npMonth).padStart(
      2,
      "0"
    )}-${String(npDay).padStart(2, "0")}`;
    setNepaliDate(formattedNepali);

    if (onChange) onChange(adDate, formattedNepali);
  };

  return (
    <div className="relative max-w-md mx-auto mt-2">
      <input
        type="text"
        value={
          englishDate && nepaliDate ? `${englishDate} / ${nepaliDate}` : ""
        }
        readOnly
        onClick={() => setShowCalendar(true)}
        placeholder="Select Date"
        className="w-full border border-gray-300 rounded-md px-3 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      {showCalendar && (
        <div
          ref={calendarRef}
          className="absolute z-50 mt-2 w-full bg-white border border-gray-200 rounded-md shadow-lg p-4 flex gap-4"
        >
          <div className="flex flex-col">
            <label className="mb-2 text-gray-600">English (AD)</label>
            <input
              type="date"
              value={englishDate}
              onChange={handleEnglishChange}
              className="border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex flex-col w-full">
            <label className="mb-2 text-gray-600">Nepali (BS)</label>
            <NepaliDatePicker
              value={nepaliDate}
              onChange={handleNepaliChange}
              inputClassName="border rounded-md px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-400"
              options={{ calendarLocale: "en", valueLocale: "en" }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DualCalendarTailwind;
