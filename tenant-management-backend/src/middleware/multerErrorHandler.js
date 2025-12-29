import multer from "multer";

export const multerErrorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size is 10MB.",
      });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE" || err.message.includes("Unexpected field")) {
      return res.status(400).json({
        success: false,
        message: "Invalid field name. Expected fields: 'image' and 'pdfAgreement'.",
        error: err.message,
      });
    }
    return res.status(400).json({
      success: false,
      message: "File upload error",
      error: err.message,
    });
  }
  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error",
      error: err.message,
    });
  }
  next();
};

