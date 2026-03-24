import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "../utils/electricityConstants";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build the page number window to display.
 * Always shows at most 5 page numbers centred around the current page.
 */
function buildPageWindow(currentPage, totalPages) {
  const windowSize = Math.min(5, totalPages);
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  // Shift window left if we hit the right edge.
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ElectricityPagination({
  currentPage,
  totalItems,
  onPageChange,
  pageSize = PAGE_SIZE,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalItems <= 0 || totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = buildPageWindow(currentPage, totalPages);

  const navBtnBase = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    borderRadius: "var(--radius-md)",
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.15s",
    backgroundColor: "transparent",
    color: "var(--color-text-sub)",
  };

  return (
    <div
      className="flex items-center justify-between mt-4 pt-4"
      style={{ borderTop: "1px solid var(--color-border)" }}
    >
      {/* Count label */}
      <p className="text-xs" style={{ color: "var(--color-text-sub)" }}>
        Showing{" "}
        <span style={{ color: "var(--color-text-body)", fontWeight: 600 }}>
          {start}–{end}
        </span>{" "}
        of{" "}
        <span style={{ color: "var(--color-text-body)", fontWeight: 600 }}>
          {totalItems}
        </span>{" "}
        readings
      </p>

      {/* Page buttons */}
      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={{
            ...navBtnBase,
            opacity: currentPage === 1 ? 0.35 : 1,
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
          }}
          onMouseOver={(e) => {
            if (currentPage !== 1)
              e.currentTarget.style.backgroundColor = "var(--color-surface)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((page) => {
          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "var(--radius-md)",
                border: "none",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                transition: "background-color 0.15s, color 0.15s",
                backgroundColor: isActive
                  ? "var(--color-accent)"
                  : "transparent",
                color: isActive ? "#ffffff" : "var(--color-text-body)",
              }}
              onMouseOver={(e) => {
                if (!isActive)
                  e.currentTarget.style.backgroundColor = "var(--color-surface)";
              }}
              onMouseOut={(e) => {
                if (!isActive)
                  e.currentTarget.style.backgroundColor = "transparent";
              }}
              aria-label={`Page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          style={{
            ...navBtnBase,
            opacity: currentPage >= totalPages ? 0.35 : 1,
            cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
          }}
          onMouseOver={(e) => {
            if (currentPage < totalPages)
              e.currentTarget.style.backgroundColor = "var(--color-surface)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}