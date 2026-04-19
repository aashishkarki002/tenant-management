import PDFDocument from "pdfkit";

/**
 * generateTdsCertificate
 *
 * Generates a TDS certificate PDF buffer for a tenant for a given Nepali fiscal year.
 *
 * @param {Object} options
 * @param {Object} options.tenant   - Tenant document (name, address, panNumber)
 * @param {Array}  options.rents    - Rent documents with TDS amounts and dates
 * @param {string} options.nepaliYear - Nepali year string e.g. "2081"
 * @param {Object} options.issuer   - Issuing party info { name, address, panNumber, phone }
 * @returns {Promise<Buffer>}
 */
export async function generateTdsCertificate({ tenant, rents, nepaliYear, issuer = {} }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const L = 50;
      const R = 545;
      const W = R - L;

      const issuerName = issuer.name || "Sallyan House";
      const issuerAddress = issuer.address || "Kathmandu, Nepal";
      const issuerPAN = issuer.panNumber || "";
      const issuerPhone = issuer.phone || "+977-9812345678";

      // ── HEADER ────────────────────────────────────────────────────────────────
      doc.fontSize(18).font("Helvetica-Bold").text(issuerName, L, 50, { align: "center", width: W });
      doc.fontSize(10).font("Helvetica").text(issuerAddress, L, doc.y, { align: "center", width: W });
      if (issuerPAN) doc.text(`PAN: ${issuerPAN}`, L, doc.y, { align: "center", width: W });
      doc.text(`Tel: ${issuerPhone}`, L, doc.y, { align: "center", width: W });

      doc.moveDown(0.8);
      doc.strokeColor("#333333").lineWidth(1.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.6);

      doc.fontSize(14).font("Helvetica-Bold").text("TDS DEDUCTION CERTIFICATE", L, doc.y, { align: "center", width: W });
      doc.fontSize(10).font("Helvetica").text(`Fiscal Year: ${nepaliYear}/${String(parseInt(nepaliYear) + 1).slice(-2)} (BS)`, L, doc.y, { align: "center", width: W });

      doc.moveDown(0.6);
      doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.8);

      // ── CERTIFICATE NUMBER ────────────────────────────────────────────────────
      const certNo = `TDS-${nepaliYear}-${tenant._id?.toString().slice(-6).toUpperCase()}`;
      doc.fontSize(10).font("Helvetica");
      doc.text(`Certificate No: ${certNo}`, L);
      doc.text(`Issue Date: ${new Date().toLocaleDateString("en-GB")}`, L, doc.y);
      doc.moveDown(0.8);

      // ── DEDUCTEE INFO ─────────────────────────────────────────────────────────
      doc.fontSize(11).font("Helvetica-Bold").text("Deductee (Tenant) Details", L, doc.y, { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Name:     ${tenant.name}`, L);
      doc.text(`Address:  ${tenant.address || "N/A"}`, L, doc.y);
      if (tenant.panNumber) doc.text(`PAN No:   ${tenant.panNumber}`, L, doc.y);
      doc.moveDown(0.8);

      // ── DEDUCTOR INFO ─────────────────────────────────────────────────────────
      doc.fontSize(11).font("Helvetica-Bold").text("Deductor (Landlord) Details", L, doc.y, { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font("Helvetica");
      doc.text(`Name:     ${issuerName}`, L);
      doc.text(`Address:  ${issuerAddress}`, L, doc.y);
      if (issuerPAN) doc.text(`PAN No:   ${issuerPAN}`, L, doc.y);
      doc.moveDown(0.8);

      // ── TDS TABLE ─────────────────────────────────────────────────────────────
      doc.fontSize(11).font("Helvetica-Bold").text("TDS Deduction Details", L, doc.y, { underline: true });
      doc.moveDown(0.5);

      const colX = {
        month: L,
        gross: L + 115,
        rate: L + 235,
        tds: L + 310,
        netRent: L + 400,
      };

      const tblTop = doc.y;
      const rowH = 18;

      // Header row background
      doc.rect(L, tblTop, W, rowH).fillAndStroke("#f0f0f0", "#cccccc");
      doc.fillColor("#000000")
        .fontSize(9).font("Helvetica-Bold")
        .text("Month (BS)", colX.month + 3, tblTop + 4)
        .text("Gross Rent (Rs.)", colX.gross + 3, tblTop + 4)
        .text("TDS Rate", colX.rate + 3, tblTop + 4)
        .text("TDS Amount (Rs.)", colX.tds + 3, tblTop + 4)
        .text("Net Rent (Rs.)", colX.netRent + 3, tblTop + 4);

      let rowY = tblTop + rowH;
      let totalGross = 0;
      let totalTds = 0;

      const sortedRents = [...rents].sort((a, b) => {
        const aKey = `${a.nepaliYear || a.year}-${String(a.nepaliMonth || a.month).padStart(2, "0")}`;
        const bKey = `${b.nepaliYear || b.year}-${String(b.nepaliMonth || b.month).padStart(2, "0")}`;
        return aKey.localeCompare(bKey);
      });

      sortedRents.forEach((rent, i) => {
        const gross = rent.grossRentAmountPaisa ?? rent.rentAmountPaisa ?? 0;
        const tds = rent.tdsAmountPaisa ?? 0;
        const net = gross - tds;
        const tdsRate = gross > 0 ? ((tds / gross) * 100).toFixed(1) + "%" : "0%";
        const monthLabel = `${rent.nepaliYear || rent.year}-${String(rent.nepaliMonth || rent.month).padStart(2, "0")}`;

        totalGross += gross;
        totalTds += tds;

        const bg = i % 2 === 0 ? "#ffffff" : "#fafafa";
        doc.rect(L, rowY, W, rowH).fillAndStroke(bg, "#e0e0e0");
        doc.fillColor("#000000").fontSize(9).font("Helvetica")
          .text(monthLabel, colX.month + 3, rowY + 4)
          .text((gross / 100).toLocaleString(), colX.gross + 3, rowY + 4)
          .text(tdsRate, colX.rate + 3, rowY + 4)
          .text((tds / 100).toLocaleString(), colX.tds + 3, rowY + 4)
          .text((net / 100).toLocaleString(), colX.netRent + 3, rowY + 4);

        rowY += rowH;
      });

      // Totals row
      doc.rect(L, rowY, W, rowH).fillAndStroke("#e8f0fe", "#aaaaaa");
      doc.fillColor("#000000").fontSize(9).font("Helvetica-Bold")
        .text("TOTAL", colX.month + 3, rowY + 4)
        .text((totalGross / 100).toLocaleString(), colX.gross + 3, rowY + 4)
        .text("", colX.rate + 3, rowY + 4)
        .text((totalTds / 100).toLocaleString(), colX.tds + 3, rowY + 4)
        .text(((totalGross - totalTds) / 100).toLocaleString(), colX.netRent + 3, rowY + 4);

      doc.y = rowY + rowH + 15;
      doc.moveDown(0.5);

      // ── SUMMARY BOX ───────────────────────────────────────────────────────────
      doc.fontSize(10).font("Helvetica-Bold")
        .text(`Total TDS Deducted: Rs. ${(totalTds / 100).toLocaleString()}`, L);
      doc.font("Helvetica").text(
        "This amount has been/will be deposited to the Inland Revenue Department (IRD) of Nepal.",
        L, doc.y, { width: W }
      );
      doc.moveDown(1.5);

      // ── SIGNATURE BLOCK ───────────────────────────────────────────────────────
      doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.6);

      const sigY = doc.y;
      doc.fontSize(10).font("Helvetica");
      doc.text("Authorised Signatory", L, sigY);
      doc.text("Tenant Acknowledgment", L + 300, sigY);
      doc.moveDown(2.5);

      doc.moveTo(L, doc.y).lineTo(L + 180, doc.y).stroke();
      doc.moveTo(L + 300, doc.y).lineTo(L + 480, doc.y).stroke();
      doc.moveDown(0.3);

      doc.fontSize(9).font("Helvetica-Oblique").text(`${issuerName}`, L);
      doc.text(tenant.name, L + 300, doc.y - 12);
      doc.moveDown(1.5);

      // ── FOOTER ────────────────────────────────────────────────────────────────
      doc.strokeColor("#aaaaaa").lineWidth(0.5).moveTo(L, doc.y).lineTo(R, doc.y).stroke();
      doc.moveDown(0.4);
      doc.fontSize(8).font("Helvetica-Oblique").fillColor("#555555")
        .text(
          "This certificate is issued under Section 88 of the Income Tax Act, 2058 (Nepal). " +
          "TDS was deducted at source on rent payments at the applicable rate.",
          L, doc.y, { align: "center", width: W }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
