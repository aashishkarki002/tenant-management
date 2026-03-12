import Vendor from "./vendor.model.js";
import VendorContract from "./vendorContract.model.js";
import AssignedPersonnel from "./assignedPersonnel.model.js";

// ─── VENDOR CRUD ───────────────────────────────────────────────────────────────

export const createVendor = async (req, res) => {
  try {
    const {
      name,
      serviceType,
      phone,
      contactPerson,
      email,
      address,
      panNumber,
      vatRegistered,
      bankDetails,
      notes,
    } = req.body;

    if (!name || !serviceType || !phone) {
      return res
        .status(400)
        .json({
          success: false,
          message: "name, serviceType, and phone are required",
        });
    }

    const vendor = await Vendor.create({
      name,
      serviceType,
      phone,
      contactPerson,
      email,
      address,
      panNumber,
      vatRegistered,
      bankDetails,
      notes,
    });

    return res
      .status(201)
      .json({ success: true, message: "Vendor created", vendor });
  } catch (error) {
    console.error("createVendor error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create vendor" });
  }
};

export const getAllVendors = async (req, res) => {
  try {
    const { serviceType, isActive } = req.query;
    const filter = {};
    if (serviceType) filter.serviceType = serviceType;
    if (isActive !== undefined) filter.isActive = isActive === "true";

    const vendors = await Vendor.find(filter).sort({ createdAt: -1 });
    return res
      .status(200)
      .json({ success: true, count: vendors.length, vendors });
  } catch (error) {
    console.error("getAllVendors error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch vendors" });
  }
};

export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });

    // Also return their active contracts
    const contracts = await VendorContract.find({
      vendor: vendor._id,
      isActive: true,
    }).populate("property", "name address");

    return res.status(200).json({ success: true, vendor, contracts });
  } catch (error) {
    console.error("getVendorById error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch vendor" });
  }
};

export const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    return res
      .status(200)
      .json({ success: true, message: "Vendor updated", vendor });
  } catch (error) {
    console.error("updateVendor error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update vendor" });
  }
};

// ─── CONTRACT CRUD ─────────────────────────────────────────────────────────────

export const createContract = async (req, res) => {
  try {
    const {
      vendorId,
      propertyId,
      serviceType,
      description,
      billingCycle,
      contractAmountPaisa,
      startDate,
      endDate,
      autoRenew,
      expenseAccountCode,
      notes,
    } = req.body;

    if (
      !vendorId ||
      !propertyId ||
      !contractAmountPaisa ||
      !startDate ||
      !expenseAccountCode
    ) {
      return res.status(400).json({
        success: false,
        message:
          "vendorId, propertyId, contractAmountPaisa, startDate, expenseAccountCode are required",
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });

    const contract = await VendorContract.create({
      vendor: vendorId,
      property: propertyId,
      serviceType: serviceType || vendor.serviceType,
      description,
      billingCycle,
      contractAmountPaisa,
      startDate,
      endDate,
      autoRenew,
      expenseAccountCode,
      notes,
    });

    return res
      .status(201)
      .json({ success: true, message: "Contract created", contract });
  } catch (error) {
    console.error("createContract error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to create contract" });
  }
};

export const getContractsByVendor = async (req, res) => {
  try {
    const contracts = await VendorContract.find({ vendor: req.params.vendorId })
      .populate("property", "name address")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: contracts.length, contracts });
  } catch (error) {
    console.error("getContractsByVendor error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch contracts" });
  }
};

// ─── ASSIGNED PERSONNEL CRUD ───────────────────────────────────────────────────

export const assignPersonnel = async (req, res) => {
  try {
    const {
      vendorId,
      contractId,
      name,
      phone,
      idType,
      idNumber,
      shift,
      assignedFrom,
      notes,
    } = req.body;

    if (!vendorId || !contractId || !name || !assignedFrom) {
      return res.status(400).json({
        success: false,
        message: "vendorId, contractId, name, and assignedFrom are required",
      });
    }

    const personnel = await AssignedPersonnel.create({
      vendor: vendorId,
      contract: contractId,
      name,
      phone,
      idType,
      idNumber,
      shift,
      assignedFrom,
      notes,
    });

    return res
      .status(201)
      .json({ success: true, message: "Personnel assigned", personnel });
  } catch (error) {
    console.error("assignPersonnel error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to assign personnel" });
  }
};

export const getPersonnelByContract = async (req, res) => {
  try {
    const personnel = await AssignedPersonnel.find({
      contract: req.params.contractId,
      isActive: true,
    }).sort({ assignedFrom: -1 });

    return res
      .status(200)
      .json({ success: true, count: personnel.length, personnel });
  } catch (error) {
    console.error("getPersonnelByContract error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch personnel" });
  }
};

export const updatePersonnel = async (req, res) => {
  try {
    const personnel = await AssignedPersonnel.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );
    if (!personnel)
      return res
        .status(404)
        .json({ success: false, message: "Personnel not found" });
    return res
      .status(200)
      .json({ success: true, message: "Personnel updated", personnel });
  } catch (error) {
    console.error("updatePersonnel error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update personnel" });
  }
};
