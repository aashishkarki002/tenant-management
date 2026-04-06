// services/uploadService.js
import fs from "fs";
import ftpClient from "../../config/ftpClient.js";

export const uploadFileToFTP = async (file, tenantId) => {
  if (!file || !tenantId) throw new Error("File and tenantId are required");

  const localPath = file.path;
  const remotePath = `/bills/${tenantId}/${file.originalname}`;

  const success = await ftpClient.upload(localPath, remotePath);

  // Remove temp file
  fs.unlinkSync(localPath);

  if (!success) throw new Error("FTP upload failed");

  return remotePath; // return remote path for reference
};
export const listFilesOnFTP = async (tenantId) => {
  if (!tenantId) throw new Error("tenantId is required");

  try {
    const directory = `/bills/${tenantId}`;
    const files = await ftpClient.list(directory);
    return files; // array of file info
  } catch (err) {
    console.error("FTP list error:", err);
    throw new Error("Failed to list files");
  }
};

export const deleteFileOnFTP = async (tenantId, filename) => {
  if (!tenantId || !filename)
    throw new Error("tenantId and filename are required");

  try {
    const remotePath = `/bills/${tenantId}/${filename}`;
    const success = await ftpClient.delete(remotePath);
    if (!success) throw new Error("Delete failed");
    return true;
  } catch (err) {
    console.error("FTP delete error:", err);
    throw new Error("Failed to delete file");
  }
};
