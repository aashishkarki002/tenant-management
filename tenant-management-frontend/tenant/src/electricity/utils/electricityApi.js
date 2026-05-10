/**
 * Electricity API: get readings (with filters) and create reading.
 */

import api from "../../../plugins/axios";

/**
 * GET /api/electricity/get-readings
 * @param {Object} params - Query: propertyId, unitId, tenantId, nepaliYear, nepaliMonth, status, startDate, endDate, meterType, searchQuery
 * @returns {Promise<{ readings: Array, summary: Object }>}
 */
export async function getReadings(params = {}) {
  const response = await api.get("/api/electricity/get-readings", {
    params: {
      ...params,
      nepaliYear:
        params.nepaliYear != null ? String(params.nepaliYear) : undefined,
      nepaliMonth:
        params.nepaliMonth != null ? String(params.nepaliMonth) : undefined,
      searchQuery: params.searchQuery?.trim() || undefined,
    },
  });
  const result = response.data;
  if (!result?.success || !result?.data) {
    throw new Error(result?.message || "Failed to fetch readings");
  }
  return result.data;
}

/**
 * POST /api/electricity/create-reading
 * @param {Object} body - tenantId, unitId, currentReading, ratePerUnit, nepaliMonth, nepaliYear, nepaliDate, englishMonth, englishYear, readingDate?, previousReading?, notes?
 * @returns {Promise<Object>} Created electricity document
 */
export async function createReading(body) {
  const response = await api.post("/api/electricity/create-reading", body);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to create reading");
  }
  return result.data;
}

/**
 * POST /api/electricity/record-payment
 * @param {Object} body - electricityId, amount, paymentDate?, nepaliDate?, paymentMethod?, bankAccountId?
 * @param {File} [receiptFile] - Optional receipt image/file (sends as multipart with field "receiptImage")
 * @returns {Promise<Object>}
 */
export async function recordPayment(body, receiptFile = null) {
  let response;
  if (receiptFile) {
    const formData = new FormData();
    formData.append("electricityId", body.electricityId);
    formData.append("amount", String(body.amount));
    if (body.paymentDate) formData.append("paymentDate", body.paymentDate);
    if (body.nepaliDate) formData.append("nepaliDate", body.nepaliDate);
    if (body.paymentMethod) formData.append("paymentMethod", body.paymentMethod);
    if (body.bankAccountId) formData.append("bankAccountId", body.bankAccountId);
    formData.append("receiptImage", receiptFile);
    response = await api.post("/api/electricity/record-payment", formData);
  } else {
    response = await api.post("/api/electricity/record-payment", body);
  }
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to record payment");
  }
  return result;
}

/**
 * PUT /api/electricity/update-reading/:id
 * @param {string} id - Electricity reading id
 * @param {Object} body - currentReading?, ratePerUnit?, notes?, status?
 * @returns {Promise<Object>}
 */
export async function updateReading(id, body) {
  const response = await api.put(`/api/electricity/update-reading/${id}`, body);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to update reading");
  }
  return result;
}

/**
 * POST /api/electricity/generate-bill/:id
 * Generates tenant-facing PDF bill and uploads to FTP.
 * @param {string} id - Electricity reading id
 * @returns {Promise<{ ftpPath: string, generatedAt: string }>}
 */
export async function generateBill(id) {
  const response = await api.post(`/api/electricity/generate-bill/${id}`);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to generate bill");
  }
  return result.data;
}

/**
 * POST /api/electricity/nea-bill/:propertyId
 * Upload the monthly NEA utility bill PDF.
 * @param {string} propertyId
 * @param {FormData} formData - Fields: neaBillPdf, totalAmount, nepaliMonth, nepaliYear, notes?
 * @returns {Promise<{ neaBill: Object, reconciliation: Object }>}
 */
export async function uploadNeaBill(propertyId, formData) {
  const response = await api.post(`/api/electricity/nea-bill/${propertyId}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to upload NEA bill");
  }
  return result.data;
}

/**
 * GET /api/electricity/nea-bill/:propertyId
 * List all NEA bills with reconciliation data for a property.
 * @param {string} propertyId
 * @returns {Promise<{ bills: Array, total: number }>}
 */
export async function getNeaBills(propertyId) {
  const response = await api.get(`/api/electricity/nea-bill/${propertyId}`);
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to fetch NEA bills");
  }
  return result.data;
}
/**
 * POST /api/electricity/nea-bill/:propertyId/:billId/pay
 * @param {string} propertyId
 * @param {string} billId
 * @param {Object} body - paymentMethod, bankAccountId?, bankAccountCode?, paymentDate?, nepaliDate?, notes?
 */
export async function payNeaBill(propertyId, billId, body) {
  const response = await api.post(
    `/api/electricity/nea-bill/${propertyId}/${billId}/pay`,
    body,
  );
  const result = response.data;
  if (!result?.success) {
    throw new Error(result?.message || "Failed to record NEA bill payment");
  }
  return result.data;
}

export async function parseNeaBillPdf(propertyId, formData) {
  const res = await api.post(
    `/api/electricity/nea-bill/${propertyId}/parse`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.data; // raw parsed fields
}