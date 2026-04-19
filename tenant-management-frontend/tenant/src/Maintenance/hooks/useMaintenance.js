/**
 * useMaintenance Hook
 * 
 * Handles all data fetching and state management for maintenance items.
 * Encapsulates API calls, loading states, and data updates.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../../plugins/axios';
import { socket } from '../../../plugins/socket';
import { useAuth } from '../../context/AuthContext';

export const useMaintenance = () => {
  const { user } = useAuth();
  const [maintenance, setMaintenance] = useState([]);
  const [staffs, setStaffs] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const isStaff = user?.role === 'staff';

  /**
   * Fetch maintenance items — staff only see their assigned tasks.
   */
  const fetchMaintenance = useCallback(async () => {
    try {
      const endpoint = isStaff ? '/api/maintenance/my-tasks' : '/api/maintenance/all';
      const response = await api.get(endpoint);
      setMaintenance(response.data?.maintenance || []);
    } catch (error) {
      console.error('Failed to fetch maintenance:', error);
      setMaintenance([]);
    }
  }, [isStaff]);

  /**
   * Fetch staff members
   */
  const fetchStaffs = useCallback(async () => {
    try {
      const res = await api.get('/api/staff/get-staffs');
      const data = res.data?.data;
      setStaffs(Array.isArray(data) ? data : data?.data ?? []);
    } catch (error) {
      console.error('Failed to fetch staffs:', error);
      setStaffs([]);
    }
  }, []);

  /**
   * Fetch tenants
   */
  const fetchTenants = useCallback(async () => {
    try {
      const response = await api.get('/api/tenant/get-tenants');
      setTenants(response.data.tenants || []);
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
      setTenants([]);
    }
  }, []);

  /**
   * Update a single maintenance item in state
   * Preserves populated references when backend returns unpopulated data
   */
  const updateMaintenanceItem = useCallback((updatedItem) => {
    if (!updatedItem || !updatedItem._id) return;

    setMaintenance((prev) =>
      prev.map((item) => {
        if (String(item._id) !== String(updatedItem._id)) return item;

        // Merge updated data while preserving populated references
        const next = { ...item, ...updatedItem };

        // Preserve populated tenant if backend returns unpopulated
        if (item.tenant && updatedItem.tenant && !updatedItem.tenant?.name) {
          next.tenant = item.tenant;
        }

        // Preserve populated unit if backend returns unpopulated
        if (item.unit && updatedItem.unit && !updatedItem.unit?.name) {
          next.unit = item.unit;
        }

        // Preserve populated property if backend returns unpopulated
        if (item.property && updatedItem.property && !updatedItem.property?.name) {
          next.property = item.property;
        }

        // Preserve populated block if backend returns unpopulated
        if (item.block && updatedItem.block && !updatedItem.block?.name) {
          next.block = item.block;
        }

        // Preserve populated assignedTo if backend returns unpopulated
        if (item.assignedTo && updatedItem.assignedTo && !updatedItem.assignedTo?.name) {
          next.assignedTo = item.assignedTo;
        }

        // Preserve populated createdBy if backend returns unpopulated
        if (
          item.createdBy &&
          updatedItem.createdBy &&
          !(updatedItem.createdBy?.email || updatedItem.createdBy?.name)
        ) {
          next.createdBy = item.createdBy;
        }

        return next;
      })
    );
  }, []);

  /**
   * Initial data fetch on mount
   */
  useEffect(() => {
    fetchStaffs();
    fetchMaintenance();
    fetchTenants();
  }, [fetchStaffs, fetchMaintenance, fetchTenants]);

  /**
   * Real-time socket updates.
   * maintenance:updated — a task's status/fields changed; merge into state.
   * maintenance:created — a new task was created; re-fetch the full list so
   *                       pagination and populated refs are correct.
   */
  useEffect(() => {
    socket.on('maintenance:updated', updateMaintenanceItem);
    socket.on('maintenance:created', fetchMaintenance);

    return () => {
      socket.off('maintenance:updated', updateMaintenanceItem);
      socket.off('maintenance:created', fetchMaintenance);
    };
  }, [updateMaintenanceItem, fetchMaintenance]);

  return {
    maintenance,
    staffs,
    tenants,
    fetchMaintenance,
    updateMaintenanceItem,
    isLoading,
    setIsLoading,
  };
};
