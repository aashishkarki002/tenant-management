import mongoose from "mongoose";

/**
 * Build a MongoDB match fragment for entity-scoped queries.
 *
 * Rules:
 * - entityId = null / undefined → {} (no filter, merged view — include all records)
 * - entityId = "private"        → { $or: [{ entityId: null }, { entityId: { $exists: false } }] }
 *                                  legacy entries (null entityId) are implicitly private
 * - entityId = <ObjectId>       → { entityId: new ObjectId(entityId) }
 *
 * If ObjectId parsing fails we fall back to an empty filter, which is the safest
 * behaviour for read queries (no accidental exclusion).
 *
 * @param {string|null|undefined} entityId
 * @returns {object} MongoDB match fragment (may be empty object)
 */
export function buildEntityFilter(entityId) {
  if (!entityId) return {};
  if (entityId === "private") {
    return { $or: [{ entityId: null }, { entityId: { $exists: false } }] };
  }
  try {
    return { entityId: new mongoose.Types.ObjectId(entityId) };
  } catch {
    return {};
  }
}

