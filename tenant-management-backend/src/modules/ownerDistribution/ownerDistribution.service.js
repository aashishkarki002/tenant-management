import mongoose from "mongoose";
import { OwnerDistribution } from "./OwnerDistribution.Model.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildOwnerDistributionJournal } from "../ledger/journal-builders/ownerDistribution.js";
import { formatNepaliISO } from "../../utils/nepaliDateHelper.js";
import NepaliDate from "nepali-datetime";

export async function createOwnerDistribution({ entityId, amountPaisa, paymentMethod, bankAccount, bankAccountCode, distributionDate, description, createdBy }) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const txDate = distributionDate instanceof Date ? distributionDate : new Date(distributionDate ?? Date.now());
    const nd     = new NepaliDate(txDate);

    const [dist] = await OwnerDistribution.create([{
      entityId,
      amountPaisa,
      paymentMethod,
      bankAccount:     bankAccount ?? null,
      bankAccountCode: bankAccountCode ?? null,
      distributionDate: txDate,
      nepaliDate:      formatNepaliISO(nd),
      nepaliMonth:     nd.getMonth() + 1,
      nepaliYear:      nd.getYear(),
      description:     description ?? null,
      createdBy:       createdBy ?? null,
    }], { session });

    const payload = buildOwnerDistributionJournal({
      distributionId:   dist._id,
      entityId,
      amountPaisa,
      paymentMethod,
      bankAccountCode,
      distributionDate: txDate,
      nepaliMonth:      nd.getMonth() + 1,
      nepaliYear:       nd.getYear(),
      description,
      createdBy,
    });

    const { transaction } = await ledgerService.postJournalEntry(payload, session, entityId);
    await OwnerDistribution.findByIdAndUpdate(dist._id, { $set: { transactionId: transaction._id } }, { session });

    await session.commitTransaction();
    return { ...dist.toObject(), transactionId: transaction._id };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listOwnerDistributions({ entityId, fiscalYear, skip = 0, limit = 50 }) {
  const filter = {};
  if (entityId)   filter.entityId  = new mongoose.Types.ObjectId(String(entityId));
  if (fiscalYear) filter.nepaliYear = Number(fiscalYear);
  return OwnerDistribution.find(filter).sort({ distributionDate: -1 }).skip(skip).limit(limit).lean();
}
