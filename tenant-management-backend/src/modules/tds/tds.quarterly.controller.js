import {
  getQuarterlyPayments,
  getQuarterlyPaymentById,
  uploadCertificate,
  verifyQuarterlyPayment,
} from "./tds.quarterly.service.js";

/**
 * GET /api/tds/quarterly
 * Query: tenantId, propertyId, fiscalYear, quarter, status
 */
export async function listQuarterlyPaymentsController(req, res) {
  try {
    const records = await getQuarterlyPayments(req.query);
    return res.status(200).json({ success: true, records });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/tds/quarterly/:id
 */
export async function getQuarterlyPaymentController(req, res) {
  try {
    const record = await getQuarterlyPaymentById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    return res.status(200).json({ success: true, record });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/tds/quarterly/:id/upload-certificate
 * Body: multipart/form-data with field "tdsDocument"
 */
export async function uploadCertificateController(req, res) {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const record = await getQuarterlyPaymentById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Quarterly payment record not found" });
    }

    const result = await uploadCertificate(
      req.params.id,
      file,
      record.tenant._id.toString(),
    );

    return res.status(200).json({
      success: true,
      message: "Certificate uploaded",
      remotePath: result.remotePath,
      certificateUrls: result.bucket.certificateUrls,
      status: result.bucket.status,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}

/**
 * POST /api/tds/quarterly/:id/verify
 * Body: { challanNumber?, paymentDate?, nepaliPaymentDate?, notes? }
 */
export async function verifyQuarterlyPaymentController(req, res) {
  try {
    const adminId = req.admin.id;
    const { challanNumber, paymentDate, nepaliPaymentDate, notes } = req.body;

    const result = await verifyQuarterlyPayment(req.params.id, adminId, {
      challanNumber,
      paymentDate,
      nepaliPaymentDate,
      notes,
    });

    if (result.skipped) {
      return res.status(200).json({
        success: true,
        message: "Already verified",
        skipped: true,
      });
    }

    return res.status(200).json({
      success: true,
      message: "TDS quarterly payment verified",
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
}
