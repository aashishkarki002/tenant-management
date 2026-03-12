/**
 * seedOwnershipEntity.js
 *
 * 1. Creates the default private OwnershipEntity (if not present).
 * 2. Creates the Head Office entity (if not present).
 * 3. Assigns ownershipEntityId to all Blocks that don't have one yet.
 * 4. Updates SystemConfig with systemMode, defaultEntityId, and partial-payment settings.
 *
 * Safe to run multiple times — fully idempotent.
 *
 * Run with:
 *   node src/seeds/seedOwnershipEntity.js
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { OwnershipEntity } from "../modules/ownership/OwnershipEntity.Model.js";
import { Block } from "../modules/blocks/Block.Model.js";
import { SystemConfig } from "../modules/systemConfig/SystemConfig.Model.js";
import { fileURLToPath } from "url";

async function seedOwnershipEntity() {
  let connected = false;
  try {
    if (mongoose.connection.readyState === 0) {
      await connectDB();
      connected = true;
      console.log("✅ MongoDB connected");
    }

    // ── Step 1: Create (or find) the default private entity ──────────────────
    let privateEntity = await OwnershipEntity.findOne({ type: "private" });

    if (privateEntity) {
      console.log(
        `⏭️  Private entity already exists: "${privateEntity.name}" (${privateEntity._id}) — skipping creation`,
      );
    } else {
      privateEntity = await OwnershipEntity.create({
        name: "Owner",
        type: "private",
        chartOfAccountsPrefix: "PVT",
        isActive: true,
      });
      console.log(
        `✅ Created private entity: "${privateEntity.name}" (${privateEntity._id})`,
      );
    }

    // ── Step 2: Create (or find) the Head Office entity ───────────────────────
    let hqEntity = await OwnershipEntity.findOne({ type: "head_office" });

    if (hqEntity) {
      console.log(
        `⏭️  Head Office entity already exists: "${hqEntity.name}" (${hqEntity._id}) — skipping creation`,
      );
    } else {
      hqEntity = await OwnershipEntity.create({
        name: "Head Office",
        type: "head_office",
        chartOfAccountsPrefix: "HQ",
        isActive: true,
      });
      console.log(
        `✅ Created Head Office entity: "${hqEntity.name}" (${hqEntity._id})`,
      );
    }

    // ── Step 3: Assign ownershipEntityId to all unassigned blocks ────────────
    // The 4 buildings are 4 Block documents — each gets the private entity by default
    const unassignedBlocks = await Block.find({
      $or: [
        { ownershipEntityId: { $exists: false } },
        { ownershipEntityId: null },
      ],
    });

    if (unassignedBlocks.length === 0) {
      console.log("⏭️  All blocks already have ownershipEntityId set — skipping");
    } else {
      const result = await Block.updateMany(
        {
          $or: [
            { ownershipEntityId: { $exists: false } },
            { ownershipEntityId: null },
          ],
        },
        { $set: { ownershipEntityId: privateEntity._id } },
      );
      console.log(
        `✅ Assigned private entity to ${result.modifiedCount} block(s): ${unassignedBlocks.map((b) => b.name).join(", ")}`,
      );
    }

    // ── Step 4: Update SystemConfig (ownershipConfig document) ───────────────
    const ownershipConfig = await SystemConfig.findOneAndUpdate(
      { key: "ownershipConfig" },
      {
        $setOnInsert: { key: "ownershipConfig", value: {} },
        $set: {
          systemMode: "private",
          defaultEntityId: privateEntity._id,
          allowPartialPayments: true,
          partialPaymentThresholdPct: 0,
        },
      },
      { upsert: true, new: true },
    );

    console.log(
      `✅ SystemConfig ownershipConfig updated — systemMode: "${ownershipConfig.systemMode}", defaultEntityId: ${ownershipConfig.defaultEntityId}`,
    );

    // ── Verify ────────────────────────────────────────────────────────────────
    const totalBlocks = await Block.countDocuments();
    const linkedBlocks = await Block.countDocuments({
      ownershipEntityId: privateEntity._id,
    });
    console.log(
      `\n📊 Verification: ${linkedBlocks}/${totalBlocks} blocks linked to "${privateEntity.name}"`,
    );

    console.log("\n🌱 Ownership entity seed complete.");
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    throw error;
  } finally {
    if (connected) await mongoose.disconnect();
  }
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);
const currentFile = __filename.replace(/\\/g, "/");
const runFile = process.argv[1]?.replace(/\\/g, "/");

if (
  currentFile === runFile ||
  import.meta.url.includes(runFile) ||
  process.argv[1]?.endsWith("seedOwnershipEntity.js")
) {
  seedOwnershipEntity()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export { seedOwnershipEntity };
