import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE } from "../utils/electricityConstants";

function buildPageWindow(currentPage, totalPages) {
  const windowSize = Math.min(5, totalPages);
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export function ElectricityPagination({ currentPage, totalItems, onPageChange, pageSize = PAGE_SIZE }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalItems <= 0 || totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  const pageNumbers = buildPageWindow(currentPage, totalPages);

  const navBtn = (disabled) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-border)",
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.35 : 1,
    color: "var(--color-text-sub)",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: "12px",
        borderTop: "1px solid var(--color-border)",
        marginTop: "8px",
      }}
    >
      <p style={{ fontSize: "12px", color: "var(--color-text-sub)" }}>
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

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          style={navBtn(currentPage === 1)}
          aria-label="Previous page"
        >
          <ChevronLeft style={{ width: "13px", height: "13px" }} />
        </button>

        {pageNumbers.map((page) => {
          const isActive = page === currentPage;
          return (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "var(--radius-md)",
                border: isActive ? "none" : "1px solid var(--color-border)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: 600,
                backgroundColor: isActive ? "var(--color-accent)" : "transparent",
                color: isActive ? "#ffffff" : "var(--color-text-body)",
              }}
              aria-label={`Page ${page}`}
              aria-current={isActive ? "page" : undefined}
            >
              {page}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          style={navBtn(currentPage >= totalPages)}
          aria-label="Next page"
        >
          <ChevronRight style={{ width: "13px", height: "13px" }} />
        </button>
      </div>
    </div>
  );
}