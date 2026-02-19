/**
 * subMeterApi.js
 *
 * API calls for SubMeter entities (the physical meters, not readings).
 * Readings themselves live in electricityApi.js.
 *
 * Industry pattern: separate resource endpoints per domain entity.
 * SubMeters are a configuration resource; Electricity readings are a transaction resource.
 */

import api from "../../../plugins/axios";

/**
 * GET /api/electricity/sub-meters
 * Fetch all sub-meters for a property, optionally filtered by type or block.
 *
 * @param {Object} params
 * @param {string}  params.propertyId   - required
 * @param {string} [params.meterType]   - "common_area" | "parking" | "sub_meter"
 * @param {string} [params.blockId]
 * @param {boolean} [params.activeOnly] - default true
 * @returns {Promise<{ subMeters: SubMeter[], total: number }>}
 */
export async function getSubMeters(params = {}) {
  const response = await api.get("/api/electricity/sub-meters", { params });
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to fetch sub-meters");
  }
  return result.data; // { subMeters, total }
}

/**
 * POST /api/electricity/sub-meters
 * Create a new sub-meter (admin only).
 *
 * @param {Object} body
 * @param {string} body.name
 * @param {string} body.meterType     - "common_area" | "parking" | "sub_meter"
 * @param {string} body.propertyId
 * @param {string} [body.blockId]
 * @param {string} [body.innerBlockId]
 * @param {string} [body.description]
 * @param {string} [body.meterSerialNumber]
 * @returns {Promise<SubMeter>}
 */
export async function createSubMeter(body) {
  const response = await api.post("/api/electricity/sub-meters", body);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to create sub-meter");
  }
  return result.data;
}

/**
 * PATCH /api/electricity/sub-meters/:id
 * Update name, description, isActive, etc.
 *
 * @param {string} id
 * @param {Object} body - partial SubMeter fields
 * @returns {Promise<SubMeter>}
 */
export async function updateSubMeter(id, body) {
  const response = await api.patch(`/api/electricity/sub-meters/${id}`, body);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to update sub-meter");
  }
  return result.data;
}
