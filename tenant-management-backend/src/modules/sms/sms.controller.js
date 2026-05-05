import { smsService } from "./sms.service.js";

/**
 * POST /api/sms/send-broadcast
 * Body: { filters, message, messageType? }
 * Personalises message per tenant and sends individually.
 */
export const sendBroadcastSms = async (req, res) => {
  try {
    const { filters = {}, message, messageType = "transactional" } = req.body;

    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "message is required" });
    }
    if (message.length > 720) {
      return res
        .status(400)
        .json({ success: false, message: "message must be ≤ 720 characters" });
    }

    const result = await smsService.sendBroadcastSms(
      filters,
      message,
      messageType
    );

    if (!result.success && result.sentCount === 0 && !result.totalTenants) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("sendBroadcastSms error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send broadcast SMS",
      error: err.message,
    });
  }
};

/**
 * POST /api/sms/send-bulk
 * Body: { filters, message, messageType? }
 * Single API call with recipient list (no personalisation). Faster for large lists.
 */
export const sendBulkSms = async (req, res) => {
  try {
    const { filters = {}, message, messageType = "promotional" } = req.body;

    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "message is required" });
    }
    if (message.length > 720) {
      return res
        .status(400)
        .json({ success: false, message: "message must be ≤ 720 characters" });
    }

    const result = await smsService.sendBulkBroadcastSms(
      filters,
      message,
      messageType
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(200).json(result);
  } catch (err) {
    console.error("sendBulkSms error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send bulk SMS",
      error: err.message,
    });
  }
};

/**
 * POST /api/sms/send-single
 * Body: { phone, message, messageType? }
 */
export const sendSingleSms = async (req, res) => {
  try {
    const { phone, message, messageType = "transactional" } = req.body;

    if (!phone || !message) {
      return res
        .status(400)
        .json({ success: false, message: "phone and message are required" });
    }
    if (message.length > 720) {
      return res
        .status(400)
        .json({ success: false, message: "message must be ≤ 720 characters" });
    }

    const result = await smsService.sendSingleSms(phone, message, messageType);
    res.status(200).json(result);
  } catch (err) {
    console.error("sendSingleSms error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to send SMS",
      error: err.message,
    });
  }
};

/**
 * POST /api/sms/preview-recipients
 * Body: { filters }
 */
export const previewSmsRecipients = async (req, res) => {
  try {
    const { filters = {} } = req.body;
    const result = await smsService.getRecipientsPreview(filters);
    res.status(200).json(result);
  } catch (err) {
    console.error("previewSmsRecipients error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to preview recipients",
      error: err.message,
    });
  }
};

/**
 * GET /api/sms/balance
 */
export const getSmsBalance = async (req, res) => {
  try {
    const result = await smsService.getBalance();
    res.status(200).json(result);
  } catch (err) {
    console.error("getSmsBalance error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch SMS balance",
      error: err.message,
    });
  }
};

/**
 * GET /api/sms/placeholders
 */
export const getSmsPlaceholders = async (_req, res) => {
  res.status(200).json({
    success: true,
    placeholders: [
      { key: "{{tenantName}}", description: "Tenant's full name", example: "Ram Sharma" },
      { key: "{{phone}}", description: "Tenant's phone number", example: "9840123456" },
      { key: "{{property}}", description: "Property name", example: "Sunrise Apartments" },
      { key: "{{block}}", description: "Block name", example: "Block A" },
      { key: "{{innerBlock}}", description: "Inner block name", example: "Floor 2" },
      { key: "{{units}}", description: "Comma-separated unit names", example: "A-201, A-202" },
      { key: "{{totalRent}}", description: "Total rent amount", example: "25000" },
      { key: "{{securityDeposit}}", description: "Security deposit amount", example: "50000" },
    ],
    note: "Placeholders only work with send-broadcast (personalised). send-bulk sends identical text to all.",
    example: "Dear {{tenantName}}, your rent of Rs.{{totalRent}} is due. - Management",
  });
};
