/**
 * useMaintenanceFilters Hook
 * 
 * Handles all filtering and grouping logic for maintenance items.
 * Manages search, status, and priority filters with memoized results.
 */

import { useState, useMemo } from 'react';
import { groupMaintenanceTickets } from '../utils/maintenance.utils';

export const useMaintenanceFilters = (maintenance) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  /**
   * Apply all filters to maintenance list
   */
  const filteredMaintenance = useMemo(() => {
    let list = maintenance || [];

    // Apply status filter
    if (statusFilter !== 'All') {
      list = list.filter((m) => (m.status || 'OPEN').toUpperCase() === statusFilter);
    }

    // Apply priority filter
    if (priorityFilter !== 'All') {
      list = list.filter((m) => (m.priority || '').toLowerCase() === priorityFilter.toLowerCase());
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (m) =>
          (m.title || '').toLowerCase().includes(q) ||
          (m.unit?.name || '').toLowerCase().includes(q) ||
          (m.tenant?.name || '').toLowerCase().includes(q) ||
          (m.description || '').toLowerCase().includes(q) ||
          (m.assignedTo?.name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [maintenance, statusFilter, priorityFilter, searchQuery]);

  /**
   * Group filtered tickets by status and priority
   */
  const groupedTickets = useMemo(() => {
    return groupMaintenanceTickets(filteredMaintenance);
  }, [filteredMaintenance]);

  /**
   * Check if any filters are active
   */
  const hasActiveFilters = useMemo(() => {
    return statusFilter !== 'All' || priorityFilter !== 'All' || searchQuery.trim();
  }, [statusFilter, priorityFilter, searchQuery]);

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setPriorityFilter('All');
  };

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    priorityFilter,
    setPriorityFilter,
    filteredMaintenance,
    groupedTickets,
    hasActiveFilters,
    clearFilters,
  };
};
