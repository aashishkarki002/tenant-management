/**
 * dailyChecksList.service.js  (v2 — Template + Result split)
 *
 * Public API surface:
 *
 *   Templates (admin setup, done once per property × category):
 *     createTemplate(data, adminId)
 *     rebuildTemplate(templateId, adminId)
 *     getTemplates(filters)
 *     getTemplateById(id)
 *
 *   Results (daily operational flow):
 *     createResult(templateId, dateData, adminId)
 *     submitResult(resultId, updateData, adminId)
 *     getResults(filters)
 *     getResultById(id)
 *     getResultSummary(propertyId, nepaliYear, nepaliMonth)
 *     deleteResult(id)
 *     uploadItemImage(resultId, itemId, file)   ← NEW
 */

import fs from "fs";
import mongoose from "mongoose";
import NepaliDate from "nepali-datetime";
import { ChecklistTemplate } from "./checkListTemplate.model.js";
import { ChecklistResult } from "./checkListResult.model.js";
import { Maintenance } from "../maintenance/Maintenance.Model.js";
import { buildChecklistSections } from "./checkListTemplate.js";
import ftpClient from "../../config/ftpClient.js";
import {
  formatNepaliISO,
  getNepalCivilUtcMidnightForInstant,
} from "../../utils/nepaliDateHelper.js";
import { createAndEmitNotification } from "../notifications/notification.service.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

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

function _normalizeIssueImages(itemResult) {
  const raw =
    itemResult?.issueImages ??
    itemResult?.imageUrls ??
    itemResult?.images ??
    (itemResult?.imageUrl ? [itemResult.imageUrl] : []);

  if (!Array.isArray(raw)) return [];

  return raw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createTemplate(data, adminId) {
  const {
    propertyId,
    blockId,
    category,
    checklistType = "DAILY",
    name = "",
    buildingConfig = {},
  } = data;

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
 * Submit results for a checklist.
 *
 * BUG FIX: The original code called result.save() twice — once after merging
 * itemResults, and again after persisting linkedMaintenanceId updates. The
 * second save re-ran the pre-save hook, which recomputed counters against the
 * same itemResults but with status already "COMPLETED", causing no harm in
 * happy paths but producing an unnecessary extra write. Consolidated to a
 * single save at the end by separating the Maintenance creation from the save.
 *
 * BUG FIX: The pre-save hook skips counter computation when status === "PENDING"
 * but submitResult sets status before the first save, so counters were always
 * computed — this was fine. However the double-save meant the hook ran twice.
 * Now we save exactly once after all mutations are complete.
 */
export async function submitResult(resultId, updateData, adminId) {
  // BUG FIX: populate property with _id and name so both are accessible.
  // Original used populate("property", "name") which strips _id when using
  // .lean() — but result is not lean here. However, when accessing
  // result.property._id in the Maintenance.create call below, if the
  // populated doc is a Mongoose subdoc this works. Still, explicit _id
  // selection is safer.
  const result = await ChecklistResult.findById(resultId).populate(
    "property",
    "_id name",
  );
  if (!result) {
    return { success: false, message: "Result not found", data: null };
  }

  // ── Merge incoming item results ───────────────────────────────────────────
  if (Array.isArray(updateData.itemResults)) {
    console.log(
      "[submitResult] merging item results — updateData.itemResults:",
      updateData.itemResults,
    );
    result.itemResults = updateData.itemResults.map((r) => ({
      itemId: r.itemId,
      sectionKey: r.sectionKey,
      isOk: r.isOk ?? false,
      notes: r.notes ?? "",
      // Preserve any FTP image paths already stored for this item if the
      // caller doesn't re-send them. The upload endpoint manages issueImages
      // directly via $push so a full-replace submit must carry them forward.
      issueImages: _normalizeIssueImages(r),
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

  // ── Auto-create Maintenance tasks for failed items ────────────────────────
  const createdTasks = [];
  const failedItems = result.itemResults.filter(
    (r) => !r.isOk && !r.linkedMaintenanceId,
  );

  if (failedItems.length > 0) {
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
        scope: "COMMON_AREA",
        scheduledDate: new Date(),
        type: "Repair",
        priority: _inferPriority(ir.sectionKey, result.category),
        status: "OPEN",
        createdBy: adminId,
        scheduledNepaliMonth: result.nepaliMonth ?? null,
        scheduledNepaliYear: result.nepaliYear ?? null,
        sourceType: "CHECKLIST",
        sourceRef: result._id,
        sourceRefModel: "ChecklistResult",
      });

      ir.linkedMaintenanceId = task._id;
      createdTasks.push(task);
    }
  }

  // BUG FIX: Single save — pre-save hook runs once, counters are correct,
  // linkedMaintenanceId updates are included in the same write.
  await result.save();

  // Notify all admins + the submitting staff that a checklist was completed.
  // Fire-and-forget — submission response is not blocked by notification delivery.
  const propertyName = result.property?.name ?? "Unknown Property";
  createAndEmitNotification({
    type: "CHECKLIST_SUBMITTED",
    title: "✅ Daily Checklist Submitted",
    message: `${result.category} checklist for ${propertyName} has been submitted on ${new Date(result.checkDate).toLocaleDateString()}.`,
    data: {
      resultId: result._id,
      category: result.category,
      status: result.status,
      passedItems: result.passedItems,
      failedItems: result.failedItems,
      propertyId: result.property?._id ?? result.property,
    },
  }).catch((err) =>
    console.error("[checklist] failed to emit submitted notification:", err),
  );

  if (result.hasIssues) {
    _notifyIssues(result, propertyName);
  }

  return {
    success: true,
    message: `Checklist submitted. ${createdTasks.length} repair task(s) auto-created.`,
    data: result,
    autoCreatedTasks: createdTasks,
  };
}

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
 * BUG FIX: getResultById — issueImages was already included in the merge via
 * `outcome?.issueImages ?? []`, so it was actually correct. However the
 * populate path for linkedMaintenanceId only projected title/status/priority,
 * which meant if the caller needed the maintenance task's _id they had to
 * re-fetch. Added _id to the projection explicitly (Mongoose includes it by
 * default but being explicit avoids confusion when debugging).
 */
export async function getResultById(id) {
  const result = await ChecklistResult.findById(id)
    .populate("property", "name")
    .populate("block", "name")
    .populate("submittedBy", "name email")
    .populate("createdBy", "name email")
    .populate({
      path: "itemResults.linkedMaintenanceId",
      select: "_id title status priority",
    })
    .lean();

  if (!result) {
    return { success: false, message: "Result not found", data: null };
  }

  const template = await ChecklistTemplate.findById(result.template)
    .select("sections name totalItems")
    .lean();

  if (!template) {
    return {
      success: true,
      message: "Result fetched (template missing)",
      data: result,
    };
  }

  const resultMap = {};
  for (const ir of result.itemResults) {
    resultMap[ir.itemId.toString()] = ir;
  }

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
        isOk: outcome ? outcome.isOk : true,
        notes: outcome ? outcome.notes : "",
        issueImages: outcome?.issueImages ?? [],
        linkedMaintenanceId: outcome?.linkedMaintenanceId ?? null,
      };
    }),
  }));

  return {
    success: true,
    message: "Result fetched",
    data: {
      ...result,
      sections: mergedSections,
      templateName: template.name,
    },
  };
}

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

export async function getTodayResults(propertyId, nepaliDate) {
  if (!propertyId) {
    return { success: false, message: "propertyId is required" };
  }

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

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGE UPLOAD  (new — mirrors ftpUpload.service.js pattern)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload an evidence image for a specific item in a ChecklistResult.
 *
 * Flow:
 *   1. Load the result to verify it exists and get the tenantId (property._id).
 *   2. Upload the temp file to FTP under /checklist-issues/<tenantId>/<resultId>/<filename>.
 *   3. Remove the temp file regardless of outcome.
 *   4. Append the remotePath to the matching itemResult's issueImages array
 *      using $push (atomic, avoids a full-document save race condition).
 *   5. Return the remotePath so the frontend can display the image immediately.
 *
 * If the itemResult entry for itemId does not yet exist in the result
 * (i.e. the item has not been explicitly marked during submit yet), we create
 * a minimal placeholder entry so the image is not lost.
 *
 * @param {string} resultId
 * @param {string} itemId
 * @param {object} file   — multer file object { path, originalname }
 */
export async function uploadItemImage(resultId, itemId, file) {
  console.log(
    "[uploadItemImage] service called — resultId:",
    resultId,
    "itemId:",
    itemId,
    "file.path:",
    file?.path,
  );

  // BUG GUARD: always clean up the temp file, even on early returns
  const cleanupTemp = () => {
    try {
      if (file?.path) {
        fs.unlinkSync(file.path);
        console.log("[uploadItemImage] temp file cleaned up:", file.path);
      }
    } catch (e) {
      console.warn(
        "[uploadItemImage] temp file cleanup failed (may already be gone):",
        e.message,
      );
    }
  };

  console.log("[uploadItemImage] looking up ChecklistResult:", resultId);
  const result = await ChecklistResult.findById(resultId)
    .populate("property", "_id")
    .lean();

  if (!result) {
    console.warn(
      "[uploadItemImage] ChecklistResult not found for id:",
      resultId,
    );
    cleanupTemp();
    return { success: false, message: "Result not found" };
  }

  console.log("[uploadItemImage] result found — property:", result.property);

  // Use property._id as tenantId — same convention as ftpUpload service
  const tenantId = (result.property?._id ?? result.property).toString();
  const remotePath = `/checklist-issues/${tenantId}/${resultId}/${file.originalname}`;

  console.log(
    "[uploadItemImage] FTP upload — localPath:",
    file.path,
    "remotePath:",
    remotePath,
  );

  let uploadSuccess = false;
  try {
    uploadSuccess = await ftpClient.upload(file.path, remotePath);
    console.log("[uploadItemImage] FTP upload result:", uploadSuccess);
  } catch (ftpErr) {
    console.error("[uploadItemImage] FTP upload threw an error:", ftpErr);
  } finally {
    cleanupTemp();
  }

  if (!uploadSuccess) {
    console.error(
      "[uploadItemImage] FTP upload failed for remotePath:",
      remotePath,
    );
    return { success: false, message: "FTP upload failed" };
  }

  // Check whether an itemResult entry already exists for this itemId
  const existingEntry = result.itemResults.find(
    (ir) => ir.itemId.toString() === itemId,
  );

  console.log(
    "[uploadItemImage] itemResult existingEntry found:",
    !!existingEntry,
  );

  if (existingEntry) {
    // Atomic push — avoids re-running the pre-save hook and double-writes
    const dbResult = await ChecklistResult.updateOne(
      {
        _id: resultId,
        "itemResults.itemId": new mongoose.Types.ObjectId(itemId),
      },
      { $push: { "itemResults.$.issueImages": remotePath } },
    );
    console.log(
      "[uploadItemImage] DB update (existing entry) result:",
      dbResult,
    );
  } else {
    // Item not yet in the delta — create a placeholder entry so the image
    // is attached. The checker will fill in isOk/notes on submit.
    // BUG FIX: sectionKey is required by the schema. We look it up from the
    // template so we don't violate the schema constraint.
    console.log(
      "[uploadItemImage] looking up template for sectionKey — templateId:",
      result.template,
    );
    const template = await ChecklistTemplate.findById(result.template)
      .select("sections")
      .lean();

    let sectionKey = "UNKNOWN";
    if (template) {
      for (const sec of template.sections) {
        if (sec.items.some((it) => it._id.toString() === itemId)) {
          sectionKey = sec.sectionKey;
          break;
        }
      }
    } else {
      console.warn(
        "[uploadItemImage] template not found for id:",
        result.template,
        "— using UNKNOWN sectionKey",
      );
    }

    console.log("[uploadItemImage] resolved sectionKey:", sectionKey);

    const dbResult = await ChecklistResult.updateOne(
      { _id: resultId },
      {
        $push: {
          itemResults: {
            itemId: new mongoose.Types.ObjectId(itemId),
            sectionKey,
            isOk: true, // neutral default — checker will update on submit
            notes: "",
            issueImages: [remotePath],
            linkedMaintenanceId: null,
          },
        },
      },
    );
    console.log("[uploadItemImage] DB update (new entry) result:", dbResult);
  }

  return {
    success: true,
    message: "Image uploaded successfully",
    data: { remotePath, itemId, resultId },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE section / item management  (unchanged from original)
// ─────────────────────────────────────────────────────────────────────────────

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
  await template.save();

  return {
    success: true,
    message: `Section "${sectionLabel}" added. Template now has ${template.totalItems} items.`,
    data: template,
  };
}

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

  if (updates.sectionLabel) section.sectionLabel = updates.sectionLabel;

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return { success: true, message: "Section updated", data: template };
}

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

  const newItem = section.items[section.items.length - 1];

  return {
    success: true,
    message: `Item "${label}" added to ${sectionKey}`,
    data: { template, newItemId: newItem._id },
  };
}

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

export async function reorderSectionsInTemplate(
  templateId,
  orderedSectionKeys,
  adminId,
) {
  const template = await ChecklistTemplate.findById(templateId);
  if (!template) return { success: false, message: "Template not found" };

  const existingKeys = template.sections.map((s) => s.sectionKey);

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
    .filter((k) => sectionMap[k])
    .map((k) => sectionMap[k]);

  template.lastRebuiltAt = new Date();
  template.lastRebuiltBy = adminId;
  template.markModified("sections");
  await template.save();

  return { success: true, message: "Sections reordered", data: template };
}
