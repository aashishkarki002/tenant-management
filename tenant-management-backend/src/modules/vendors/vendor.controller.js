import {
  createVendorService,
  getAllVendorsService,
  getVendorByIdService,
  updateVendorService,
  deleteVendorService,
  createContractService,
  getContractsByVendorService,
  assignPersonnelService,
  getPersonnelByContractService,
  updatePersonnelService,
  getVendorsByServiceTypeService,
  recordVendorPaymentService,
  getVendorPaymentsService,
  getVendorBalanceService,
} from "./vendor.service.js";

// ─── VENDOR CRUD ───────────────────────────────────────────────────────────────

export const createVendor = async (req, res) => {
  try {
    const vendor = await createVendorService(req.body);
    return res.status(201).json({ success: true, message: "Vendor created", vendor });
  } catch (error) {
    console.error("createVendor error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to create vendor" });
  }
};

export const getAllVendors = async (req, res) => {
  try {
    const vendors = await getAllVendorsService(req.query);
    return res.status(200).json({ success: true, count: vendors.length, vendors });
  } catch (error) {
    console.error("getAllVendors error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendors" });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const { vendor, contracts } = await getVendorByIdService(req.params.id);
    return res.status(200).json({ success: true, vendor, contracts });
  } catch (error) {
    console.error("getVendorById error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to fetch vendor" });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const vendor = await updateVendorService(req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Vendor updated", vendor });
  } catch (error) {
    console.error("updateVendor error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to update vendor" });
  }
};

export const deleteVendor = async (req, res) => {
  try {
    await deleteVendorService(req.params.id);
    return res.status(200).json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("deleteVendor error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to delete vendor" });
  }
};

// ─── CONTRACT CRUD ─────────────────────────────────────────────────────────────

export const createContract = async (req, res) => {
  try {
    const contract = await createContractService(req.body);
    return res.status(201).json({ success: true, message: "Contract created", contract });
  } catch (error) {
    console.error("createContract error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to create contract" });
  }
};

export const getContractsByVendor = async (req, res) => {
  try {
    const contracts = await getContractsByVendorService(req.params.vendorId);
    return res.status(200).json({ success: true, count: contracts.length, contracts });
  } catch (error) {
    console.error("getContractsByVendor error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch contracts" });
  }
};

// ─── ASSIGNED PERSONNEL CRUD ───────────────────────────────────────────────────

export const assignPersonnel = async (req, res) => {
  try {
    const personnel = await assignPersonnelService(req.body);
    return res.status(201).json({ success: true, message: "Personnel assigned", personnel });
  } catch (error) {
    console.error("assignPersonnel error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to assign personnel" });
  }
};

export const getPersonnelByContract = async (req, res) => {
  try {
    const personnel = await getPersonnelByContractService(req.params.contractId);
    return res.status(200).json({ success: true, count: personnel.length, personnel });
  } catch (error) {
    console.error("getPersonnelByContract error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch personnel" });
  }
};

export const updatePersonnel = async (req, res) => {
  try {
    const personnel = await updatePersonnelService(req.params.id, req.body);
    return res.status(200).json({ success: true, message: "Personnel updated", personnel });
  } catch (error) {
    console.error("updatePersonnel error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to update personnel" });
  }
};

export const getVendorsByServiceType = async (req, res) => {
  try {
    const vendors = await getVendorsByServiceTypeService(req.params.serviceType);
    return res.status(200).json({ success: true, vendors });
  } catch (error) {
    console.error("getVendorsByServiceType error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch vendors" });
  }
};

// ─── VENDOR PAYMENTS (AP) ──────────────────────────────────────────────────────

export const recordVendorPayment = async (req, res) => {
  try {
    const payment = await recordVendorPaymentService(req.params.vendorId, req.body, req.admin.id);
    return res.status(201).json({ success: true, message: "Payment recorded", payment });
  } catch (error) {
    console.error("recordVendorPayment error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to record payment" });
  }
};

export const getVendorPayments = async (req, res) => {
  try {
    const payments = await getVendorPaymentsService(req.params.vendorId, req.query);
    return res.status(200).json({ success: true, count: payments.length, payments });
  } catch (error) {
    console.error("getVendorPayments error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch payments" });
  }
};

export const getVendorBalance = async (req, res) => {
  try {
    const balance = await getVendorBalanceService(req.params.vendorId);
    return res.status(200).json({ success: true, balance });
  } catch (error) {
    console.error("getVendorBalance error:", error);
    return res.status(error.statusCode ?? 500).json({ success: false, message: error.message ?? "Failed to fetch vendor balance" });
  }
};
