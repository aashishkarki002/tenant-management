import api from "../../../plugins/axios";

/**
 * Vendor Service
 * Handles all API calls related to vendors, contracts, and personnel
 */

// ─── VENDOR CRUD ───────────────────────────────────────────────────────────────

export const getAllVendors = async (params = {}) => {
  const { serviceType, isActive } = params;
  const queryParams = new URLSearchParams();

  if (serviceType) queryParams.append("serviceType", serviceType);
  if (isActive !== undefined) queryParams.append("isActive", isActive);

  const queryString = queryParams.toString();
  const url = queryString ? `/api/vendor?${queryString}` : "/api/vendor";

  const response = await api.get(url);
  return response.data;
};

export const getVendorById = async (vendorId) => {
  const response = await api.get(`/api/vendor/${vendorId}`);
  return response.data;
};

export const createVendor = async (vendorData) => {
  const response = await api.post("/api/vendor", vendorData);
  return response.data;
};

export const updateVendor = async (vendorId, vendorData) => {
  const response = await api.patch(`/api/vendor/${vendorId}`, vendorData);
  return response.data;
};

export const deleteVendor = async (vendorId) => {
  const response = await api.delete(`/api/vendor/${vendorId}`);
  return response.data;
};

export const getVendorsByServiceType = async (serviceType) => {
  const response = await api.get(`/api/vendor/service-type/${serviceType}`);
  return response.data;
};

// ─── CONTRACT CRUD ─────────────────────────────────────────────────────────────

export const createContract = async (contractData) => {
  const response = await api.post("/api/vendor/contracts", contractData);
  return response.data;
};

export const getContractsByVendor = async (vendorId) => {
  const response = await api.get(`/api/vendor/${vendorId}/contracts`);
  return response.data;
};

// ─── ASSIGNED PERSONNEL CRUD ───────────────────────────────────────────────────

export const assignPersonnel = async (personnelData) => {
  const response = await api.post("/api/vendor/personnel", personnelData);
  return response.data;
};

export const getPersonnelByContract = async (contractId) => {
  const response = await api.get(
    `/api/vendor/contracts/${contractId}/personnel`,
  );
  return response.data;
};

export const updatePersonnel = async (personnelId, personnelData) => {
  const response = await api.patch(
    `/api/vendor/personnel/${personnelId}`,
    personnelData,
  );
  return response.data;
};

// ─── VENDOR PAYMENTS (AP) ──────────────────────────────────────────────────────

export const recordVendorPayment = async (vendorId, paymentData) => {
  const response = await api.post(`/api/vendor/${vendorId}/payments`, paymentData);
  return response.data;
};

export const getVendorPayments = async (vendorId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.from) params.append("from", filters.from);
  if (filters.to) params.append("to", filters.to);
  if (filters.contractId) params.append("contractId", filters.contractId);
  const qs = params.toString();
  const url = qs ? `/api/vendor/${vendorId}/payments?${qs}` : `/api/vendor/${vendorId}/payments`;
  const response = await api.get(url);
  return response.data;
};

export const getVendorBalance = async (vendorId) => {
  const response = await api.get(`/api/vendor/${vendorId}/balance`);
  return response.data;
};

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

/**
 * Transform backend vendor model to frontend format
 * Backend uses serviceType enum, frontend expects vendor_type
 */
export const transformVendorForFrontend = (vendor) => {
  return {
    _id: vendor._id,
    name: vendor.name,
    vendor_type:
      vendor.serviceType === "courtyard_vendor" ? "stall" : "service",
    serviceType: vendor.serviceType,
    contact: vendor.phone || vendor.email || "",
    phone: vendor.phone,
    email: vendor.email,
    contactPerson: vendor.contactPerson,
    address: vendor.address,
    panNumber: vendor.panNumber,
    vatRegistered: vendor.vatRegistered,
    bankDetails: vendor.bankDetails,
    status: vendor.isActive ? "active" : "inactive",
    isActive: vendor.isActive,
    notes: vendor.notes,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
  };
};

/**
 * Transform frontend form data to backend vendor model
 */
export const transformVendorForBackend = (formData) => {
  const serviceType =
    formData.vendor_type === "stall"
      ? "courtyard_vendor"
      : formData.serviceType || "other";

  return {
    name: formData.name,
    serviceType,
    phone: formData.contact || formData.phone,
    email: formData.email || null,
    contactPerson: formData.contactPerson || null,
    address: formData.address || null,
    panNumber: formData.panNumber || null,
    vatRegistered: formData.vatRegistered || false,
    bankDetails: formData.bankDetails || {},
    notes: formData.notes || null,
    isActive: formData.status === "active" || formData.isActive !== false,
  };
};
