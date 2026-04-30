/**
 * event.service.js
 *
 * Business logic for the Sallyan House events module.
 * Hierarchy: Event → Stall → Kiosk
 *
 * Revenue is recorded at kiosk level (lessee pays us).
 * Expenses are recorded at event level (we pay for logistics).
 * Both paths post double-entry journals via the ledger service.
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import Event from "./event.model.js";
import EventStall from "./eventStall.model.js";
import EventKiosk from "./eventKiosk.model.js";
import EventRevenue from "./eventRevenue.model.js";
import EventExpense from "./eventExpense.model.js";
import BankAccount from "../banks/BankAccountModel.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { buildEventRevenueJournal } from "../ledger/journal-builders/eventRevenue.js";
import { buildEventExpenseJournal } from "../ledger/journal-builders/eventExpense.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";

// ─────────────────────────────────────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function resolveBankAccountCode(bankAccountId, session) {
  if (!bankAccountId) return null;
  const doc = await BankAccount.findById(bankAccountId)
    .select("accountCode isDeleted")
    .session(session)
    .lean();
  if (!doc) throw Object.assign(new Error(`Bank account not found: ${bankAccountId}`), { statusCode: 404 });
  if (doc.isDeleted) throw Object.assign(new Error(`Bank account ${bankAccountId} has been deleted`), { statusCode: 400 });
  return doc.accountCode;
}

function toNepaliMonthYear(date) {
  const nd = new NepaliDate(date instanceof Date ? date : new Date(date));
  const { npYear, npMonth } = getNepaliYearMonthFromDate(nd.getDateObject());
  return { nepaliMonth: npMonth, nepaliYear: npYear };
}

// ─────────────────────────────────────────────────────────────────────────────
// EVENT CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createEvent(data) {
  const { name, propertyId, entityId, startDate, endDate, nepaliStartDate, nepaliEndDate, status, description, notes } = data;
  if (!name || !propertyId || !entityId || !startDate) {
    throw Object.assign(new Error("name, propertyId, entityId, and startDate are required"), { statusCode: 400 });
  }
  return Event.create({
    name,
    property: propertyId,
    entityId,
    startDate: new Date(startDate),
    endDate: endDate ? new Date(endDate) : null,
    nepaliStartDate: nepaliStartDate || null,
    nepaliEndDate: nepaliEndDate || null,
    status: status || "planned",
    description: description || null,
    notes: notes || null,
  });
}

export async function getEvents({ propertyId, status } = {}) {
  const filter = { isActive: true };
  if (propertyId) filter.property = propertyId;
  if (status) filter.status = status;
  return Event.find(filter)
    .populate("property", "name address")
    .sort({ startDate: -1 });
}

export async function getEventById(id) {
  const event = await Event.findById(id).populate("property", "name address");
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });

  const stalls = await EventStall.find({ event: id, isActive: true }).sort({ stallNumber: 1 });

  const stallIds = stalls.map((s) => s._id);
  const kiosks = await EventKiosk.find({ stall: { $in: stallIds }, isActive: true }).sort({ kioskNumber: 1 });

  // Group kiosks by stall
  const kiosksByStall = {};
  for (const kiosk of kiosks) {
    const key = String(kiosk.stall);
    if (!kiosksByStall[key]) kiosksByStall[key] = [];
    kiosksByStall[key].push(kiosk);
  }

  const stallsWithKiosks = stalls.map((s) => ({
    ...s.toObject(),
    kiosks: kiosksByStall[String(s._id)] ?? [],
  }));

  return { event, stalls: stallsWithKiosks };
}

export async function updateEvent(id, data) {
  const event = await Event.findByIdAndUpdate(id, data, { returnDocument: "after", runValidators: true });
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });
  return event;
}

// ─────────────────────────────────────────────────────────────────────────────
// STALL CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createStall(data) {
  const { eventId, stallNumber, description, floor } = data;
  if (!eventId || !stallNumber) {
    throw Object.assign(new Error("eventId and stallNumber are required"), { statusCode: 400 });
  }
  const event = await Event.findById(eventId);
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });

  return EventStall.create({ event: eventId, stallNumber, description, floor });
}

export async function getStallsByEvent(eventId) {
  return EventStall.find({ event: eventId, isActive: true }).sort({ stallNumber: 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// KIOSK CRUD
// ─────────────────────────────────────────────────────────────────────────────

export async function createKiosk(data) {
  const {
    stallId, kioskNumber, description,
    lesseeName, lesseePhone, lesseePAN,
    leaseAmountPaisa, leaseStartDate, leaseEndDate, billingCycle,
    revenueAccountCode,
  } = data;

  if (!stallId || !kioskNumber) {
    throw Object.assign(new Error("stallId and kioskNumber are required"), { statusCode: 400 });
  }

  const stall = await EventStall.findById(stallId);
  if (!stall) throw Object.assign(new Error("Stall not found"), { statusCode: 404 });

  return EventKiosk.create({
    event: stall.event,
    stall: stallId,
    kioskNumber,
    description: description || null,
    lesseeName: lesseeName || null,
    lesseePhone: lesseePhone || null,
    lesseePAN: lesseePAN || null,
    leaseAmountPaisa: leaseAmountPaisa || 0,
    leaseStartDate: leaseStartDate ? new Date(leaseStartDate) : null,
    leaseEndDate: leaseEndDate ? new Date(leaseEndDate) : null,
    billingCycle: billingCycle || "one_time",
    revenueAccountCode: revenueAccountCode || "4400",
  });
}

export async function getKiosksByStall(stallId) {
  return EventKiosk.find({ stall: stallId, isActive: true }).sort({ kioskNumber: 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// REVENUE — kiosk lessee pays us
// ─────────────────────────────────────────────────────────────────────────────

export async function recordKioskRevenue(eventId, data, adminId) {
  const {
    kioskId, amountPaisa, paymentDate, nepaliDate, paymentMethod,
    bankAccountId, referenceNumber, notes,
  } = data;

  if (!kioskId || !amountPaisa || !paymentDate || !paymentMethod) {
    throw Object.assign(
      new Error("kioskId, amountPaisa, paymentDate, and paymentMethod are required"),
      { statusCode: 400 },
    );
  }
  if ((paymentMethod === "bank_transfer" || paymentMethod === "cheque") && !bankAccountId) {
    throw Object.assign(new Error("bankAccountId is required for bank_transfer or cheque"), { statusCode: 400 });
  }

  const event = await Event.findById(eventId);
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });

  const kiosk = await EventKiosk.findById(kioskId);
  if (!kiosk) throw Object.assign(new Error("Kiosk not found"), { statusCode: 404 });

  const entityId = event.entityId;
  if (!entityId) throw Object.assign(new Error("Event has no entityId — cannot post journal"), { statusCode: 400 });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const paymentDateObj = new Date(paymentDate);
    const { nepaliMonth, nepaliYear } = toNepaliMonthYear(paymentDateObj);

    const [revenue] = await EventRevenue.create(
      [
        {
          event: eventId,
          entityId,
          stall: kiosk.stall,
          kiosk: kioskId,
          amountPaisa,
          paymentDate: paymentDateObj,
          nepaliDate: nepaliDate || null,
          paymentMethod,
          bankAccount: bankAccountId || null,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          recordedBy: adminId,
        },
      ],
      { session },
    );

    const bankAccountCode = await resolveBankAccountCode(bankAccountId, session);

    const kioskLabel = `${kiosk.kioskNumber}${kiosk.lesseeName ? ` — ${kiosk.lesseeName}` : ""}`;

    const journalPayload = buildEventRevenueJournal(
      {
        ...revenue.toObject(),
        nepaliMonth,
        nepaliYear,
        property: event.property,
      },
      bankAccountCode,
      kiosk.revenueAccountCode,
      kioskLabel,
    );

    const { transaction } = await ledgerService.postJournalEntry(journalPayload, session, entityId);

    // Update journalId + kiosk paid amount
    await EventRevenue.findByIdAndUpdate(revenue._id, { journalId: transaction._id }, { session });
    await EventKiosk.findByIdAndUpdate(
      kioskId,
      {
        $inc: { paidAmountPaisa: amountPaisa },
        $set: {
          paymentStatus:
            kiosk.paidAmountPaisa + amountPaisa >= kiosk.leaseAmountPaisa
              ? "paid"
              : "partial",
        },
      },
      { session },
    );

    await session.commitTransaction();

    await revenue.populate([
      { path: "kiosk", select: "kioskNumber lesseeName leaseAmountPaisa paidAmountPaisa" },
      { path: "bankAccount", select: "bankName accountNumber" },
      { path: "recordedBy", select: "name email" },
    ]);

    return revenue;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE — we pay for event logistics
// ─────────────────────────────────────────────────────────────────────────────

export async function recordEventExpense(eventId, data, adminId) {
  const {
    description, amountPaisa, expenseDate, nepaliDate, paymentMethod,
    bankAccountId, expenseAccountCode, referenceNumber, notes,
  } = data;

  if (!description || !amountPaisa || !expenseDate || !paymentMethod) {
    throw Object.assign(
      new Error("description, amountPaisa, expenseDate, and paymentMethod are required"),
      { statusCode: 400 },
    );
  }
  if ((paymentMethod === "bank_transfer" || paymentMethod === "cheque") && !bankAccountId) {
    throw Object.assign(new Error("bankAccountId is required for bank_transfer or cheque"), { statusCode: 400 });
  }

  const event = await Event.findById(eventId);
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });

  const entityId = event.entityId;
  if (!entityId) throw Object.assign(new Error("Event has no entityId — cannot post journal"), { statusCode: 400 });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const expenseDateObj = new Date(expenseDate);
    const { nepaliMonth, nepaliYear } = toNepaliMonthYear(expenseDateObj);

    const [expense] = await EventExpense.create(
      [
        {
          event: eventId,
          entityId,
          description,
          amountPaisa,
          expenseDate: expenseDateObj,
          nepaliDate: nepaliDate || null,
          nepaliMonth,
          nepaliYear,
          paymentMethod,
          bankAccount: bankAccountId || null,
          expenseAccountCode: expenseAccountCode || "5450",
          referenceNumber: referenceNumber || null,
          notes: notes || null,
          recordedBy: adminId,
        },
      ],
      { session },
    );

    const bankAccountCode = await resolveBankAccountCode(bankAccountId, session);

    const journalPayload = buildEventExpenseJournal(
      {
        ...expense.toObject(),
        property: event.property,
      },
      bankAccountCode,
    );

    const { transaction } = await ledgerService.postJournalEntry(journalPayload, session, entityId);

    await EventExpense.findByIdAndUpdate(expense._id, { journalId: transaction._id }, { session });

    await session.commitTransaction();

    await expense.populate([
      { path: "bankAccount", select: "bankName accountNumber" },
      { path: "recordedBy", select: "name email" },
    ]);

    return expense;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY — event P&L
// ─────────────────────────────────────────────────────────────────────────────

export async function getEventSummary(eventId) {
  const event = await Event.findById(eventId);
  if (!event) throw Object.assign(new Error("Event not found"), { statusCode: 404 });

  const [revenueAgg, expenseAgg, kioskCount] = await Promise.all([
    EventRevenue.aggregate([
      { $match: { event: event._id } },
      { $group: { _id: null, total: { $sum: "$amountPaisa" } } },
    ]),
    EventExpense.aggregate([
      { $match: { event: event._id } },
      { $group: { _id: null, total: { $sum: "$amountPaisa" } } },
    ]),
    EventKiosk.countDocuments({ event: event._id, isActive: true }),
  ]);

  const totalRevenuePaisa = revenueAgg[0]?.total ?? 0;
  const totalExpensePaisa = expenseAgg[0]?.total ?? 0;

  return {
    event: { _id: event._id, name: event.name, status: event.status },
    kioskCount,
    totalRevenuePaisa,
    totalExpensePaisa,
    netPaisa: totalRevenuePaisa - totalExpensePaisa,
  };
}
