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
        },
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
          { align: "center" },
        );
      doc.text("Contact us: info@sallyanhouse.com | +977-9812345678", {
        align: "center",
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate branded PDF receipt to a buffer (for email attachments).
 */
export async function generatePDFToBuffer(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0, size: "A4" });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const PW = 595.28; // A4 width pt
      const MARGIN = 48;
      const COL_RIGHT = PW - MARGIN;
      const BRAND = "#1A5276";
      const BRAND_LIGHT = "#2e86c1";
      const TEXT_DARK = "#0d2137";
      const TEXT_MID = "#3d5166";
      const TEXT_MUTED = "#8fa3b1";
      const RULE = "#e8eef3";

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.rect(0, 0, PW, 88).fill(BRAND);

      // Accent gradient strip (simulated with two rects)
      doc.rect(0, 88, PW * 0.5, 3).fill(BRAND);
      doc.rect(PW * 0.5, 88, PW * 0.35, 3).fill(BRAND_LIGHT);
      doc.rect(PW * 0.85, 88, PW * 0.15, 3).fill("#aed6f1");

      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("Sallyan House", MARGIN, 24);
      doc
        .fillColor("rgba(255,255,255,0.55)")
        .font("Helvetica")
        .fontSize(8)
        .text("PROPERTY MANAGEMENT", MARGIN, 46, { characterSpacing: 2.5 });
      doc
        .fillColor("rgba(255,255,255,0.9)")
        .font("Helvetica")
        .fontSize(10)
        .text("Official Payment Receipt", COL_RIGHT - 120, 38, { width: 120, align: "right" });

      // ── RECEIPT META (two-column) ────────────────────────────────────────────
      const metaY = 110;
      const col2X = PW / 2 + 16;

      const metaLabel = (label, value, x, y) => {
        doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(8)
          .text(label.toUpperCase(), x, y, { characterSpacing: 1 });
        doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(10)
          .text(value || "—", x, y + 12);
      };

      metaLabel("Receipt No", data.receiptNo, MARGIN, metaY);
      metaLabel("Payment Date", data.paymentDate, MARGIN, metaY + 36);
      metaLabel("Nepali Date", data.nepaliDate || "—", MARGIN, metaY + 72);

      metaLabel("Tenant", data.tenantName, col2X, metaY);
      metaLabel("Property", data.property, col2X, metaY + 36);
      metaLabel("Period", data.paidFor, col2X, metaY + 72);

      // Divider
      const divY = metaY + 108;
      doc.moveTo(MARGIN, divY).lineTo(COL_RIGHT, divY).strokeColor(RULE).lineWidth(1).stroke();

      // ── PAYMENT BREAKDOWN TABLE ──────────────────────────────────────────────
      const tblY = divY + 14;
      const COL_DESC = MARGIN;
      const COL_AMT = COL_RIGHT - 90;
      const ROW_H = 22;

      // Table header
      doc.rect(MARGIN, tblY, COL_RIGHT - MARGIN, 20).fill("#f6f9fc");
      doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(8)
        .text("DESCRIPTION", COL_DESC + 8, tblY + 6, { characterSpacing: 1 });
      doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(8)
        .text("AMOUNT (Rs.)", COL_AMT, tblY + 6, { width: 90, align: "right", characterSpacing: 1 });

      let rowY = tblY + 20;
      let totalAmount = 0;

      const tableRow = (label, amount) => {
        if (!amount || amount <= 0) return;
        doc.moveTo(MARGIN, rowY).lineTo(COL_RIGHT, rowY).strokeColor(RULE).lineWidth(0.5).stroke();
        doc.fillColor(TEXT_MID).font("Helvetica").fontSize(10)
          .text(label, COL_DESC + 8, rowY + 6);
        doc.fillColor(TEXT_DARK).font("Helvetica").fontSize(10)
          .text(`Rs. ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            COL_AMT, rowY + 6, { width: 90, align: "right" });
        totalAmount += amount;
        rowY += ROW_H;
      };

      tableRow(`Rent — ${data.paidFor}`, data.rentAmount);
      tableRow(`CAM Charges — ${data.paidFor}`, data.camAmount);
      tableRow("Electricity", data.electricityAmount);
      tableRow("Late Fee", data.lateFeeAmount);

      // If no breakdown, show total directly
      if (totalAmount === 0) {
        tableRow(data.paidFor, data.amount ?? 0);
      }

      // Unit breakdown sub-rows
      if (data.unitBreakdown?.length > 0) {
        data.unitBreakdown.forEach((ub) => {
          doc.moveTo(MARGIN, rowY).lineTo(COL_RIGHT, rowY).strokeColor(RULE).lineWidth(0.5).stroke();
          doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(9)
            .text(`  └ ${ub.unitName}`, COL_DESC + 8, rowY + 5);
          doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(9)
            .text(`Rs. ${ub.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              COL_AMT, rowY + 5, { width: 90, align: "right" });
          rowY += 18;
        });
      }

      // Total row
      doc.rect(MARGIN, rowY, COL_RIGHT - MARGIN, 26).fill("#f6f9fc");
      doc.moveTo(MARGIN, rowY).lineTo(COL_RIGHT, rowY).strokeColor(BRAND).lineWidth(1.5).stroke();
      doc.fillColor(TEXT_DARK).font("Helvetica-Bold").fontSize(11)
        .text("TOTAL PAID", COL_DESC + 8, rowY + 7, { characterSpacing: 0.5 });
      doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(11)
        .text(`Rs. ${(totalAmount || data.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          COL_AMT, rowY + 7, { width: 90, align: "right" });
      rowY += 26;

      // ── PAYMENT INFO ─────────────────────────────────────────────────────────
      const infoY = rowY + 20;
      doc.moveTo(MARGIN, infoY - 6).lineTo(COL_RIGHT, infoY - 6).strokeColor(RULE).lineWidth(0.5).stroke();

      const infoItem = (label, value, x, y) => {
        if (!value) return;
        doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(8)
          .text(label.toUpperCase(), x, y, { characterSpacing: 1 });
        doc.fillColor(TEXT_MID).font("Helvetica").fontSize(10)
          .text(value, x, y + 12);
      };

      infoItem("Payment Method", data.paymentMethod, MARGIN, infoY);
      if (data.transactionRef) infoItem("Transaction Ref", data.transactionRef, col2X, infoY);
      if (data.receivedBy) infoItem("Received By", data.receivedBy, data.transactionRef ? MARGIN : col2X, infoY + 36);

      // ── FOOTER ───────────────────────────────────────────────────────────────
      const footerY = 780;
      doc.moveTo(MARGIN, footerY).lineTo(COL_RIGHT, footerY).strokeColor(RULE).lineWidth(0.5).stroke();
      doc.fillColor(TEXT_MUTED).font("Helvetica-Oblique").fontSize(9)
        .text("This is an official receipt. Please retain for your records.", MARGIN, footerY + 8, { align: "center", width: COL_RIGHT - MARGIN });
      doc.fillColor(TEXT_MUTED).font("Helvetica").fontSize(9)
        .text("info@sallyanhouse.com  ·  +977-9812345678  ·  app.sallyanhouse.com", MARGIN, footerY + 22, { align: "center", width: COL_RIGHT - MARGIN });

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

    // Write buffer to temporary file
    fs.writeFileSync(tempFilePath, pdfBuffer);

    // Upload the file to Cloudinary
    const uploadOptions = {
      folder: "rents/pdfs",
      resource_type: "raw",
      public_id: `receipt-${receiptNo}`,
    };

    const result = await cloudinary.uploader.upload(
      tempFilePath,
      uploadOptions,
    );

    if (!result || !result.secure_url) {
      console.error(
        "❌ [uploadPDFBufferToCloudinary] Invalid result from Cloudinary:",
        {
          receiptNo,
          result: result,
          resultType: typeof result,
        },
      );
      throw new Error("Cloudinary upload returned invalid result");
    }

    const uploadResult = {
      fileName: `receipt-${receiptNo}.pdf`,
      url: result.secure_url,
      cloudinaryId: result.public_id,
    };

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
      } catch (unlinkError) {
        console.error(
          "⚠️ [uploadPDFBufferToCloudinary] Failed to delete temp file:",
          {
            receiptNo,
            tempFilePath,
            error: unlinkError.message,
          },
        );
      }
    }
  }
}
