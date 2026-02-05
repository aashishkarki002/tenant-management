import fs from "fs";
import path from "path";
import cloudinary from "../../../config/cloudinary.js";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR);

export function saveTempFile(file) {
  const tempPath = path.join(TEMP_UPLOAD_DIR, file.originalname);
  fs.writeFileSync(tempPath, file.buffer);
  return tempPath;
}

export async function buildDocumentsFromFiles(files) {
  const documents = [];
  for (const field in files) {
    const uploadedFiles = Array.isArray(files[field])
      ? files[field]
      : [files[field]];
    const filesArr = [];
    for (const file of uploadedFiles) {
      const tempPath = saveTempFile(file);
      const isPdf = file.mimetype.includes("pdf");
      const result = await cloudinary.uploader.upload(tempPath, {
        folder: isPdf ? "tenants/pdfs" : "tenants/images",
        resource_type: isPdf ? "raw" : "image",
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      });
      fs.unlinkSync(tempPath);
      filesArr.push({ url: result.secure_url });
    }
    documents.push({ type: field, files: filesArr });
  }
  return documents;
}

export async function uploadFileArray(files, folder) {
  if (!files || files.length === 0) return [];
  const uploaded = [];

  for (const file of files) {
    const tempPath = saveTempFile(file);
    const isPdf = file.mimetype.includes("pdf");
    const result = await cloudinary.uploader.upload(tempPath, {
      folder,
      resource_type: isPdf ? "raw" : "image",
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });
    fs.unlinkSync(tempPath);
    uploaded.push({ url: result.secure_url });
  }

  return uploaded;
}
