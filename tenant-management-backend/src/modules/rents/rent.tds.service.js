/**
 * rent.tds.service.js
 *
 * Service for handling TDS document uploads and management.
 * Uploads TDS receipts to FTP server and updates rent records.
 */

import { uploadFileToFTP } from "../ftpUpload/ftpUpload.service.js";
import { Rent } from "./rent.Model.js";

/**
 * Handle TDS document upload to FTP server and update rent record.
 *
 * @param {Object} params
 * @param {Object} params.tdsDocument - Multer file object with path, originalname, etc.
 * @param {string} params.rentId - MongoDB ObjectId of the rent
 * @param {string} params.tenantId - MongoDB ObjectId of the tenant
 * @returns {Promise<{success: boolean, remotePath?: string, error?: string}>}
 */
export async function handleTdsDocumentUpload({
  tdsDocument,
  rentId,
  tenantId,
}) {
  try {
    if (!tdsDocument) {
      return {
        success: false,
        error: "No document provided",
      };
    }

    if (!rentId || !tenantId) {
      return {
        success: false,
        error: "rentId and tenantId are required",
      };
    }

    // Upload to FTP server
    const remotePath = await uploadFileToFTP(tdsDocument, tenantId);

    if (!remotePath) {
      throw new Error("FTP upload failed - no remote path returned");
    }

    // Update rent record with TDS receipt URL
    await Rent.findByIdAndUpdate(rentId, {
      $set: { tdsReceiptUrl: remotePath },
    });

    console.log(
      `[handleTdsDocumentUpload] ✅ TDS document uploaded for rent=${rentId} → ${remotePath}`,
    );

    return {
      success: true,
      remotePath,
    };
  } catch (error) {
    console.error("[handleTdsDocumentUpload]", error.message);
    return {
      success: false,
      error: error.message || "TDS document upload failed",
    };
  }
}

/**
 * Get TDS document URL for a rent record.
 *
 * @param {string} rentId - MongoDB ObjectId of the rent
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
export async function getTdsDocumentUrl(rentId) {
  try {
    const rent = await Rent.findById(rentId).select("tdsReceiptUrl");

    if (!rent) {
      return {
        success: false,
        error: "Rent not found",
      };
    }

    return {
      success: true,
      url: rent.tdsReceiptUrl,
    };
  } catch (error) {
    console.error("[getTdsDocumentUrl]", error.message);
    return {
      success: false,
      error: error.message || "Failed to get TDS document URL",
    };
  }
}
