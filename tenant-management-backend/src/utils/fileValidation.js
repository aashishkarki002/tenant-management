/**
 * fileValidation.js
 *
 * Validation utilities for file uploads.
 */

const ALLOWED_FILE_TYPES = {
  tdsDocument: {
    mimeTypes: [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ],
    extensions: [".pdf", ".jpg", ".jpeg", ".png"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
};

/**
 * Validate file type and size for TDS documents.
 *
 * @param {Object} file - Multer file object
 * @returns {{valid: boolean, error?: string}}
 */
export function validateTdsDocument(file) {
  if (!file) {
    return { valid: true }; // Optional file
  }

  const { mimeTypes, maxSizeBytes } = ALLOWED_FILE_TYPES.tdsDocument;

  // Check MIME type
  if (!mimeTypes.includes(file.mimetype)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${mimeTypes.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > maxSizeBytes) {
    const maxSizeMB = maxSizeBytes / (1024 * 1024);
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  return { valid: true };
}

/**
 * Express middleware for validating TDS document uploads.
 */
export function validateTdsDocumentMiddleware(req, res, next) {
  if (!req.file) {
    // File is optional, continue
    return next();
  }

  const validation = validateTdsDocument(req.file);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      message: validation.error,
    });
  }

  next();
}
