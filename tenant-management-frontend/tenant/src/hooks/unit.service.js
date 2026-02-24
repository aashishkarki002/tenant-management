import api from "../../plugins/axios";

/**
 * Fetch all units (optionally filtered by property/block). No occupied filter.
 *
 * @param {{ propertyId?: string; blockId?: string }} filters
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>} List of units
 */
async function fetchUnits(filters = {}, signal = undefined) {
  const params = {};
  if (filters.propertyId) params.property = filters.propertyId;
  if (filters.blockId) params.block = filters.blockId;

  const { data } = await api.get("/api/unit/get-units", {
    params,
    signal,
  });
  return data?.units ?? [];
}

/**
 * Fetch only occupied units (units with an active lease).
 *
 * @param {{ propertyId?: string; blockId?: string }} filters
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
async function fetchOccupiedUnits(filters = {}, signal = undefined) {
  const p = {};
  if (filters.propertyId) p.property = filters.propertyId;
  if (filters.blockId) p.block = filters.blockId;
  p.occupied = "true";

  const { data } = await api.get("/api/unit/get-units", {
    params: p,
    signal,
  });
  return data?.units ?? [];
}

/**
 * Fetch only vacant units (no active lease).
 *
 * @param {{ propertyId?: string; blockId?: string }} filters
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
async function fetchVacantUnits(filters = {}, signal = undefined) {
  const p = {};
  if (filters.propertyId) p.property = filters.propertyId;
  if (filters.blockId) p.block = filters.blockId;
  p.occupied = "false";

  const { data } = await api.get("/api/unit/get-units", {
    params: p,
    signal,
  });
  return data?.units ?? [];
}

export { fetchUnits, fetchOccupiedUnits, fetchVacantUnits };
