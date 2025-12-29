import { useState, useRef, useEffect } from "react";
import NepaliDatePicker from "@sbmdkl/nepali-datepicker-reactjs";
import "@sbmdkl/nepali-datepicker-reactjs/dist/index.css";
import { Input } from "@/components/ui/input";

export default function DualDatePicker({ value, onChange, label }) {
  const [showCalendar, setShowCalendar] = useState(false);
  const popupRef = useRef(null);
  const containerRef = useRef(null);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showCalendar]);

  const handleDateChange = (val) => {
    onChange(val); // Update the value, which syncs both calendars
  };

  const handleInputFocus = () => {
    setShowCalendar(true);
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue); // This will sync both calendars via the key prop
  };

  return (
    <div className="relative" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium mb-1">{label}</label>
      )}

      {/* Date Input */}
      <Input
        type="text"
        value={value || ""}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onClick={handleInputFocus}
        placeholder="Select date"
        className="cursor-pointer"
        readOnly
      />

      {/* Dual Calendar Popup - English and Nepali side by side */}
      {showCalendar && (
        <div
          ref={popupRef}
          className="absolute z-50 mt-2 bg-white p-4 shadow-lg rounded-lg border border-gray-200 left-0 right-0 md:left-auto md:right-auto md:w-[700px]"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* English Calendar */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-center">
                English (AD)
              </h3>
              <NepaliDatePicker
                key={`en-${value || "empty"}`} // Force re-render when value changes
                value={value || ""}
                onChange={handleDateChange}
                options={{
                  calenderLocale: "en", // Show English calendar
                  valueLocale: "en", // Store in English format (YYYY-MM-DD)
                  closeOnSelect: false,
                }}
              />
            </div>

            {/* Nepali Calendar */}
            <div>
              <h3 className="text-sm font-semibold mb-2 text-center">
                Nepali (BS)
              </h3>
              <NepaliDatePicker
                key={`ne-${value || "empty"}`} // Force re-render when value changes
                value={value || ""}
                onChange={handleDateChange}
                options={{
                  calenderLocale: "ne", // Show Nepali calendar
                  valueLocale: "en", // Store in English format (YYYY-MM-DD)
                  closeOnSelect: false,
                }}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => setShowCalendar(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
