import mongoose from "mongoose";
import { DailyChecklist } from "./dailyChecksList.model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { buildChecklistSections } from "./checkListTemplate.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _notifyIssues(checklist) {
  if (!checklist.hasIssues) return;

  createAndEmitNotification({
    type: "CHECKLIST_ISSUES_FOUND",
    title: "Daily Checklist – Issues Found",
    message: `${checklist.failedItems} issue(s) found in the ${checklist.category} checklist for ${checklist.property?.name ?? "a property"} on ${new Date(checklist.checkDate).toLocaleDateString()}.`,
    data: {
      checklistId: checklist._id,
      category: checklist.category,
      failedItems: checklist.failedItems,
      propertyId: checklist.property,
    },
  }).catch((err) =>
    console.error("[checklist] failed to emit issue notification:", err),
  );
}

// ─── Create – seed a new checklist from template ──────────────────────────────
/**
 * Creates a blank checklist pre-populated with the correct sections/items
 * for the given category, building config, and date.
 *
 * @param {object} data
 * @param {string} data.propertyId
 * @param {string} [data.blockId]
 * @param {"CCTV"|"ELECTRICAL"|"SANITARY"|"COMMON_AREA"|"PARKING"|"FIRE"|"WATER_TANK"} data.category
 * @param {"DAILY"|"WEEKLY_TWICE"|"WEEKLY"|"MONTHLY"} data.checklistType
 * @param {Date|string} data.checkDate
 * @param {string} [data.nepaliDate]    BS date string e.g. "2081-04-15"
 * @param {number} [data.nepaliMonth]
 * @param {number} [data.nepaliYear]
 * @param {object} [data.buildingConfig]  — asset inventory for this property
 * @param {string} adminId
 */
export async function createChecklist(data, adminId) {
  const {
    propertyId,
    blockId,
    category,
    checklistType = "DAILY",
    checkDate,
    nepaliDate,
    nepaliMonth,
    nepaliYear,
    buildingConfig = {},
    overallNotes = "",
  } = data;

  // Derive Nepali date from the English date if not provided
  let resolvedNepaliMonth = nepaliMonth;
  let resolvedNepaliYear = nepaliYear;
  if (checkDate && (!resolvedNepaliMonth || !resolvedNepaliYear)) {
    const derived = getNepaliYearMonthFromDate(checkDate);
    resolvedNepaliMonth = resolvedNepaliMonth ?? derived.npMonth;
    resolvedNepaliYear = resolvedNepaliYear ?? derived.npYear;
  }

  const sections = buildChecklistSections(
    category,
    buildingConfig,
    checklistType,
  );

  const checklist = await DailyChecklist.create({
    property: propertyId,
    block: blockId ?? null,
    category,
    checklistType,
    checkDate: new Date(checkDate),
    nepaliDate: nepaliDate ?? null,
    nepaliMonth: resolvedNepaliMonth ?? null,
    nepaliYear: resolvedNepaliYear ?? null,
    sections,
    status: "PENDING",
    overallNotes,
    submittedBy: adminId,
    createdBy: adminId,
  });

  return {
    success: true,
    message: "Daily checklist created successfully",
    data: checklist,
  };
}

// ─── Submit – update items, auto-create repair tasks for failures ─────────────
/**
 * Merges the submitted item results into the existing checklist and
 * auto-creates Maintenance tasks for every item where isOk = false.
 *
 * @param {string} checklistId
 * @param {object} updateData
 * @param {object[]} updateData.sections  — partial section+item updates
 * @param {string} [updateData.overallNotes]
 * @param {string} [updateData.status]
 * @param {string} [updateData.nepaliDate]
 * @param {number} [updateData.nepaliMonth]
 * @param {number} [updateData.nepaliYear]
 * @param {string} adminId
 */
export async function submitChecklist(checklistId, updateData, adminId) {
  const checklist = await DailyChecklist.findById(checklistId).populate(
    "property",
    "name",
  );
  if (!checklist) {
    return { success: false, message: "Checklist not found", data: null };
  }

  // ── Merge item updates ────────────────────────────────────────────────────
  if (updateData.sections?.length) {
    for (const incomingSection of updateData.sections) {
      const existingSection = checklist.sections.find(
        (s) => s.sectionKey === incomingSection.sectionKey,
      );
      if (!existingSection) continue;

      for (const incomingItem of incomingSection.items ?? []) {
        const existingItem = existingSection.items.id(incomingItem._id);
        if (!existingItem) continue;
        existingItem.isOk = incomingItem.isOk ?? existingItem.isOk;
        existingItem.notes = incomingItem.notes ?? existingItem.notes;
      }
    }
  }

  if (updateData.overallNotes !== undefined) {
    checklist.overallNotes = updateData.overallNotes;
  }

  const newStatus = updateData.status ?? "COMPLETED";
  checklist.status = newStatus;
  checklist.submittedAt = new Date();
  checklist.submittedBy = adminId;

  // Apply Nepali date if provided
  if (updateData.nepaliDate) checklist.nepaliDate = updateData.nepaliDate;
  if (updateData.nepaliMonth) checklist.nepaliMonth = updateData.nepaliMonth;
  if (updateData.nepaliYear) checklist.nepaliYear = updateData.nepaliYear;

  // Pre-save hook recomputes totals + hasIssues
  await checklist.save();

  // ── Auto-create Maintenance tasks for failed items ────────────────────────
  const createdTasks = [];
  if (checklist.hasIssues) {
    for (const sec of checklist.sections) {
      for (const it of sec.items) {
        if (it.isOk || it.linkedMaintenanceId) continue; // skip ok or already linked

        const task = await Maintenance.create({
          title: `[Auto] ${it.label}`,
          description:
            it.notes ||
            `Issue detected during ${checklist.category} daily checklist on ${new Date(checklist.checkDate).toLocaleDateString()}.`,
          property: checklist.property._id ?? checklist.property,
          block: checklist.block ?? null,
          scheduledDate: new Date(), // schedule for today
          type: "Repair",
          priority: _inferPriority(sec.sectionKey, checklist.category),
          status: "OPEN",
          createdBy: adminId,
          scheduledNepaliMonth: checklist.nepaliMonth ?? null,
          scheduledNepaliYear: checklist.nepaliYear ?? null,
        });

        it.linkedMaintenanceId = task._id;
        createdTasks.push(task);
      }
    }

    // Persist the linkedMaintenanceId links
    if (createdTasks.length) {
      await checklist.save();
    }

    _notifyIssues(checklist);
  }

  return {
    success: true,
    message: `Checklist submitted. ${createdTasks.length} repair task(s) auto-created.`,
    data: checklist,
    autoCreatedTasks: createdTasks,
  };
}

// ─── Priority inference based on section/category ────────────────────────────

function _inferPriority(sectionKey, category) {
  const urgent = [
    "FIRE_EXTINGUISHER",
    "FIRE_SYSTEM",
    "FIRE_HYDRANT",
    "WATER_FIREFIGHTING",
  ];
  const high = ["ELEC_PANEL", "WATER_OVERHEAD", "CCTV_SYSTEM"];
  if (urgent.some((k) => sectionKey.includes(k))) return "Urgent";
  if (high.some((k) => sectionKey.includes(k))) return "High";
  if (category === "FIRE") return "Urgent";
  return "Medium";
}

// ─── Fetch list (with filters) ────────────────────────────────────────────────

export async function getChecklists(filters = {}) {
  const {
    propertyId,
    blockId,
    category,
    checklistType,
    hasIssues,
    status,
    nepaliYear,
    nepaliMonth,
    startDate,
    endDate,
    page = 1,
    limit = 30,
  } = filters;

  const query = {};
  if (propertyId) query.property = propertyId;
  if (blockId) query.block = blockId;
  if (category) query.category = category;
  if (checklistType) query.checklistType = checklistType;
  if (hasIssues !== undefined) query.hasIssues = hasIssues;
  if (status) query.status = status;
  if (nepaliYear) query.nepaliYear = nepaliYear;
  if (nepaliMonth) query.nepaliMonth = nepaliMonth;

  if (startDate || endDate) {
    query.checkDate = {};
    if (startDate) query.checkDate.$gte = new Date(startDate);
    if (endDate) query.checkDate.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;
  const [checklists, total] = await Promise.all([
    DailyChecklist.find(query)
      .populate("property", "name")
      .populate("block", "name")
      .populate("submittedBy", "name")
      .sort({ checkDate: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    DailyChecklist.countDocuments(query),
  ]);

  return {
    success: true,
    message: "Checklists fetched successfully",
    data: checklists,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Fetch single ─────────────────────────────────────────────────────────────

export async function getChecklistById(id) {
  const checklist = await DailyChecklist.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("submittedBy", "name email")
    .populate("createdBy", "name email")
    .populate("sections.items.linkedMaintenanceId", "title status priority");

  if (!checklist) {
    return { success: false, message: "Checklist not found", data: null };
  }
  return { success: true, message: "Checklist fetched", data: checklist };
}

// ─── Summary stats for dashboard ─────────────────────────────────────────────

export async function getChecklistSummary(propertyId, nepaliYear, nepaliMonth) {
  const match = { property: new mongoose.Types.ObjectId(propertyId) };
  if (nepaliYear) match.nepaliYear = nepaliYear;
  if (nepaliMonth) match.nepaliMonth = nepaliMonth;

  const summary = await DailyChecklist.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$category",
        total: { $sum: 1 },
        withIssues: { $sum: { $cond: ["$hasIssues", 1, 0] } },
        avgPassRate: {
          $avg: {
            $cond: [
              { $gt: ["$totalItems", 0] },
              {
                $multiply: [{ $divide: ["$passedItems", "$totalItems"] }, 100],
              },
              null,
            ],
          },
        },
        lastChecked: { $max: "$checkDate" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return {
    success: true,
    message: "Summary fetched",
    data: summary,
  };
}

// ─── Delete (admin only) ──────────────────────────────────────────────────────

export async function deleteChecklist(id) {
  const deleted = await DailyChecklist.findByIdAndDelete(id);
  if (!deleted) {
    return { success: false, message: "Checklist not found" };
  }
  return { success: true, message: "Checklist deleted" };
}
