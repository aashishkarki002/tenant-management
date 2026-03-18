/**
 * resolveEntity.helper.js
 *
 * Single source of truth for block → entity resolution across the entire
 * service layer (tenant creation, rent service, CAM service, payment service,
 * late fee cron — everywhere).
 *
 * WHY A SHARED HELPER:
 *   Every financial event in this system is tied to a Block. The Block carries
 *   ownershipEntityId. Instead of duplicating the resolution logic in each
 *   service, this helper is imported once and called at the transaction
 *   boundary of any operation that posts a journal entry.
 *
 * CONTRACT (both functions):
 *   - NEVER throw. Entity resolution failure must not block financial operations.
 *   - Return null when entity cannot be resolved — null means "implicitly
 *     private" throughout the system (per architecture rule #5).
 *   - null entries are included in merged view and treated as private entity
 *     in filtered views.
 */

import { Block } from "../modules/blocks/Block.Model.js";
import { SystemConfig } from "../modules/systemConfig/SystemConfig.Model.js";

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE BLOCK RESOLUTION
// Used in: tenant.create.js, rent.payment.service.js
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve ownershipEntityId for a single block.
 *
 * Pass the active MongoDB session so the lookup participates in the
 * caller's transaction — ensures consistent reads within the same session.
 *
 * @param {string|import('mongoose').Types.ObjectId} blockId
 * @param {import('mongoose').ClientSession|null} session
 * @returns {Promise<import('mongoose').Types.ObjectId|null>}
 */
export async function resolveEntityFromBlock(blockId, session = null) {
  try {
    const query = Block.findById(blockId).select("ownershipEntityId").lean();
    if (session) query.session(session);

    const block = await query;

    if (block?.ownershipEntityId) return block.ownershipEntityId;

    // Block exists but has no entity yet (pre-seed) — use system default
    const configQuery = SystemConfig.findOne().select("defaultEntityId").lean();
    if (session) configQuery.session(session);

    const config = await configQuery;
    return config?.defaultEntityId ?? null;
  } catch (err) {
    console.warn(
      `[resolveEntityFromBlock] blockId=${blockId} → null:`,
      err.message,
    );
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BATCH BLOCK RESOLUTION
// Used in: rent.service.js (handleMonthlyRents), cam.service.js (handleMonthlyCams),
//          lateFee.cron.js (applyLateFees)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a Map<blockId string → entityId|null> for a list of blockIds.
 *
 * Single DB query regardless of how many blockIds are passed.
 * Use this in any cron or bulk operation that processes many records at once
 * to avoid N+1 queries.
 *
 * @param {Array<string|import('mongoose').Types.ObjectId>} blockIds
 * @returns {Promise<Map<string, import('mongoose').Types.ObjectId|null>>}
 *
 * @example
 *   const entityByBlock = await buildEntityMapForBlocks(
 *     rents.map(r => r.block)
 *   );
 *   // Then inside the loop:
 *   const entityId = entityByBlock.get(rent.block.toString()) ?? null;
 */
export async function buildEntityMapForBlocks(blockIds) {
  try {
    const unique = [
      ...new Set(blockIds.map((id) => id?.toString()).filter(Boolean)),
    ];
    if (!unique.length) return new Map();

    const blocks = await Block.find({ _id: { $in: unique } })
      .select("ownershipEntityId")
      .lean();

    return new Map(
      blocks.map((b) => [b._id.toString(), b.ownershipEntityId ?? null]),
    );
  } catch (err) {
    console.warn(
      "[buildEntityMapForBlocks] Failed — returning empty map:",
      err.message,
    );
    // Return empty map so callers fall back to null (implicit private)
    return new Map();
  }
}
