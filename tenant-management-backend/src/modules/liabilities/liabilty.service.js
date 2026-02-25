import { Liability } from "./Liabilities.Model.js";
import { LiabilitySource } from "./LiabilitesSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";

async function createLiability(liabilityData) {
  try {
    const {
      source,
      amountPaisa,
      date,
      payeeType,
      tenant,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
      session,
    } = liabilityData;

    // Accept either ObjectId or source code (e.g., "SECURITY_DEPOSIT")
    const isObjectId = mongoose.Types.ObjectId.isValid(source);
    const liabilitySource = isObjectId
      ? await LiabilitySource.findById(source)
      : await LiabilitySource.findOne({ code: source });

    if (!liabilitySource) {
      throw new Error("Liability source not found");
    }

    const existingAdmin = await Admin.findById(createdBy);
    if (!existingAdmin) {
      throw new Error("Admin not found");
    }

    const createOpts = session ? { session } : {};
    const doc = {
      source: liabilitySource._id,
      amountPaisa,
      date,
      payeeType: payeeType === "tenant" ? "TENANT" : payeeType,
      tenant,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
    };
    // With session, Mongoose requires an array as first argument
    const created = await Liability.create(session ? [doc] : doc, createOpts);
    const liability = Array.isArray(created) ? created[0] : created;

    return {
      success: true,
      message: "Liability created successfully",
      data: liability,
    };
  } catch (error) {
    console.error("Failed to create liability:", error);
    return {
      success: false,
      message: "Failed to create liability",
      error: error.message,
    };
  }
}

export { createLiability };
