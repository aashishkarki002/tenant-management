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
import { ChecklistTemplate } from "./checkListTemplate.model.js";
import { ChecklistResult } from "./checkListResult.model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { buildChecklistSections } from "./checkListTemplate.js";
import { getNepaliYearMonthFromDate } from "../../utils/nepaliDateHelper.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

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
 * Idempotent — returns the existing result if one already exists for today.
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

  const { checkDate, nepaliDate, nepaliMonth, nepaliYear } = dateData;

  // Derive Nepali date from English date if not provided
  let resolvedNepaliMonth = nepaliMonth;
  let resolvedNepaliYear = nepaliYear;
  if (checkDate && (!resolvedNepaliMonth || !resolvedNepaliYear)) {
    const derived = getNepaliYearMonthFromDate(checkDate);
    resolvedNepaliMonth = resolvedNepaliMonth ?? derived.npMonth;
    resolvedNepaliYear = resolvedNepaliYear ?? derived.npYear;
  }

  // Idempotency guard: one result per template per day
  // Use UTC to avoid timezone issues
  const startOfDay = new Date(checkDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(checkDate);
  endOfDay.setUTCHours(23, 59, 59, 999);

  const existing = await ChecklistResult.findOne({
    template: templateId,
    checkDate: { $gte: startOfDay, $lte: endOfDay },
  })
    .select("_id status")
    .lean();

  if (existing) {
    return {
      success: true,
      message: "Result already exists for today",
      data: existing,
      alreadyExisted: true,
    };
  }

  // Create the thin result — no sections array, just the reference + counters
  const result = await ChecklistResult.create({
    template: templateId,
    property: template.property,
    block: template.block,
    category: template.category,
    checklistType: template.checklistType,
    checkDate: new Date(checkDate),
    nepaliDate: nepaliDate ?? null,
    nepaliMonth: resolvedNepaliMonth ?? null,
    nepaliYear: resolvedNepaliYear ?? null,
    itemResults: [], // empty until submitted
    totalItems: template.totalItems, // copied from template — no join needed later
    passedItems: 0, // 0 until submitted — correctly reflects "not yet checked"
    failedItems: 0,
    hasIssues: false,
    status: "PENDING",
    createdBy: adminId,
  });

  return {
    success: true,
    message: "Checklist result created",
    data: result,
    alreadyExisted: false,
  };
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
        scheduledDate: new Date(),
        type: "Repair",
        priority: _inferPriority(ir.sectionKey, result.category),
        status: "OPEN",
        createdBy: adminId,
        scheduledNepaliMonth: result.nepaliMonth ?? null,
        scheduledNepaliYear: result.nepaliYear ?? null,
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
 * Fetch a list of results. Supports all the same filters as before.
 * Results do NOT include sections — callers use getResultById for the full view.
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

  if (startDate || endDate) {
    query.checkDate = {};
    if (startDate) query.checkDate.$gte = new Date(startDate);
    if (endDate) query.checkDate.$lte = new Date(endDate);
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [results, total] = await Promise.all([
    ChecklistResult.find(query)
      .populate("property", "name")
      .populate("block", "name")
      .populate("submittedBy", "name")
      .populate("template", "name category totalItems")
      .sort({ checkDate: -1 })
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

  const summary = await ChecklistResult.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$category",
        totalRuns: { $sum: 1 },
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
        pendingCount: {
          $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { success: true, message: "Summary fetched", data: summary };
}

export async function deleteResult(id) {
  const deleted = await ChecklistResult.findByIdAndDelete(id);
  if (!deleted) {
    return { success: false, message: "Result not found" };
  }
  return { success: true, message: "Result deleted" };
}
