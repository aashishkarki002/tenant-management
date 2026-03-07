"use client";

import { useState, useEffect, useMemo, useRef } from "react";

export const usePagination = (items, itemsPerPage = 10) => {
  const [currentPage, setCurrentPage] = useState(1);
  const prevItemsLengthRef = useRef(items?.length || 0);

  const itemsLength = items?.length || 0;
  const totalPages = Math.max(1, Math.ceil(itemsLength / itemsPerPage));

  // Reset to page 1 only when the items array length changes.
  // Deliberately NOT including currentPage or totalPages here — those
  // are derived values that would cause an infinite update cycle.
  useEffect(() => {
    const currentLength = items?.length || 0;
    if (prevItemsLengthRef.current !== currentLength) {
      setCurrentPage(1);
      prevItemsLengthRef.current = currentLength;
    }
  }, [itemsLength]); // eslint-disable-line react-hooks/exhaustive-deps

  // Separately clamp the page when totalPages shrinks (e.g. after filtering).
  // Using a ref guard prevents the double-render loop.
  useEffect(() => {
    setCurrentPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, itemsLength);

  const paginatedItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.slice(startIndex, endIndex);
  }, [items, startIndex, endIndex]);

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const nextPage = () => {
    if (safeCurrentPage < totalPages) setCurrentPage(safeCurrentPage + 1);
  };

  const prevPage = () => {
    if (safeCurrentPage > 1) setCurrentPage(safeCurrentPage - 1);
  };

  return {
    currentPage: safeCurrentPage,
    totalPages,
    startIndex,
    endIndex,
    paginatedItems,
    goToPage,
    nextPage,
    prevPage,
    setCurrentPage,
  };
};
