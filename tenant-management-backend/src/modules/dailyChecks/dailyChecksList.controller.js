/**
 * dailyChecksList.controller.js  (v2 — Template + Result split)
 */

import {
  createTemplate,
  rebuildTemplate,
  getTemplates,
  getTemplateById,
  createResult,
  submitResult,
  getResults,
  getResultById,
  getResultSummary,
  deleteResult,
  getCalendarSummary,
  getTodayResults,
  addSectionToTemplate,
  updateSectionInTemplate,
  removeSectionFromTemplate,
  addItemToTemplate,
  updateItemInTemplate,
  removeItemFromTemplate,
  reorderSectionsInTemplate,
} from "./dailyChecksList.service.js";

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE controllers (admin setup — done once per property × category)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/checklists/templates
export async function createTemplateController(req, res) {
  try {
    const result = await createTemplate(req.body, req.admin.id);
    return res.status(result.success ? 201 : 409).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// POST /api/checklists/templates/:id/rebuild
// Re-runs the factory to regenerate sections (e.g. after building layout change)
export async function rebuildTemplateController(req, res) {
  try {
    const result = await rebuildTemplate(req.params.id, req.admin.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/templates?propertyId=&category=&checklistType=&isActive=
export async function getTemplatesController(req, res) {
  try {
    const result = await getTemplates(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/templates/:id
export async function getTemplateByIdController(req, res) {
  try {
    const result = await getTemplateById(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  RESULT controllers (daily operational flow)
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/checklists/results
// Body: { templateId, checkDate, nepaliDate?, nepaliMonth?, nepaliYear? }
export async function createResultController(req, res) {
  try {
    const { templateId, ...dateData } = req.body;
    if (!templateId) {
      return res
        .status(400)
        .json({ success: false, message: "templateId is required" });
    }
    const result = await createResult(templateId, dateData, req.admin.id);
    const statusCode = result.alreadyExisted ? 200 : 201;
    return res.status(result.success ? statusCode : 404).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// PATCH /api/checklists/results/:id/submit
// Body: { itemResults: [...], overallNotes?, status?, nepaliDate?, ... }
export async function submitResultController(req, res) {
  try {
    const result = await submitResult(req.params.id, req.body, req.admin.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/results?propertyId=&blockId=&category=&status=&nepaliYear=&nepaliMonth=&nepaliDate=&startDate=&endDate=&page=&limit=
// Date filters use stored BS `nepaliDate` (not `checkDate`). Pass `nepaliDate=2082-04-01` for a single day, or `startDate`/`endDate` as Gregorian YYYY-MM-DD to filter by converted BS range.
export async function getResultsController(req, res) {
  try {
    const result = await getResults(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/results/:id  — full merged view (template sections + delta)
export async function getResultByIdController(req, res) {
  try {
    const result = await getResultById(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/summary?propertyId=&nepaliYear=&nepaliMonth=
export async function getResultSummaryController(req, res) {
  try {
    const { propertyId, nepaliYear, nepaliMonth } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
    }
    const result = await getResultSummary(
      propertyId,
      nepaliYear ? Number(nepaliYear) : null,
      nepaliMonth ? Number(nepaliMonth) : null,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/checklists/results/:id
export async function deleteResultController(req, res) {
  try {
    const result = await deleteResult(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
export async function getCalendarSummaryController(req, res) {
  try {
    const { propertyId, nepaliYear, nepaliMonth } = req.query;
    const result = await getCalendarSummary(
      propertyId,
      nepaliYear ? Number(nepaliYear) : null,
      nepaliMonth ? Number(nepaliMonth) : null,
    );
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/today?propertyId=&nepaliDate=
export async function getTodayResultsController(req, res) {
  try {
    const { propertyId, nepaliDate } = req.query;
    const result = await getTodayResults(propertyId, nepaliDate);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
export async function addSectionController(req, res) {
  try {
    const result = await addSectionToTemplate(
      req.params.id,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PATCH /api/checklists/templates/:id/sections/:sectionKey
// Body: { sectionLabel }
export async function updateSectionController(req, res) {
  try {
    const result = await updateSectionInTemplate(
      req.params.id,
      req.params.sectionKey,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/checklists/templates/:id/sections/:sectionKey
export async function removeSectionController(req, res) {
  try {
    const result = await removeSectionFromTemplate(
      req.params.id,
      req.params.sectionKey,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// POST /api/checklists/templates/:id/sections/:sectionKey/items
// Body: { label, quantity? }
export async function addItemController(req, res) {
  try {
    const result = await addItemToTemplate(
      req.params.id,
      req.params.sectionKey,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PATCH /api/checklists/templates/:id/sections/:sectionKey/items/:itemId
// Body: { label?, quantity? }
export async function updateItemController(req, res) {
  try {
    const result = await updateItemInTemplate(
      req.params.id,
      req.params.sectionKey,
      req.params.itemId,
      req.body,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/checklists/templates/:id/sections/:sectionKey/items/:itemId
export async function removeItemController(req, res) {
  try {
    const result = await removeItemFromTemplate(
      req.params.id,
      req.params.sectionKey,
      req.params.itemId,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// PATCH /api/checklists/templates/:id/sections/reorder
// Body: { orderedSectionKeys: ["KEY_A", "KEY_B", ...] }
export async function reorderSectionsController(req, res) {
  try {
    const result = await reorderSectionsInTemplate(
      req.params.id,
      req.body.orderedSectionKeys,
      req.admin.id,
    );
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
