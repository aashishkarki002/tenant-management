import PDFDocument from "pdfkit";
import cloudinary from "../config/cloudinary.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
