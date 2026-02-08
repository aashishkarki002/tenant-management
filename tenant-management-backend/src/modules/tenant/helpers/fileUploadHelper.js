// helpers/fileUploadHelper.js
import { uploadFiles, uploadSingleFile } from "../uploads/upload.service.js";

/**
 * Process document uploads from multipart form
 * ✅ Now includes 'type' field required by Mongoose schema
 */
export default async function buildDocumentsFromFiles(files) {
  if (!files) return [];

  const documents = [];

  const fieldMap = {
    image: { folder: "tenants/images", label: "Profile Image" },
    pdfAgreement: { folder: "tenants/agreements", label: "Agreement" },
    citizenShip: { folder: "tenants/citizenship", label: "Citizenship" },
    bank_guarantee: {
      folder: "tenants/bank-guarantees",
      label: "Bank Guarantee",
    },
    cheque: { folder: "tenants/cheques", label: "Cheque" },
    company_docs: {
      folder: "tenants/company-docs",
      label: "Company Documents",
    },
    tax_certificate: {
      folder: "tenants/tax-certificates",
      label: "Tax Certificate",
    },
    other: { folder: "tenants/other", label: "Other Documents" },
  };

  const uploadOptions = {
    imageTransform: [{ width: 1500, height: 1500, crop: "limit" }],
  };

  for (const [fieldName, config] of Object.entries(fieldMap)) {
    if (files[fieldName]) {
      try {
        const fileArray = Array.isArray(files[fieldName])
          ? files[fieldName]
          : [files[fieldName]];

        const uploaded = await uploadFiles(fileArray, {
          ...uploadOptions,
          folder: config.folder,
        });

        // ✅ Add each uploaded file as a separate document with 'type'
        uploaded.forEach((file) => {
          documents.push({
            type: fieldName, // ✅ REQUIRED by Mongoose schema
            url: file.url,
            uploadedAt: file.uploadedAt,
            name: config.label, // Optional: human-readable name
            format: file.format,
            resourceType: file.resourceType,
          });
        });
      } catch (error) {
        console.error(`[${fieldName}] Upload failed:`, error.message);
        throw new Error(`Failed to upload ${fieldName}: ${error.message}`);
      }
    }
  }

  return documents;
}

export { uploadSingleFile };
