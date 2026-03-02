import api from "../../plugins/axios";

/**
 * Industry standard: Service functions are plain async functions — no React.
 * They accept an AbortSignal so the calling hook can cancel on unmount.
 *
 * All three functions share the same shape so useUnitBase can call any of them.
 *
 * @param {{ propertyId?: string; blockId?: string; innerBlockId?: string }} filters
 * @param {AbortSignal} signal
 */

function buildParams({ propertyId, blockId, innerBlockId }) {
  const params = {};
  if (propertyId) params.property = propertyId;
  if (blockId) params.block = blockId;
  if (innerBlockId) params.innerBlock = innerBlockId;
  return params;
}

/** All units (occupied + vacant) */
export async function fetchUnits(filters = {}, signal) {
  const { data } = await api.get("/api/units/get-units", {
    params: buildParams(filters),
    signal,
  });

  if (!data.success) throw new Error(data.message || "Failed to fetch units");
  return data.units;
}

/** Only occupied units — active lease */
export async function fetchOccupiedUnits(filters = {}, signal) {
  const { data } = await api.get("/api/units/get-units", {
    params: { ...buildParams(filters), occupied: "true" },
    signal,
  });

  if (!data.success) throw new Error(data.message || "Failed to fetch units");
  return data.units;
}

/** Only vacant units — no active lease */
export async function fetchVacantUnits(filters = {}, signal) {
  const { data } = await api.get("/api/units/get-units", {
    params: { ...buildParams(filters), occupied: "false" },
    signal,
  });

  if (!data.success) throw new Error(data.message || "Failed to fetch units");
  return data.units;
}
