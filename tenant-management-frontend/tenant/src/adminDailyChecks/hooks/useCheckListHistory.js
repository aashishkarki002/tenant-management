import { useState, useEffect, useCallback } from "react";
import api from "../../../plugins/axios";
import { toast } from "sonner";

/**
 * Groups a flat results array into:
 * [
 *   {
 *     nepaliDate: "2082-09-14",
 *     englishDate: "2026-01-28",
 *     categories: {
 *       ELECTRICAL: [ resultA, resultB ],
 *       CCTV: [ resultA ],
 *       ...
 *     }
 *   },
 *   ...
 * ]
 * Sorted newest → oldest by nepaliDate.
 */
function groupResultsByDateAndCategory(results) {
  const byDate = {};

  for (const r of results) {
    const dateKey = r.nepaliDate ?? r.checkDate?.slice(0, 10) ?? "unknown";
    if (!byDate[dateKey]) {
      byDate[dateKey] = {
        nepaliDate: r.nepaliDate,
        englishDate: r.checkDate,
        categories: {},
      };
    }
    const cat = r.category;
    if (!byDate[dateKey].categories[cat]) {
      byDate[dateKey].categories[cat] = [];
    }
    byDate[dateKey].categories[cat].push(r);
  }

  return Object.values(byDate).sort((a, b) =>
    (b.nepaliDate ?? "").localeCompare(a.nepaliDate ?? ""),
  );
}

/**
 * useChecklistHistory
 *
 * Fetches paginated checklist results for a property and exposes:
 *   - groupedDays: the date-grouped data structure for the UI
 *   - filters / setFilters: category, block, status, hasIssues
 *   - pagination: { page, totalPages, total, limit }
 *   - goToPage(n)
 *   - isLoading, error
 *   - refetch()
 */
function useChecklistHistory(propertyId) {
  const [rawResults, setRawResults] = useState([]);
  const [groupedDays, setGroupedDays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [filters, setFilters] = useState({
    category: "",
    blockId: "",
    status: "",
    hasIssues: "",
  });

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 30,
  });

  const fetchResults = useCallback(
    async (pageNum = 1) => {
      if (!propertyId) return;
      setIsLoading(true);
      setError(null);

      try {
        const params = {
          propertyId,
          page: pageNum,
          limit: pagination.limit,
          ...(filters.category && { category: filters.category }),
          ...(filters.blockId && { blockId: filters.blockId }),
          ...(filters.status && { status: filters.status }),
          ...(filters.hasIssues !== "" && { hasIssues: filters.hasIssues }),
        };

        const response = await api.get("/api/checklists/results", { params });

        if (response.data.success) {
          const results = response.data.data ?? [];
          setRawResults(results);
          setGroupedDays(groupResultsByDateAndCategory(results));
          setPagination((prev) => ({
            ...prev,
            page: response.data.pagination?.page ?? pageNum,
            totalPages: response.data.pagination?.pages ?? 1,
            total: response.data.pagination?.total ?? results.length,
          }));
        } else {
          throw new Error(response.data.message || "Failed to fetch results");
        }
      } catch (err) {
        const message = err.message || "Failed to load checklist history";
        setError(message);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    },
    [propertyId, filters, pagination.limit],
  );

  useEffect(() => {
    fetchResults(1);
  }, [propertyId, filters]);

  const goToPage = useCallback(
    (pageNum) => {
      fetchResults(pageNum);
    },
    [fetchResults],
  );

  const refetch = useCallback(() => {
    fetchResults(pagination.page);
  }, [fetchResults, pagination.page]);

  return {
    groupedDays,
    rawResults,
    filters,
    setFilters,
    pagination,
    goToPage,
    isLoading,
    error,
    refetch,
  };
}

export default useChecklistHistory;
