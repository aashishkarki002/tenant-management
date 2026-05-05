import { Tenant } from "../tenant/Tenant.Model.js";
import {
  sendSMS,
  sendBulkSMS,
  sendSMSSafe,
  checkBalance,
} from "../../config/nestsms.js";

class SmsService {
  _buildQuery(filters = {}) {
    const query = { isDeleted: false };
    if (filters.property) query.property = filters.property;
    if (filters.block) query.block = filters.block;
    if (filters.innerBlock) query.innerBlock = filters.innerBlock;
    if (filters.status) query.status = filters.status;
    if (filters.tenantIds && Array.isArray(filters.tenantIds))
      query._id = { $in: filters.tenantIds };
    if (filters.unit) query.units = filters.unit;
    return query;
  }

  _personalize(template, tenant) {
    const replacements = {
      "{{tenantName}}": tenant.name || "Valued Tenant",
      "{{phone}}": tenant.phone || "",
      "{{property}}": tenant.property?.name || "",
      "{{block}}": tenant.block?.name || "",
      "{{innerBlock}}": tenant.innerBlock?.name || "",
      "{{units}}": tenant.units?.map((u) => u.name).join(", ") || "",
      "{{totalRent}}": tenant.totalRent ?? 0,
      "{{securityDeposit}}": tenant.securityDeposit ?? 0,
    };
    return Object.entries(replacements).reduce(
      (msg, [key, val]) => msg.replace(new RegExp(key, "g"), val),
      template
    );
  }

  async sendBroadcastSms(filters = {}, message, messageType = "transactional") {
    const query = this._buildQuery(filters);
    const tenants = await Tenant.find(query)
      .populate("property", "name")
      .populate("block", "name")
      .populate("innerBlock", "name")
      .populate("units", "name")
      .lean();

    if (tenants.length === 0) {
      return {
        success: false,
        message: "No tenants found matching the filters",
        sentCount: 0,
        failedCount: 0,
      };
    }

    const withPhone = tenants.filter((t) => t.phone);
    const withoutPhone = tenants.filter((t) => !t.phone);

    const results = { sent: [], failed: [] };

    // Personalise each message individually, then fire
    const promises = withPhone.map(async (tenant) => {
      const personalised = this._personalize(message, tenant);
      try {
        const result = await sendSMS(tenant.phone, personalised, messageType);
        results.sent.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          phone: tenant.phone,
          jobId: result.jobId,
        });
      } catch (err) {
        results.failed.push({
          tenantId: tenant._id,
          tenantName: tenant.name,
          phone: tenant.phone,
          reason: err.message,
        });
      }
    });

    await Promise.all(promises);

    // Tenants with no phone are auto-failed
    withoutPhone.forEach((t) =>
      results.failed.push({
        tenantId: t._id,
        tenantName: t.name,
        reason: "No phone number",
      })
    );

    return {
      success: true,
      message: "Broadcast SMS completed",
      totalTenants: tenants.length,
      sentCount: results.sent.length,
      failedCount: results.failed.length,
      details: { sent: results.sent, failed: results.failed },
      filters,
    };
  }

  async sendBulkBroadcastSms(
    filters = {},
    message,
    messageType = "promotional"
  ) {
    const query = this._buildQuery(filters);
    const tenants = await Tenant.find(query).select("name phone").lean();

    if (tenants.length === 0) {
      return {
        success: false,
        message: "No tenants found matching the filters",
        queuedCount: 0,
      };
    }

    const phones = tenants.filter((t) => t.phone).map((t) => t.phone);
    const skipped = tenants.filter((t) => !t.phone).length;

    if (phones.length === 0) {
      return {
        success: false,
        message: "No tenants with phone numbers found",
        queuedCount: 0,
        skipped,
      };
    }

    const result = await sendBulkSMS(phones, message, messageType);

    return {
      success: true,
      message: "Bulk SMS queued",
      ...result,
      totalTenants: tenants.length,
      skipped,
      filters,
    };
  }

  async sendSingleSms(phone, message, messageType = "transactional") {
    const result = await sendSMS(phone, message, messageType);
    return { success: true, ...result };
  }

  async getRecipientsPreview(filters = {}) {
    const query = this._buildQuery(filters);
    const tenants = await Tenant.find(query)
      .select("name phone property block innerBlock units")
      .populate("property", "name")
      .populate("block", "name")
      .populate("innerBlock", "name")
      .populate("units", "name")
      .lean();

    const withPhone = tenants.filter((t) => t.phone);
    const withoutPhone = tenants.filter((t) => !t.phone);

    return {
      success: true,
      totalCount: tenants.length,
      withPhoneCount: withPhone.length,
      withoutPhoneCount: withoutPhone.length,
      tenants: tenants.map((t) => ({
        id: t._id,
        name: t.name,
        phone: t.phone,
        property: t.property?.name,
        block: t.block?.name,
        innerBlock: t.innerBlock?.name,
        units: t.units?.map((u) => u.name).join(", "),
      })),
      tenantsWithoutPhone: withoutPhone.map((t) => ({
        id: t._id,
        name: t.name,
      })),
    };
  }

  async getBalance() {
    const balance = await checkBalance();
    return { success: true, ...balance };
  }
}

export const smsService = new SmsService();
