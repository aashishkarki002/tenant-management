import { OwnershipEntity } from "./OwnershipEntity.Model.js";
import { Block } from "../blocks/Block.Model.js";

/**
 * Resolve the OwnershipEntity that owns a given block.
 * Used by resolveEntity middleware (Phase 2).
 * Returns null if the block has no entity assigned yet.
 */
export const getEntityForBlock = async (blockId) => {
  const block = await Block.findById(blockId)
    .populate("ownershipEntityId")
    .lean();

  if (!block) throw new Error(`Block not found: ${blockId}`);
  return block.ownershipEntityId ?? null;
};

/**
 * Return all blocks that belong to a given entity.
 * Used by migration service and cron reporting.
 */
export const getBlocksForEntity = async (entityId) => {
  return Block.find({ ownershipEntityId: entityId }).lean();
};

/**
 * Create a new OwnershipEntity.
 * Blocked in single-entity mode — only one active entity is allowed.
 */
export const createEntity = async (data, createdBy) => {
  const existing = await OwnershipEntity.countDocuments({ isActive: true });
  if (existing >= 1) {
    const err = new Error("Single-entity mode is active. Disable existing entity before creating a new one.");
    err.statusCode = 403;
    throw err;
  }
  return OwnershipEntity.create({ ...data, createdBy });
};

/**
 * Return all active OwnershipEntity records.
 */
export const getAllEntities = async () => {
  return OwnershipEntity.find({ isActive: true }).sort({ createdAt: 1 }).lean();
};

/**
 * Update an existing OwnershipEntity by id.
 * Returns the updated document or null if not found.
 */
export const updateEntity = async (id, data) => {
  return OwnershipEntity.findByIdAndUpdate(
    id,
    { $set: data },
    { returnDocument: "after", runValidators: true },
  ).lean();
};

/**
 * Fetch a single OwnershipEntity by id.
 */
export const getEntityById = async (id) => {
  return OwnershipEntity.findById(id).lean();
};
export const preFlightCheck = async (id) => {
  return OwnershipEntity.findById(id).lean();
};
