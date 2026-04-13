/**
 * electricityBillGenerator.js
 *
 * Generates a tenant-facing electricity bill PDF and uploads it to FTP.
 *
 * FTP path: /bills/{tenantId}/electricity-{nepaliYear}-{nepaliMonth}.pdf
 *
 * Usage:
 *   const { ftpPath, generatedAt } = await generateAndUploadElectricityBill(reading);
 */

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ftpClient from "../config/ftpClient.js";
import { paisaToRupees } from "./moneyUtil.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─── PDF content builder ───────────────────────────────────────────────────────

/**
 * Generate electricity bill PDF to an in-memory Buffer.
 * @param {Object} reading  - Populated Electricity document (virtuals included)
 * @returns {Promise<Buffer>}
 */
export async function generateElectricityBillPDF(reading) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const tenantName  = reading.tenant?.name  ?? "—";
      const unitName    = reading.unit?.name ?? reading.unit?.unitName ?? "—";
      const blockName   = reading.unit?.block?.name ?? "";
      const propertyName = reading.property?.name ?? "Property";
      const nepaliDate  = reading.nepaliDate ?? `${reading.nepaliMonth}/${reading.nepaliYear}`;
      const billingPeriod = `Month ${reading.nepaliMonth} / ${reading.nepaliYear} BS`;
      const consumption = Number(reading.consumption ?? 0).toFixed(1);
      const rate        = paisaToRupees(reading.ratePerUnitPaisa ?? 0);
      const totalAmount = paisaToRupees(reading.totalAmountPaisa ?? 0);
      const paidAmount  = paisaToRupees(reading.paidAmountPaisa ?? 0);
      const remaining   = Math.max(0, totalAmount - paidAmount);

      const fmtRs = (n) =>
        `Rs ${Number(n).toLocaleString("en-NP", { maximumFractionDigits: 2 })}`;

      // ── Header ────────────────────────────────────────────────────────────────
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(propertyName, 50, 50, { align: "left" });
      doc
        .fontSize(13)
        .font("Helvetica")
        .text("Electricity Bill", { align: "right" });
      doc.moveDown(1.5);

      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(1);

      // ── Tenant & Unit Info ────────────────────────────────────────────────────
      doc.fontSize(12).font("Helvetica-Bold").text("Tenant & Property", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Tenant:         ${tenantName}`);
      doc.text(`Unit:           ${unitName}${blockName ? ` — ${blockName}` : ""}`);
      doc.text(`Billing Period: ${billingPeriod}`);
      doc.text(`Reading Date:   ${nepaliDate}`);
      doc.moveDown(1);

      // ── Meter Readings ────────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").text("Meter Readings", { underline: true });
      doc.moveDown(0.3);

      const tableTop  = doc.y;
      const col1 = 50, col2 = 200, col3 = 320, col4 = 430;

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Description",        col1, tableTop)
        .text("Previous (kWh)",     col2, tableTop)
        .text("Current (kWh)",      col3, tableTop)
        .text("Consumption (kWh)",  col4, tableTop);

      doc
        .moveTo(50, tableTop + 16)
        .lineTo(545, tableTop + 16)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      const row1 = tableTop + 22;
      doc
        .font("Helvetica")
        .text("Electricity",                           col1, row1)
        .text(String(reading.previousReading ?? 0),    col2, row1)
        .text(String(reading.currentReading ?? 0),     col3, row1)
        .text(consumption,                             col4, row1);

      doc
        .moveTo(50, row1 + 18)
        .lineTo(545, row1 + 18)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      doc.moveDown(2.5);

      // ── Charges ───────────────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").text("Charges", { underline: true });
      doc.moveDown(0.3);

      const chargeTop = doc.y;
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .text("Description",   col1, chargeTop)
        .text("Rate",          col2, chargeTop)
        .text("Units",         col3, chargeTop)
        .text("Amount",        col4, chargeTop);

      doc
        .moveTo(50, chargeTop + 16)
        .lineTo(545, chargeTop + 16)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      const chargeRow = chargeTop + 22;
      doc
        .font("Helvetica")
        .text("Electricity charge",   col1, chargeRow)
        .text(`Rs ${rate}/kWh`,       col2, chargeRow)
        .text(consumption,            col3, chargeRow)
        .text(fmtRs(totalAmount),     col4, chargeRow);

      doc
        .moveTo(50, chargeRow + 18)
        .lineTo(545, chargeRow + 18)
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .stroke();

      // Total row
      const totalRow = chargeRow + 26;
      doc
        .font("Helvetica-Bold")
        .text("Total",              col1, totalRow)
        .text("",                   col2, totalRow)
        .text("",                   col3, totalRow)
        .text(fmtRs(totalAmount),   col4, totalRow);

      doc.moveDown(3);

      // ── Payment Summary ────────────────────────────────────────────────────────
      doc.font("Helvetica-Bold").text("Payment Summary", { underline: true });
      doc.moveDown(0.3);
      doc.font("Helvetica");
      doc.text(`Total Billed:   ${fmtRs(totalAmount)}`);
      doc.text(`Paid:           ${fmtRs(paidAmount)}`);
      doc
        .font("Helvetica-Bold")
        .text(`Amount Due:     ${fmtRs(remaining)}`);

      doc.moveDown(0.5);
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(remaining > 0 ? "#cc0000" : "#228800")
        .text(remaining > 0 ? "Please settle the outstanding amount promptly." : "Fully paid — thank you!")
        .fillColor("#000000");

      doc.moveDown(2);

      // ── Footer ────────────────────────────────────────────────────────────────
      doc
        .strokeColor("#aaaaaa")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .stroke();
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .font("Helvetica-Oblique")
        .text("This bill is generated electronically. For queries contact the property office.", { align: "center" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── FTP upload ────────────────────────────────────────────────────────────────

/**
 * Generate the electricity bill PDF and upload it to FTP.
 * Returns the remote FTP path and timestamp.
 *
 * @param {Object} reading  - Populated Electricity document
 * @returns {Promise<{ ftpPath: string, generatedAt: Date }>}
 */
export async function generateAndUploadElectricityBill(reading) {
  const tenantId = reading.tenant?._id?.toString() ?? reading.tenant?.toString();
  if (!tenantId) throw new Error("Cannot generate bill: reading has no tenant");

  const filename = `electricity-${reading.nepaliYear}-${reading.nepaliMonth}.pdf`;
  const remotePath = `/bills/${tenantId}/${filename}`;
  const tempPath = path.join(TEMP_DIR, `elec-${reading._id}-${Date.now()}.pdf`);

  // 1. Generate PDF to buffer
  const pdfBuffer = await generateElectricityBillPDF(reading);

  // 2. Write to temp file (ftpClient.upload expects a local file path)
  fs.writeFileSync(tempPath, pdfBuffer);

  try {
    // 3. Upload to FTP
    const success = await ftpClient.upload(tempPath, remotePath);
    if (!success) throw new Error("FTP upload returned false — check FTP credentials/connection");
  } finally {
    // 4. Always clean up temp file
    if (fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }
  }

  return { ftpPath: remotePath, generatedAt: new Date() };
}
