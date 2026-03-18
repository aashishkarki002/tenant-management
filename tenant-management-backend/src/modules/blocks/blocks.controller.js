import { Block } from "./Block.Model.js";
import InnerBlock from "./innerBlocks/InnerBlock.Model.js";
import { Unit } from "../units/unit.model.js";

export async function getAllBlocksWithStats(req, res) {
  try {
    const [blocks, innerAgg, unitAgg] = await Promise.all([
      Block.find({}).populate("ownershipEntityId").lean(),
      InnerBlock.aggregate([{ $group: { _id: "$block", innerBlocks: { $sum: 1 } } }]),
      Unit.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: "$block",
            unitCount: { $sum: 1 },
            occupiedUnitCount: {
              $sum: { $cond: [{ $eq: ["$isOccupied", true] }, 1, 0] },
            },
            activeTenants: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isOccupied", true] },
                      { $eq: ["$currentLease.status", "active"] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            monthlyRevenuePaisa: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$isOccupied", true] },
                      { $eq: ["$currentLease.status", "active"] },
                    ],
                  },
                  { $multiply: [{ $ifNull: ["$currentLease.totalMonthly", 0] }, 100] },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const innerMap = new Map(innerAgg.map((x) => [String(x._id), x]));
    const unitMap = new Map(unitAgg.map((x) => [String(x._id), x]));

    const data = blocks.map((b) => {
      const id = String(b._id);
      const inner = innerMap.get(id);
      const unit = unitMap.get(id);

      return {
        ...b,
        ownershipEntity: b.ownershipEntityId ?? null,
        innerBlocks: inner?.innerBlocks ?? 0,
        unitCount: unit?.unitCount ?? 0,
        occupiedUnitCount: unit?.occupiedUnitCount ?? 0,
        activeTenants: unit?.activeTenants ?? 0,
        monthlyRevenuePaisa: unit?.monthlyRevenuePaisa ?? 0,
        outstandingPaisa: 0,
      };
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getAllBlocksWithStats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load blocks",
    });
  }
}
