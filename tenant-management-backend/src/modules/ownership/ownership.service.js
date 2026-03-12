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
 */
export const createEntity = async (data, createdBy) => {
  return OwnershipEntity.create({ ...data, createdBy });
};

/**
 * Return all OwnershipEntity records.
 */
export const getAllEntities = async () => {
  return OwnershipEntity.find().sort({ createdAt: 1 }).lean();
};

/**
 * Update an existing OwnershipEntity by id.
 * Returns the updated document or null if not found.
 */
export const updateEntity = async (id, data) => {
  return OwnershipEntity.findByIdAndUpdate(
    id,
    { $set: data },
    { new: true, runValidators: true },
  ).lean();
};

/**
 * Fetch a single OwnershipEntity by id.
 */
export const getEntityById = async (id) => {
  return OwnershipEntity.findById(id).lean();
};
