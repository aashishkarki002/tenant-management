import cloudinary from "../../../config/cloudinary.js";
import { uploadFiles, uploadSingleFile } from "../uploads/upload.service.js";

const fieldMap = {
  image: {
    folder: "tenants/images",
    label: "Profile Image",
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  },
  pdfAgreement: {
    folder: "tenants/agreements",
    label: "Agreement",
    allowedMimes: ["application/pdf"],
  },
  citizenShip: {
    folder: "tenants/citizenship",
    label: "Citizenship",
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  bank_guarantee: {
    folder: "tenants/bank-guarantees",
    label: "Bank Guarantee",
    allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
  },
  cheque: {
    folder: "tenants/cheques",
    label: "Cheque",
    allowedMimes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  },
  company_docs: {
    folder: "tenants/company-docs",
    label: "Company Documents",
    allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
  },
  tax_certificate: {
    folder: "tenants/tax-certificates",
    label: "Tax Certificate",
    allowedMimes: ["application/pdf", "image/jpeg", "image/png"],
  },
  other: {
    folder: "tenants/other",
    label: "Other Documents",
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
  sd_others: {
    folder: "tenants/sd-others",
    label: "Security Deposit (Open Cheque)",
    allowedMimes: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
};

const uploadOptions = {
  imageTransform: [{ width: 1500, height: 1500, crop: "limit" }],
};

/**
 * Delete previously uploaded Cloudinary assets when a DB transaction fails.
 * Fire-and-forget safe — logs but does not rethrow.
 *
 * @param {Array} documents - result of buildDocumentsFromFiles
 */
export async function rollbackUploads(documents) {
  const publicIds = documents
    .flatMap((doc) => doc.files.map((f) => f.publicId))
    .filter(Boolean);

  if (publicIds.length === 0) return;

  try {
    await cloudinary.api.delete_resources(publicIds);
    console.log(`[Cloudinary] Rolled back ${publicIds.length} upload(s)`);
  } catch (err) {
    console.error("[Cloudinary] Rollback failed:", err.message);
  }
}

/**
 * Validate and upload all document files in parallel.
 * Returns documents array ready for Tenant.create().
 *
 * @param {Object} files - multer files object (req.files)
 * @returns {Promise<Array>}
 */
export default async function buildDocumentsFromFiles(files) {
  if (!files) return [];

  const entries = Object.entries(fieldMap).filter(([fieldName]) => {
    const f = files[fieldName];
    return f && (Array.isArray(f) ? f.length > 0 : true);
  });

  if (entries.length === 0) return [];

  const results = await Promise.all(
    entries.map(async ([fieldName, config]) => {
      const fileArray = Array.isArray(files[fieldName])
        ? files[fieldName]
        : [files[fieldName]];

      const invalid = fileArray.filter(
        (f) => !config.allowedMimes.includes(f.mimetype),
      );
      if (invalid.length > 0) {
        throw new Error(
          `Invalid file type for "${fieldName}": ${invalid.map((f) => f.mimetype).join(", ")}. ` +
            `Allowed: ${config.allowedMimes.join(", ")}`,
        );
      }

      const uploaded = await uploadFiles(fileArray, {
        ...uploadOptions,
        folder: config.folder,
      });

      return {
        type: fieldName,
        files: uploaded.map((file) => ({
          url: file.url,
          publicId: file.publicId,
          uploadedAt: file.uploadedAt,
        })),
      };
    }),
  );

  return results;
}

export { uploadSingleFile };
