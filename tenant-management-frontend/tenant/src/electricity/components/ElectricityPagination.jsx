import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "../utils/electricityConstants";

export function ElectricityPagination({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = PAGE_SIZE,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalItems <= 0 || totalPages <= 1) return null;

  const start = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const end = Math.min(currentPage * pageSize, totalItems);

  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => {
      if (totalPages <= 5) return i + 1;
      if (currentPage <= 3) return i + 1;
      if (currentPage >= totalPages - 2) return totalPages - 4 + i;
      return currentPage - 2 + i;
    }
  );

  return (
    <div className="flex justify-between items-center mt-4 pt-4 border-t border-[#F0EDE9]">
      <p className="text-xs text-[#948472]">
        Showing <span className="font-semibold text-[#625848]">{start}–{end}</span> of{" "}
        <span className="font-semibold text-[#625848]">{totalItems}</span> readings
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#948472]
            hover:bg-[#F0EDE9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors
              ${currentPage === page
                ? "bg-[#3D1414] text-white"
                : "text-[#625848] hover:bg-[#F0EDE9]"
              }`}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#948472]
            hover:bg-[#F0EDE9] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
