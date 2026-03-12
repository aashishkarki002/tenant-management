import * as ownershipService from "./ownership.service.js";

// GET /api/ownership
export const getAllEntities = async (req, res) => {
  try {
    const entities = await ownershipService.getAllEntities();
    return res.status(200).json({ success: true, data: entities });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/ownership
export const createEntity = async (req, res) => {
  try {
    const entity = await ownershipService.createEntity(
      req.body,
      req.admin?.id,
    );
    return res.status(201).json({ success: true, data: entity });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/ownership/:id
export const getEntityById = async (req, res) => {
  try {
    const entity = await ownershipService.getEntityById(req.params.id);
    if (!entity) {
      return res
        .status(404)
        .json({ success: false, message: "Entity not found" });
    }
    return res.status(200).json({ success: true, data: entity });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/ownership/:id
export const updateEntity = async (req, res) => {
  try {
    const entity = await ownershipService.updateEntity(
      req.params.id,
      req.body,
    );
    if (!entity) {
      return res
        .status(404)
        .json({ success: false, message: "Entity not found" });
    }
    return res.status(200).json({ success: true, data: entity });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
