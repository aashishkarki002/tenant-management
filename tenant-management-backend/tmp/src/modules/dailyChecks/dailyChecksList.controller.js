import {
  createChecklist,
  submitChecklist,
  getChecklists,
  getChecklistById,
  getChecklistSummary,
  deleteChecklist,
} from "./dailyChecksList.service.js";

// POST /api/checklists/create
export async function createChecklistController(req, res) {
  try {
    const adminId = req.admin.id;
    const result = await createChecklist(req.body, adminId);
    return res.status(201).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
}

// PATCH /api/checklists/:id/submit
// Body: { sections: [...], overallNotes, status, nepaliDate, nepaliMonth, nepaliYear }
export async function submitChecklistController(req, res) {
  try {
    const adminId = req.admin.id;
    const { id } = req.params;
    const result = await submitChecklist(id, req.body, adminId);
    const statusCode = result.success ? 200 : 404;
    return res.status(statusCode).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists
// Query: propertyId, blockId, category, checklistType, hasIssues, status,
//        nepaliYear, nepaliMonth, startDate, endDate, page, limit
export async function getChecklistsController(req, res) {
  try {
    const result = await getChecklists(req.query);
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/:id
export async function getChecklistByIdController(req, res) {
  try {
    const result = await getChecklistById(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// GET /api/checklists/summary?propertyId=&nepaliYear=&nepaliMonth=
export async function getChecklistSummaryController(req, res) {
  try {
    const { propertyId, nepaliYear, nepaliMonth } = req.query;
    if (!propertyId) {
      return res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
    }
    const result = await getChecklistSummary(
      propertyId,
      nepaliYear ? Number(nepaliYear) : null,
      nepaliMonth ? Number(nepaliMonth) : null,
    );
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

// DELETE /api/checklists/:id  (admin only)
export async function deleteChecklistController(req, res) {
  try {
    const result = await deleteChecklist(req.params.id);
    return res.status(result.success ? 200 : 404).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
