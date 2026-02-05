import fs from "fs";
import path from "path";
import cloudinary from "../../config/cloudinary.js";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR);

function saveTempFile(file) {
  const tempPath = path.join(TEMP_UPLOAD_DIR, file.originalname);
  fs.writeFileSync(tempPath, file.buffer);
  return tempPath;
}

function isPdfFile(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  return (
    ext === ".pdf" ||
    file.mimetype === "application/pdf" ||
    file.mimetype === "application/x-pdf"
  );
}

/**
 * Upload multiple files
 */
export async function uploadFiles(files, options = {}) {
  if (!files || files.length === 0) return [];

  const {
    folder = "uploads",
    imageTransform = [{ width: 1000, height: 1000, crop: "limit" }],
  } = options;

  const uploadedFiles = [];

  for (const file of files) {
    const tempPath = saveTempFile(file);
    const isPdf = isPdfFile(file);

    const result = await cloudinary.uploader.upload(tempPath, {
      folder,
      resource_type: isPdf ? "raw" : "image",
      transformation: isPdf ? undefined : imageTransform,
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    fs.unlinkSync(tempPath);

    uploadedFiles.push({
      url: result.secure_url,
      uploadedAt: new Date(),
    });
  }

  return uploadedFiles;
}
