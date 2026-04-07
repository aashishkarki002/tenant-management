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
  uploadItemImage,
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
export async function rebuildTemplateController(req, res) {
  try {
    const result = await rebuildTemplate(req.params.id, req.admin.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/templates
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
export async function submitResultController(req, res) {
  try {
    const result = await submitResult(req.params.id, req.body, req.admin.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/results
export async function getResultsController(req, res) {
  try {
    const result = await getResults(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/results/:id
export async function getResultByIdController(req, res) {
  try {
    const result = await getResultById(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/summary
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

// GET /api/checklists/calendar
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

// GET /api/checklists/today
export async function getTodayResultsController(req, res) {
  try {
    const { propertyId, nepaliDate } = req.query;
    const result = await getTodayResults(propertyId, nepaliDate);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  TEMPLATE section / item management controllers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  IMAGE UPLOAD controller
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/checklists/results/:id/items/:itemId/images
 *
 * Uploads an evidence photo for a specific failed item via FTP and appends
 * the remote path to that item's issueImages array.
 *
 * Expects multipart/form-data with a single file field named "file".
 * The tenantId is derived from the result's property._id so the caller
 * does not need to send it explicitly — mirrors ftpUpload behaviour.
 */
export async function uploadItemImageController(req, res) {
  try {
    const { id: resultId, itemId } = req.params;
    const file = req.file;

    console.log(
      "[uploadItemImage] controller hit — resultId:",
      resultId,
      "itemId:",
      itemId,
    );

    if (!file) {
      console.warn(
        "[uploadItemImage] no file in request (multer did not attach req.file)",
      );
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    console.log("[uploadItemImage] file received:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    });

    const result = await uploadItemImage(resultId, itemId, file);
    console.log("[uploadItemImage] service result:", result);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    console.error("[uploadItemImage] controller error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
}
