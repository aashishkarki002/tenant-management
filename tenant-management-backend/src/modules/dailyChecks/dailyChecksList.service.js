/**
 * dailyChecksList.service.js  (v2 — Template + Result split)
 *
 * Public API surface:
 *
 *   Templates (admin setup, done once per property × category):
 *     createTemplate(data, adminId)
 *     rebuildTemplate(templateId, adminId)      ← regenerates sections from factory
 *     getTemplates(filters)
 *     getTemplateById(id)
 *
 *   Results (daily operational flow):
 *     createResult(templateId, dateData, adminId)
 *     submitResult(resultId, updateData, adminId)
 *     getResults(filters)
 *     getResultById(id)                         ← merges template + delta for full view
 *     getResultSummary(propertyId, nepaliYear, nepaliMonth)
 *     deleteResult(id)
 */

import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { ChecklistTemplate } from "./checkListTemplate.model.js";
import { ChecklistResult } from "./checkListResult.model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { buildChecklistSections } from "./checkListTemplate.js";
import {
  formatNepaliISO,
  getNepalCivilUtcMidnightForInstant,
} from "../../utils/nepaliDateHelper.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Convert a Gregorian YYYY-MM-DD (or ISO datetime prefix) to a BS "YYYY-MM-DD"
 * string using the same NepaliDate conversion as createResult. Used so
 * startDate/endDate filters align with stored `nepaliDate`, not `checkDate`
 * (which is Nepal civil midnight in UTC and can fall on the previous UTC day).
 */
function _englishIsoDateToNepaliISO(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  const clean = dateStr.split("T")[0];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const instant = new Date(Date.UTC(y, mo - 1, d));
  try {
    return formatNepaliISO(new NepaliDate(instant));
  } catch {
    return null;
  }
}

function _notifyIssues(result, propertyName) {
  if (!result.hasIssues) return;
  createAndEmitNotification({
    type: "CHECKLIST_ISSUES_FOUND",
    title: "Daily Checklist – Issues Found",
    message: `${result.failedItems} issue(s) found in the ${result.category} checklist for ${propertyName} on ${new Date(result.checkDate).toLocaleDateString()}.`,
    data: {
      resultId: result._id,
      category: result.category,
      failedItems: result.failedItems,
      propertyId: result.property,
    },
  }).catch((err) =>
    console.error("[checklist] failed to emit issue notification:", err),
  );
}

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

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ChecklistTemplate for a property × block × category combination.
 * Uses the buildChecklistSections factory to generate the section/item tree.
 * Safe to call multiple times — upserts on the unique index.
 *
 * @param {object} data
 * @param {string} data.propertyId
 * @param {string} [data.blockId]
 * @param {string} data.category
 * @param {string} [data.checklistType]
 * @param {string} [data.name]
 * @param {object} [data.buildingConfig]
 * @param {string} adminId
 */
export async function createTemplate(data, adminId) {
  const {
    propertyId,
    blockId,
    category,
    checklistType = "DAILY",
    name = "",
    buildingConfig = {},
  } = data;

  // Check for existing template — enforce one active template per combination
  const existing = await ChecklistTemplate.findOne({
    property: propertyId,
    block: blockId ?? null,
    category,
    checklistType,
  });

  if (existing) {
    return {
      success: false,
      message:
        "A template already exists for this property × category × type combination. Use rebuildTemplate to update it.",
      data: existing,
    };
  }

  const sections = buildChecklistSections(
    category,
    buildingConfig,
    checklistType,
  );

  const template = await ChecklistTemplate.create({
    property: propertyId,
    block: blockId ?? null,
    category,
    checklistType,
    name,
    sections,
    buildingConfig,
    isActive: true,
    createdBy: adminId,
    lastRebuiltAt: new Date(),
    lastRebuiltBy: adminId,
  });

  return {
    success: true,
    message: `Template created with ${template.totalItems} items across ${template.sections.length} section(s).`,
    data: template,
  };
}

/**
 * Regenerate a template's sections from the factory (e.g. after building layout changes).
 * Existing result documents are unaffected — they keep their delta intact.
 * Future results will use the new item tree.
 *
 * WARNING: if items are removed from the template, old result itemResults
 * referencing those itemIds become orphans — the frontend should handle
 * missing itemId gracefully (show "Item removed" label).
 */
export async function rebuildTemplate(templateId, adminId) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) {
    return { success: false, message: "Template not found", data: null };
  }

  const sections = buildChecklistSections(
    template.category,
    template.buildingConfig,
    template.checklistType,
  );

  template.sections = sections;
  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  await template.save();

  return {
    success: true,
    message: `Template rebuilt with ${template.totalItems} items.`,
    data: template,
  };
}

export async function getTemplates(filters = {}) {
  const { propertyId, blockId, category, checklistType, isActive } = filters;
  const query = {};
  if (propertyId) query.property = propertyId;
  if (blockId) query.block = blockId;
  if (category) query.category = category;
  if (checklistType) query.checklistType = checklistType;
  if (isActive !== undefined)
    query.isActive = isActive === "true" || isActive === true;

  const templates = await ChecklistTemplate.find(query)
    .populate("property", "name")
    .populate("block", "name")
    .populate("createdBy", "name")
    .sort({ category: 1 })
    .lean();

  return { success: true, message: "Templates fetched", data: templates };
}

export async function getTemplateById(id) {
  const template = await ChecklistTemplate.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("createdBy", "name email");

  if (!template) {
    return { success: false, message: "Template not found", data: null };
  }
  return { success: true, message: "Template fetched", data: template };
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESULT OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a thin ChecklistResult for today, linked to a template.
 * The cron calls this for every active template every morning.
 * Idempotent — atomic upsert on (template, nepaliDate) plus unique index.
 *
 * @param {string} templateId
 * @param {object} dateData  — { checkDate, nepaliDate?, nepaliMonth?, nepaliYear? }
 * @param {string} adminId
 */
export async function createResult(templateId, dateData, adminId) {
  const template = await ChecklistTemplate.findById(templateId).lean();
  if (!template) {
    return { success: false, message: "Template not found", data: null };
  }
  if (!template.isActive) {
    return { success: false, message: "Template is inactive", data: null };
  }

  const { checkDate, nepaliMonth, nepaliYear } = dateData;
  if (!checkDate) {
    return { success: false, message: "checkDate is required", data: null };
  }

  let canonicalNepalMidnight;
  try {
    canonicalNepalMidnight = getNepalCivilUtcMidnightForInstant(checkDate);
  } catch {
    return { success: false, message: "Invalid checkDate", data: null };
  }

  const nextNepalCivilUtcMidnight = new Date(canonicalNepalMidnight);
  nextNepalCivilUtcMidnight.setUTCDate(
    nextNepalCivilUtcMidnight.getUTCDate() + 1,
  );

  const npFromNepalDay = new NepaliDate(canonicalNepalMidnight);
  const canonicalNepaliDate = formatNepaliISO(npFromNepalDay);
  const resolvedNepaliMonth = nepaliMonth ?? npFromNepalDay.getMonth() + 1;
  const resolvedNepaliYear = nepaliYear ?? npFromNepalDay.getYear();

  let createdByOid;
  try {
    createdByOid = new mongoose.Types.ObjectId(adminId);
  } catch {
    return { success: false, message: "Invalid adminId", data: null };
  }

  const setOnInsert = {
    template: template._id,
    property: template.property,
    block: template.block,
    category: template.category,
    checklistType: template.checklistType,
    checkDate: canonicalNepalMidnight,
    nepaliDate: canonicalNepaliDate,
    nepaliMonth: resolvedNepaliMonth,
    nepaliYear: resolvedNepaliYear,
    itemResults: [],
    totalItems: template.totalItems,
    passedItems: 0,
    failedItems: 0,
    hasIssues: false,
    status: "PENDING",
    createdBy: createdByOid,
  };

  const filter = { template: templateId, nepaliDate: canonicalNepaliDate };

  async function resolveAfterDuplicateKey() {
    const doc = await ChecklistResult.findOne(filter);
    if (doc) {
      return {
        success: true,
        message: "Result already exists for today",
        data: doc,
        alreadyExisted: true,
      };
    }
    return null;
  }

  // Legacy rows: same Nepal day but missing nepaliDate (claim oldest first)
  try {
    const legacy = await ChecklistResult.findOneAndUpdate(
      {
        template: templateId,
        checkDate: {
          $gte: canonicalNepalMidnight,
          $lt: nextNepalCivilUtcMidnight,
        },
        $or: [
          { nepaliDate: null },
          { nepaliDate: "" },
          { nepaliDate: { $exists: false } },
        ],
      },
      {
        $set: {
          nepaliDate: canonicalNepaliDate,
          nepaliMonth: resolvedNepaliMonth,
          nepaliYear: resolvedNepaliYear,
        },
      },
      { new: true, sort: { createdAt: 1 } },
    );
    if (legacy) {
      return {
        success: true,
        message: "Result already exists for today",
        data: legacy,
        alreadyExisted: true,
      };
    }
  } catch (err) {
    if (err.code === 11000 || err.codeName === "DuplicateKey") {
      const resolved = await resolveAfterDuplicateKey();
      if (resolved) return resolved;
    }
    throw err;
  }

  try {
    const meta = await ChecklistResult.findOneAndUpdate(
      filter,
      { $setOnInsert: setOnInsert },
      {
        upsert: true,
        new: true,
        includeResultMetadata: true,
        runValidators: true,
      },
    );

    const leo = meta.lastErrorObject;
    const wasInsert =
      leo?.updatedExisting === false ||
      meta.upsertedCount === 1 ||
      meta.upsertedId != null;

    return {
      success: true,
      message: wasInsert
        ? "Checklist result created"
        : "Result already exists for today",
      data: meta.value,
      alreadyExisted: !wasInsert,
    };
  } catch (err) {
    if (err.code === 11000 || err.codeName === "DuplicateKey") {
      const resolved = await resolveAfterDuplicateKey();
      if (resolved) return resolved;
    }
    throw err;
  }
}

/**
 * Submit results for a checklist. The caller sends ONLY the items that
 * failed or have notes — passing items can be omitted entirely.
 *
 * Body shape:
 * {
 *   itemResults: [
 *     { itemId: "...", sectionKey: "ELEC_PANEL", isOk: false, notes: "MCB tripped" },
 *     { itemId: "...", sectionKey: "CCTV_CAMERAS", isOk: true, notes: "Lens dusty" }
 *   ],
 *   overallNotes: "...",
 *   status: "COMPLETED" | "INCOMPLETE",
 *   nepaliDate: "...",
 *   nepaliMonth: N,
 *   nepaliYear: N,
 * }
 *
 * Auto-creates Maintenance tasks for each item where isOk = false
 * that doesn't already have a linkedMaintenanceId.
 */
export async function submitResult(resultId, updateData, adminId) {
  const result = await ChecklistResult.findById(resultId).populate(
    "property",
    "name",
  );
  if (!result) {
    return { success: false, message: "Result not found", data: null };
  }

  // ── Merge incoming item results ───────────────────────────────────────────
  // Strategy: replace the entire itemResults array with the submitted data.
  // The caller is responsible for including ALL items they want to record
  // (including previously noted items they want to update).
  if (Array.isArray(updateData.itemResults)) {
    result.itemResults = updateData.itemResults.map((r) => ({
      itemId: r.itemId,
      sectionKey: r.sectionKey,
      isOk: r.isOk ?? false,
      notes: r.notes ?? "",
      linkedMaintenanceId: r.linkedMaintenanceId ?? null,
    }));
  }

  if (updateData.overallNotes !== undefined) {
    result.overallNotes = updateData.overallNotes;
  }

  result.status = updateData.status ?? "COMPLETED";
  result.submittedAt = new Date();
  result.submittedBy = adminId;

  if (updateData.nepaliDate) result.nepaliDate = updateData.nepaliDate;
  if (updateData.nepaliMonth) result.nepaliMonth = updateData.nepaliMonth;
  if (updateData.nepaliYear) result.nepaliYear = updateData.nepaliYear;

  // Pre-save hook recomputes failedItems / passedItems / hasIssues
  await result.save();

  // ── Auto-create Maintenance tasks for failed items ────────────────────────
  const createdTasks = [];
  const failedItems = result.itemResults.filter(
    (r) => !r.isOk && !r.linkedMaintenanceId,
  );

  if (failedItems.length > 0) {
    // Fetch template once to get item labels for the maintenance task title
    const template = await ChecklistTemplate.findById(result.template)
      .select("sections")
      .lean();

    const itemLabelMap = {};
    if (template) {
      for (const sec of template.sections) {
        for (const it of sec.items) {
          itemLabelMap[it._id.toString()] = it.label;
        }
      }
    }

    for (const ir of failedItems) {
      const label = itemLabelMap[ir.itemId.toString()] ?? "Unknown Item";
      const task = await Maintenance.create({
        title: `[Auto] ${label}`,
        description:
          ir.notes ||
          `Issue detected during ${result.category} daily checklist on ${new Date(result.checkDate).toLocaleDateString()}.`,
        property: result.property._id ?? result.property,
        block: result.block ?? null,
        scope: "COMMON_AREA", // checklist failures are always common-area/building-level
        scheduledDate: new Date(),
        type: "Repair",
        priority: _inferPriority(ir.sectionKey, result.category),
        status: "OPEN",
        createdBy: adminId,
        scheduledNepaliMonth: result.nepaliMonth ?? null,
        scheduledNepaliYear: result.nepaliYear ?? null,
        // ── Origin tracing ──────────────────────────────────────────────────────
        sourceType: "CHECKLIST",
        sourceRef: result._id, // the ChecklistResult that spawned this
        sourceRefModel: "ChecklistResult",
      });

      ir.linkedMaintenanceId = task._id;
      createdTasks.push(task);
    }

    // Persist the linkedMaintenanceId updates
    if (createdTasks.length) {
      await result.save();
    }

    _notifyIssues(result, result.property?.name ?? "Unknown Property");
  }

  return {
    success: true,
    message: `Checklist submitted. ${createdTasks.length} repair task(s) auto-created.`,
    data: result,
    autoCreatedTasks: createdTasks,
  };
}

/**
 * Fetch a list of results.
 * Results do NOT include sections — callers use getResultById for the full view.
 *
 * Date filtering: use `nepaliDate` (BS YYYY-MM-DD) and/or `startDate`/`endDate`
 * (Gregorian YYYY-MM-DD, converted to BS for querying). Do not rely on `checkDate`
 * for calendar-day semantics — it is stored as Nepal civil midnight in UTC.
 */
export async function getResults(filters = {}) {
  const {
    propertyId,
    blockId,
    templateId,
    category,
    checklistType,
    hasIssues,
    status,
    nepaliYear,
    nepaliMonth,
    nepaliDate: nepaliDateFilter,
    startDate,
    endDate,
    page = 1,
    limit = 30,
  } = filters;

  const query = {};
  if (propertyId) query.property = propertyId;
  if (blockId) query.block = blockId;
  if (templateId) query.template = templateId;
  if (category) query.category = category;
  if (checklistType) query.checklistType = checklistType;
  if (hasIssues !== undefined)
    query.hasIssues = hasIssues === "true" || hasIssues === true;
  if (status) query.status = status;
  if (nepaliYear) query.nepaliYear = Number(nepaliYear);
  if (nepaliMonth) query.nepaliMonth = Number(nepaliMonth);

  // Date filters: use canonical BS `nepaliDate` — never `checkDate` vs UTC
  // midnight (see createResult / Nepal timezone).
  if (nepaliDateFilter) {
    const nd = String(nepaliDateFilter).split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(nd)) {
      query.nepaliDate = nd;
    }
  } else if (startDate || endDate) {
    const nStart = startDate ? _englishIsoDateToNepaliISO(startDate) : null;
    const nEnd = endDate ? _englishIsoDateToNepaliISO(endDate) : null;
    const range = {};
    if (nStart) range.$gte = nStart;
    if (nEnd) range.$lte = nEnd;
    if (Object.keys(range).length) {
      query.nepaliDate = range;
    }
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [results, total] = await Promise.all([
    ChecklistResult.find(query)
      .populate("property", "name")
      .populate("block", "name")
      .populate("submittedBy", "name")
      .populate("template", "name category totalItems")
      .sort({ nepaliDate: -1, checkDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    ChecklistResult.countDocuments(query),
  ]);

  return {
    success: true,
    message: "Results fetched",
    data: results,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    },
  };
}

/**
 * Fetch a single result with FULL merged view:
 * template sections + itemResults delta → reconstructed full section tree.
 *
 * Each item in the returned sections has:
 *   { _id, label, quantity, isOk, notes, linkedMaintenanceId }
 * where isOk/notes come from itemResults if the item appears there,
 * otherwise isOk defaults to true (passed) and notes to "".
 */
export async function getResultById(id) {
  const result = await ChecklistResult.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("submittedBy", "name email")
    .populate("createdBy", "name email")
    .populate({
      path: "itemResults.linkedMaintenanceId",
      select: "title status priority",
    })
    .lean();

  if (!result) {
    return { success: false, message: "Result not found", data: null };
  }

  // Fetch template to reconstruct the full view
  const template = await ChecklistTemplate.findById(result.template)
    .select("sections name totalItems")
    .lean();

  if (!template) {
    // Template deleted — return raw result without merge
    return {
      success: true,
      message: "Result fetched (template missing)",
      data: result,
    };
  }

  // Build a lookup map: itemId → result entry
  const resultMap = {};
  for (const ir of result.itemResults) {
    resultMap[ir.itemId.toString()] = ir;
  }

  // Reconstruct full section tree with merged outcomes
  const mergedSections = template.sections.map((sec) => ({
    sectionKey: sec.sectionKey,
    sectionLabel: sec.sectionLabel,
    _id: sec._id,
    items: sec.items.map((it) => {
      const outcome = resultMap[it._id.toString()];
      return {
        _id: it._id,
        label: it.label,
        quantity: it.quantity,
        isOk: outcome ? outcome.isOk : true, // default: passed
        notes: outcome ? outcome.notes : "",
        linkedMaintenanceId: outcome?.linkedMaintenanceId ?? null,
      };
    }),
  }));

  return {
    success: true,
    message: "Result fetched",
    data: {
      ...result,
      sections: mergedSections, // full view for the frontend
      templateName: template.name,
    },
  };
}

/**
 * Aggregation summary for the dashboard health cards.
 * Groups by category and returns: total runs, runs with issues,
 * average pass rate, and last checked date.
 */
export async function getResultSummary(propertyId, nepaliYear, nepaliMonth) {
  const match = { property: new mongoose.Types.ObjectId(propertyId) };

  if (nepaliYear) match.nepaliYear = Number(nepaliYear);
  if (nepaliMonth) match.nepaliMonth = Number(nepaliMonth);

  const results = await ChecklistResult.aggregate([
    { $match: match },

    {
      $group: {
        _id: "$category",

        totalRuns: { $sum: 1 },

        completedRuns: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },

        pendingRuns: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
        },

        withIssues: {
          $sum: { $cond: ["$hasIssues", 1, 0] },
        },

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
  ]);

  const totalCategories = results.length;

  const completedCategories = results.filter((r) => r.completedRuns > 0).length;

  const pendingCategories = totalCategories - completedCategories;

  const completionRate =
    totalCategories > 0
      ? Math.round((completedCategories / totalCategories) * 100)
      : 0;

  const avgPassRate =
    results.length > 0
      ? Math.round(
          results.reduce((acc, r) => acc + (r.avgPassRate || 0), 0) /
            results.length,
        )
      : 0;

  const lastChecked =
    results.length > 0
      ? results.reduce(
          (max, r) => (r.lastChecked > max ? r.lastChecked : max),
          new Date(0),
        )
      : null;

  return {
    success: true,
    message: "Safety summary fetched",
    data: {
      totalCategories,
      completedCategories,
      pendingCategories,
      completionRate,
      avgPassRate,
      lastChecked,
      categories: results,
    },
  };
}

export async function deleteResult(id) {
  const deleted = await ChecklistResult.findByIdAndDelete(id);
  if (!deleted) {
    return { success: false, message: "Result not found" };
  }
  return { success: true, message: "Result deleted" };
}
export async function getCalendarSummary(propertyId, nepaliYear, nepaliMonth) {
  if (!propertyId) {
    return { success: false, message: "propertyId is required" };
  }

  const match = { property: new mongoose.Types.ObjectId(propertyId) };
  if (nepaliYear) match.nepaliYear = Number(nepaliYear);
  if (nepaliMonth) match.nepaliMonth = Number(nepaliMonth);

  const rows = await ChecklistResult.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$nepaliDate",
        englishDate: { $first: "$checkDate" },
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "COMPLETED"] }, 1, 0] },
        },
        pending: { $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] } },
        withIssues: { $sum: { $cond: ["$hasIssues", 1, 0] } },
        sumPassed: { $sum: "$passedItems" },
        sumTotal: { $sum: "$totalItems" },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const days = rows.map((r) => ({
    nepaliDate: r._id,
    englishDate: r.englishDate,
    total: r.total,
    completed: r.completed,
    pending: r.pending,
    withIssues: r.withIssues,
    passRate:
      r.sumTotal > 0 ? Math.round((r.sumPassed / r.sumTotal) * 100) : null,
  }));

  return { success: true, message: "Calendar summary fetched", data: days };
}

/**
 * getTodayResults
 *
 * Fetch all results for a given nepaliDate (defaults to today).
 * Returns the full list — no pagination needed since a single day
 * will have at most (categories × blocks) results, typically < 30.
 *
 * Called by GET /api/checklists/today?propertyId=&nepaliDate=
 */
export async function getTodayResults(propertyId, nepaliDate) {
  if (!propertyId) {
    return { success: false, message: "propertyId is required" };
  }

  // Default to today's Nepali date if not provided
  let targetDate = nepaliDate;
  if (!targetDate) {
    const nd = new NepaliDate(new Date());
    targetDate = formatNepaliISO(nd);
  }

  const results = await ChecklistResult.find({
    property: propertyId,
    nepaliDate: targetDate,
  })
    .populate("block", "name")
    .populate("submittedBy", "name")
    .populate("template", "name totalItems")
    .sort({ category: 1 })
    .lean();

  return {
    success: true,
    message: "Today's results fetched",
    data: results,
    meta: { nepaliDate: targetDate, count: results.length },
  };
}
export async function addSectionToTemplate(templateId, sectionData, adminId) {
  const { sectionKey, sectionLabel, items = [] } = sectionData;

  if (!sectionKey || !sectionLabel) {
    return {
      success: false,
      message: "sectionKey and sectionLabel are required",
    };
  }

  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const exists = template.sections.some((s) => s.sectionKey === sectionKey);
  if (exists) {
    return {
      success: false,
      message: `Section key "${sectionKey}" already exists in this template`,
    };
  }

  template.sections.push({
    sectionKey,
    sectionLabel,
    items: items.map(({ label, quantity = null }) => ({ label, quantity })),
  });

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  await template.save(); // pre-save hook recounts totalItems

  return {
    success: true,
    message: `Section "${sectionLabel}" added. Template now has ${template.totalItems} items.`,
    data: template,
  };
}
/**
 * Rename a section's label (sectionKey is immutable — it's used as the foreign key
 * in result itemResults[].sectionKey; changing it would orphan old results).
 *
 * Body shape: { sectionLabel: "New Label" }
 */
export async function updateSectionInTemplate(
  templateId,
  sectionKey,
  updates,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const section = template.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) {
    return {
      success: false,
      message: `Section "${sectionKey}" not found in template`,
    };
  }

  // Only label is editable; sectionKey is intentionally locked
  if (updates.sectionLabel) section.sectionLabel = updates.sectionLabel;

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return { success: true, message: "Section updated", data: template };
}
/**
 * Remove an entire section from a template.
 *
 * IMPORTANT: existing ChecklistResult documents that reference itemIds from
 * this section will have orphaned itemResults entries. The getResultById
 * merge already handles missing items gracefully (shows "Item removed").
 * Still, prefer deactivating / emptying a section over hard-removing it
 * when the template has recent results.
 */
export async function removeSectionFromTemplate(
  templateId,
  sectionKey,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const idx = template.sections.findIndex((s) => s.sectionKey === sectionKey);
  if (idx === -1) {
    return {
      success: false,
      message: `Section "${sectionKey}" not found in template`,
    };
  }

  template.sections.splice(idx, 1);
  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  await template.save();

  return {
    success: true,
    message: `Section "${sectionKey}" removed. Template now has ${template.totalItems} items.`,
    data: template,
  };
}
/**
 * Add a single item to an existing section.
 *
 * Body shape: { label: "Emergency Light – Corridor B2", quantity: 4 }
 */
export async function addItemToTemplate(templateId, sectionKey, item, adminId) {
  const { label, quantity = null } = item;

  if (!label?.trim()) {
    return { success: false, message: "Item label is required" };
  }

  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const section = template.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) {
    return {
      success: false,
      message: `Section "${sectionKey}" not found in template`,
    };
  }

  section.items.push({ label: label.trim(), quantity });
  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  // Return the new item's _id so the frontend can reference it immediately
  const newItem = section.items[section.items.length - 1];

  return {
    success: true,
    message: `Item "${label}" added to ${sectionKey}`,
    data: { template, newItemId: newItem._id },
  };
}
/**
 * Edit an existing item's label or quantity.
 *
 * Body shape: { label?: "Updated label", quantity?: 6 }
 *
 * NOTE: The item's _id (used as itemId in result.itemResults) is NOT changed.
 * Old results pointing to this itemId will automatically show the updated label
 * because getResultById re-fetches from the template at read time.
 */
export async function updateItemInTemplate(
  templateId,
  sectionKey,
  itemId,
  updates,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const section = template.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) {
    return {
      success: false,
      message: `Section "${sectionKey}" not found in template`,
    };
  }

  const item = section.items.id(itemId);
  if (!item) {
    return {
      success: false,
      message: `Item "${itemId}" not found in section "${sectionKey}"`,
    };
  }

  if (updates.label !== undefined) item.label = updates.label.trim();
  if (updates.quantity !== undefined) item.quantity = updates.quantity;

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return { success: true, message: "Item updated", data: template };
}

/**
 * Remove a single item from a section.
 *
 * Same orphan caveat as removeSectionFromTemplate — old results that have
 * itemResults referencing this itemId become orphans. getResultById handles
 * this gracefully already.
 */
export async function removeItemFromTemplate(
  templateId,
  sectionKey,
  itemId,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const section = template.sections.find((s) => s.sectionKey === sectionKey);
  if (!section) {
    return {
      success: false,
      message: `Section "${sectionKey}" not found in template`,
    };
  }

  const itemIndex = section.items.findIndex(
    (it) => it._id.toString() === itemId,
  );
  if (itemIndex === -1) {
    return {
      success: false,
      message: `Item "${itemId}" not found in section "${sectionKey}"`,
    };
  }

  section.items.splice(itemIndex, 1);
  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return {
    success: true,
    message: `Item removed. Section "${sectionKey}" now has ${section.items.length} items.`,
    data: template,
  };
}

/**
 * Reorder sections by providing a full ordered list of sectionKeys.
 * All existing sectionKeys must be present — this is a reorder, not a delete.
 *
 * Body shape: { orderedSectionKeys: ["ELEC_PANEL", "COMMON_AREA_B1", "PARKING_B2"] }
 */
export async function reorderSectionsInTemplate(
  templateId,
  orderedSectionKeys,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const existingKeys = template.sections.map((s) => s.sectionKey);

  // Validate: every existing key must appear in the new order (no deletions)
  const missing = existingKeys.filter((k) => !orderedSectionKeys.includes(k));
  if (missing.length) {
    return {
      success: false,
      message: `orderedSectionKeys is missing: ${missing.join(", ")}`,
    };
  }

  const sectionMap = Object.fromEntries(
    template.sections.map((s) => [s.sectionKey, s]),
  );

  template.sections = orderedSectionKeys
    .filter((k) => sectionMap[k]) // ignore unknown keys gracefully
    .map((k) => sectionMap[k]);

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return { success: true, message: "Sections reordered", data: template };
}
