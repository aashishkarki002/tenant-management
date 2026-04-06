// controllers/uploadController.js
import {
  uploadFileToFTP,
  listFilesOnFTP,
  deleteFileOnFTP,
} from "./ftpUpload.service.js";

export const ftpUploadController = async (req, res) => {
  try {
    const { tenantId } = req.body;
    const file = req.file;

    const remotePath = await uploadFileToFTP(file, tenantId);

    return res.json({
      message: "File uploaded successfully",
      remotePath,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};
export const listFilesController = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const files = await listFilesOnFTP(tenantId);
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteFileController = async (req, res) => {
  try {
    const { tenantId, filename } = req.body;
    await deleteFileOnFTP(tenantId, filename);
    res.json({ message: "File deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
