import PDFDocument from "pdfkit";
import cloudinary from "../config/cloudinary.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { Readable, PassThrough } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Temp directory for file uploads
const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
  fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
}

export async function generateAndUploadRentPDF(rent) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: "rents/pdfs", resource_type: "raw" },
        (error, result) => {
          if (error) return reject(error);
          resolve({
            fileName: `receipt-${rent.receiptNo}.pdf`,
            url: result.secure_url,
            cloudinaryId: result.public_id,
          });
          console.log("Uploaded PDF path:", result.secure_url);
        }
      );

      doc.on("error", reject);
      uploadStream.on("error", reject);
      doc.pipe(uploadStream);

      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Sallyan House ", 50, 50, { align: "left" });
      doc
        .fontSize(14)
        .font("Helvetica")
        .text("Official Payment Receipt", { align: "right" });
      doc.moveDown(2);

      // ---------- LINE ----------
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(1);

      // ---------- RECEIPT INFO ----------
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Receipt Info", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Receipt No: ${rent.receiptNo}`);
      doc.text(`Date: ${rent.paymentDate}`);
      doc.moveDown(1);

      // ---------- TENANT & PROPERTY INFO ----------
      doc
        .font("Helvetica-Bold")
        .text("Tenant & Property Info", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Tenant: ${rent.tenantName}`);
      doc.text(`Property: ${rent.property}`);
      doc.text(`Paid For: ${rent.paidFor}`);
      doc.moveDown(1);

      // ---------- PAYMENT DETAILS TABLE ----------
      doc.font("Helvetica-Bold").text("Payment Details", { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableLeft = 50;
      const tableRight = 545;
      const rowHeight = 20;

      // Draw table headers
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Description", tableLeft + 5, tableTop)
        .text("Amount (Rs.)", tableRight - 100, tableTop, {
          width: 90,
          align: "right",
        });

      // Horizontal line below header
      doc
        .moveTo(tableLeft, tableTop + 18)
        .lineTo(tableRight, tableTop + 18)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      // Payment row
      const rowY = tableTop + rowHeight;
      doc
        .font("Helvetica")
        .text(rent.paidFor, tableLeft + 5, rowY)
        .text(rent.amount, tableRight - 100, rowY, {
          width: 90,
          align: "right",
        });

      // Horizontal line below row
      doc
        .moveTo(tableLeft, rowY + rowHeight - 5)
        .lineTo(tableRight, rowY + rowHeight - 5)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      doc.moveDown(3);

      // ---------- RECEIVED BY ----------
      doc.font("Helvetica").text(`Received By: ${rent.receivedBy}`);
      doc.moveDown(2);

      // ---------- FOOTER ----------
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text(
          "This is an official receipt for your payment. Please keep it for your records.",
          { align: "center" }
        );
      doc.text("Contact us: info@cup-o-joy.com | +977-9812345678", {
        align: "center",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate PDF receipt to a buffer (for email attachments)
 * This is faster and more reliable than streaming to Cloudinary
 */
export async function generatePDFToBuffer(rent) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on("error", reject);

      // Same PDF content as generateAndUploadRentPDF
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("Sallyan House ", 50, 50, { align: "left" });
      doc
        .fontSize(14)
        .font("Helvetica")
        .text("Official Payment Receipt", { align: "right" });
      doc.moveDown(2);

      // ---------- LINE ----------
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(1);

      // ---------- RECEIPT INFO ----------
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Receipt Info", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Receipt No: ${rent.receiptNo}`);
      doc.text(`Date: ${rent.paymentDate}`);
      doc.moveDown(1);

      // ---------- TENANT & PROPERTY INFO ----------
      doc
        .font("Helvetica-Bold")
        .text("Tenant & Property Info", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Tenant: ${rent.tenantName}`);
      doc.text(`Property: ${rent.property}`);
      doc.text(`Paid For: ${rent.paidFor}`);
      doc.moveDown(1);

      // ---------- PAYMENT DETAILS TABLE ----------
      doc.font("Helvetica-Bold").text("Payment Details", { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const tableLeft = 50;
      const tableRight = 545;
      const rowHeight = 20;

      // Draw table headers
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Description", tableLeft + 5, tableTop)
        .text("Amount (Rs.)", tableRight - 100, tableTop, {
          width: 90,
          align: "right",
        });

      // Horizontal line below header
      doc
        .moveTo(tableLeft, tableTop + 18)
        .lineTo(tableRight, tableTop + 18)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      // Payment row
      const rowY = tableTop + rowHeight;
      doc
        .font("Helvetica")
        .text(rent.paidFor, tableLeft + 5, rowY)
        .text(rent.amount, tableRight - 100, rowY, {
          width: 90,
          align: "right",
        });

      // Horizontal line below row
      doc
        .moveTo(tableLeft, rowY + rowHeight - 5)
        .lineTo(tableRight, rowY + rowHeight - 5)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      doc.moveDown(3);

      // ---------- RECEIVED BY ----------
      doc.font("Helvetica").text(`Received By: ${rent.receivedBy}`);
      doc.moveDown(2);

      // ---------- FOOTER ----------
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(0.5);

      doc
        .fontSize(10)
        .font("Helvetica-Oblique")
        .text(
          "This is an official receipt for your payment. Please keep it for your records.",
          { align: "center" }
        );
      doc.text("Contact us: info@cup-o-joy.com | +977-9812345678", {
        align: "center",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Upload an existing PDF buffer to Cloudinary
 * This avoids regenerating the PDF when we already have a buffer
 * Uses upload_stream with a readable stream from the buffer for reliable upload
 * @param {Buffer} pdfBuffer - The PDF buffer to upload
 * @param {string} receiptNo - Receipt number for file naming
 * @returns {Promise<Object>} Object with fileName, url, and cloudinaryId
 */
export async function uploadPDFBufferToCloudinary(pdfBuffer, receiptNo) {
  // Validate buffer
  if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
    const error = new Error("Invalid PDF buffer provided");
    console.error("❌ [uploadPDFBufferToCloudinary] Validation failed:", {
      receiptNo,
      error: error.message,
    });
    throw error;
  }

  if (pdfBuffer.length === 0) {
    const error = new Error("PDF buffer is empty");
    console.error("❌ [uploadPDFBufferToCloudinary] Validation failed:", {
      receiptNo,
      error: error.message,
    });
    throw error;
  }

  let tempFilePath = null;

  try {
    // Create a temporary file path
    const fileName = `receipt-${receiptNo}-${Date.now()}.pdf`;
    tempFilePath = path.join(TEMP_UPLOAD_DIR, fileName);

    console.log(
      "💾 [uploadPDFBufferToCloudinary] Writing buffer to temp file:",
      {
        receiptNo,
        tempFilePath,
        bufferSize: pdfBuffer.length,
      }
    );

    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, pdfBuffer);

    console.log("✅ [uploadPDFBufferToCloudinary] Temp file created:", {
      receiptNo,
      tempFilePath,
      fileSize: fs.statSync(tempFilePath).size,
    });

    // Upload the file to Cloudinary
    const uploadOptions = {
      folder: "rents/pdfs",
      resource_type: "raw",
      public_id: `receipt-${receiptNo}`,
    };

    console.log("☁️ [uploadPDFBufferToCloudinary] Uploading to Cloudinary:", {
      receiptNo,
      options: uploadOptions,
    });

    const result = await cloudinary.uploader.upload(
      tempFilePath,
      uploadOptions
    );

    console.log(
      "📥 [uploadPDFBufferToCloudinary] Cloudinary response received:",
      {
        receiptNo,
        hasResult: !!result,
        hasSecureUrl: !!result?.secure_url,
        hasPublicId: !!result?.public_id,
        resultKeys: result ? Object.keys(result) : [],
      }
    );

    if (!result || !result.secure_url) {
      console.error(
        "❌ [uploadPDFBufferToCloudinary] Invalid result from Cloudinary:",
        {
          receiptNo,
          result: result,
          resultType: typeof result,
        }
      );
      throw new Error("Cloudinary upload returned invalid result");
    }

    const uploadResult = {
      fileName: `receipt-${receiptNo}.pdf`,
      url: result.secure_url,
      cloudinaryId: result.public_id,
    };

    console.log("✅ [uploadPDFBufferToCloudinary] Upload successful:", {
      receiptNo,
      fileName: uploadResult.fileName,
      url: uploadResult.url,
      cloudinaryId: uploadResult.cloudinaryId,
      resultSize: result.bytes,
      format: result.format,
    });

    return uploadResult;
  } catch (error) {
    console.error("❌ [uploadPDFBufferToCloudinary] Upload failed:", {
      receiptNo,
      error: error.message,
      errorCode: error.http_code,
      errorName: error.name,
      stack: error.stack,
    });
    throw error;
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log("🗑️ [uploadPDFBufferToCloudinary] Temp file deleted:", {
          receiptNo,
          tempFilePath,
        });
      } catch (unlinkError) {
        console.error(
          "⚠️ [uploadPDFBufferToCloudinary] Failed to delete temp file:",
          {
            receiptNo,
            tempFilePath,
            error: unlinkError.message,
          }
        );
      }
    }
  }
}
