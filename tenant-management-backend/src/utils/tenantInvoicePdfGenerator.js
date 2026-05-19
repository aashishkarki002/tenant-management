import PDFDocument from "pdfkit";

const NEPALI_MONTHS = [
  "", "Baishakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

const rs = (paisa) => `Rs. ${(paisa / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

/**
 * generateTenantInvoicePDF
 *
 * Portrait A4 invoice for a single tenant's monthly charges.
 *
 * @param {Object} options
 * @param {Object} options.rent              - Lean rent doc with populated tenant/block/units
 * @param {number} options.camAmountPaisa
 * @param {number} options.electricityAmountPaisa
 * @param {string} options.invoiceNumber     - Human-readable invoice ref (documentNumber)
 * @param {Object} [options.issuer]          - { name, address, panNumber, phone }
 * @returns {Promise<Buffer>}
 */
export async function generateTenantInvoicePDF({
  rent,
  camAmountPaisa,
  electricityAmountPaisa,
  invoiceNumber,
  issuer = {},
}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];
      doc.on("data", (c) => buffers.push(c));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const L = 50;
      const R = 545;
      const W = R - L;

      const issuerName = issuer.name || "Sallyan House";
      const issuerAddress = issuer.address || "Kathmandu, Nepal";
      const issuerPAN = issuer.panNumber || "";
      const issuerPhone = issuer.phone || "";

      const tenantName = rent.tenant?.name || "—";
      const tenantEmail = rent.tenant?.email || "";
      const blockName = rent.block?.name || rent.innerBlock?.name || "";
      const unitNames = rent.units?.map((u) => u.name).filter(Boolean).join(", ") || "";
      const locationLine = [blockName, unitNames].filter(Boolean).join(", ") || "—";

      const monthName = NEPALI_MONTHS[rent.nepaliMonth] || `Month ${rent.nepaliMonth}`;
      const periodLabel = `${monthName} ${rent.nepaliYear}`;
      const generatedDate = new Date().toLocaleDateString("en-GB");

      const grossRent = rent.grossRentAmountPaisa ?? 0;
      const tds = rent.tdsAmountPaisa ?? 0;
      const paid = rent.paidAmountPaisa ?? 0;
      const cam = camAmountPaisa ?? 0;
      const elec = electricityAmountPaisa ?? 0;

      const subtotal = grossRent + cam + elec;
      const netPayable = subtotal - tds;
      const balanceDue = Math.max(0, netPayable - paid);

      // ── HEADER ──────────────────────────────────────────────────────────────
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(issuerName, L, 50, { align: "center", width: W });
      doc.fontSize(10).font("Helvetica").fillColor("#555555")
        .text(issuerAddress, L, doc.y, { align: "center", width: W });
      if (issuerPAN) doc.text(`PAN: ${issuerPAN}`, L, doc.y, { align: "center", width: W });
      if (issuerPhone) doc.text(`Tel: ${issuerPhone}`, L, doc.y, { align: "center", width: W });

      doc.moveDown(0.6);
      doc.strokeColor("#dddddd").lineWidth(1).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.6);

      // ── INVOICE TITLE + META ─────────────────────────────────────────────────
      const metaTop = doc.y;
      doc.fontSize(22).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text("INVOICE", L, metaTop);

      // Right-aligned invoice meta block
      const metaX = R - 180;
      doc.fontSize(9).font("Helvetica").fillColor("#555555");
      doc.text(`Invoice No:`, metaX, metaTop, { width: 80, align: "left" });
      doc.font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(invoiceNumber, metaX + 80, metaTop, { width: 100, align: "left" });

      doc.font("Helvetica").fillColor("#555555")
        .text(`Date:`, metaX, metaTop + 14, { width: 80 });
      doc.font("Helvetica").fillColor("#333333")
        .text(generatedDate, metaX + 80, metaTop + 14, { width: 100 });

      doc.font("Helvetica").fillColor("#555555")
        .text(`Period:`, metaX, metaTop + 28, { width: 80 });
      doc.font("Helvetica").fillColor("#333333")
        .text(periodLabel, metaX + 80, metaTop + 28, { width: 100 });

      doc.y = metaTop + 50;
      doc.moveDown(0.4);
      doc.strokeColor("#dddddd").lineWidth(1).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.8);

      // ── BILL TO ──────────────────────────────────────────────────────────────
      const billToY = doc.y;
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#888888")
        .text("BILL TO", L, billToY);
      doc.moveDown(0.3);
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text(tenantName, L, doc.y);
      doc.fontSize(10).font("Helvetica").fillColor("#555555")
        .text(locationLine, L, doc.y);
      if (tenantEmail) doc.text(tenantEmail, L, doc.y);

      doc.moveDown(1.2);
      doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.6);

      // ── LINE ITEMS TABLE ──────────────────────────────────────────────────────
      const col1 = L;
      const col2 = R - 120;
      const colW2 = 120;

      // Table header
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#555555");
      doc.text("Description", col1, doc.y);
      doc.text("Amount", col2, doc.y - doc.currentLineHeight(), { width: colW2, align: "right" });
      doc.moveDown(0.3);
      doc.strokeColor("#333333").lineWidth(0.75).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      const lineItem = (label, paisa, bold = false) => {
        const y = doc.y;
        doc.fontSize(10)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor("#1a1a1a")
          .text(label, col1, y);
        doc.font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor("#1a1a1a")
          .text(rs(paisa), col2, y, { width: colW2, align: "right" });
        doc.moveDown(0.5);
      };

      lineItem("Base Rent", grossRent);
      lineItem("CAM Charge", cam);
      lineItem("Electricity", elec);

      doc.moveDown(0.2);
      doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      lineItem("Subtotal", subtotal);

      if (tds > 0) {
        const y = doc.y;
        const tdsRate = grossRent > 0 ? ((tds / grossRent) * 100).toFixed(2) : "0";
        doc.fontSize(10).font("Helvetica").fillColor("#1a1a1a")
          .text(`Less: TDS (${tdsRate}%)`, col1, y);
        doc.font("Helvetica").fillColor("#c0392b")
          .text(`(${rs(tds)})`, col2, y, { width: colW2, align: "right" });
        doc.moveDown(0.5);
      }

      doc.strokeColor("#333333").lineWidth(1).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      lineItem("Net Payable", netPayable, true);

      doc.moveDown(0.3);
      doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      lineItem("Amount Paid", paid);

      doc.moveDown(0.2);
      doc.strokeColor("#333333").lineWidth(1).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);

      // Balance due — highlighted
      const bdY = doc.y;
      const statusText = rent.status?.toUpperCase() || "PENDING";
      const statusColor = rent.status === "paid" ? "#27ae60" : rent.status === "overdue" ? "#c0392b" : "#e67e22";

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#1a1a1a")
        .text("Balance Due", col1, bdY);
      doc.fontSize(13).font("Helvetica-Bold").fillColor(balanceDue > 0 ? "#c0392b" : "#27ae60")
        .text(rs(balanceDue), col2, bdY, { width: colW2, align: "right" });
      doc.moveDown(1.0);

      // Status badge
      const badgeY = doc.y;
      doc.roundedRect(L, badgeY, 70, 18, 4).fill(statusColor);
      doc.fontSize(8).font("Helvetica-Bold").fillColor("#ffffff")
        .text(statusText, L + 5, badgeY + 5, { width: 60, align: "center" });
      doc.moveDown(2.5);

      // ── FOOTER ───────────────────────────────────────────────────────────────
      doc.strokeColor("#dddddd").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(8).font("Helvetica").fillColor("#aaaaaa")
        .text("Thank you for your business. Please quote the invoice number for all payments.", L, doc.y, {
          align: "center", width: W,
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
