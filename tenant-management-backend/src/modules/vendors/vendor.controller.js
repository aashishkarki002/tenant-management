import Vendor from "./vendor.model.js";
import VendorContract from "./vendorContract.model.js";
import AssignedPersonnel from "./assignedPersonnel.model.js";
import VendorPayment from "./vendorPayment.model.js";

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
      return res.status(400).json({
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
      returnDocument: "after",
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

export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor)
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    return res
      .status(200)
      .json({ success: true, message: "Vendor deleted successfully" });
  } catch (error) {
    console.error("deleteVendor error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to delete vendor" });
  }
};

// ─── CONTRACT CRUD ─────────────────────────────────────────────────────────────

export const createContract = async (req, res) => {
  try {
    const {
      vendorId,
      propertyId,
      contractType = "service",
      serviceType,
      description,
      billingCycle,
      contractAmountPaisa,
      startDate,
      endDate,
      autoRenew,
      expenseAccountCode,
      revenueAccountCode,
      stallDescription,
      eventName,
      leaseDays,
      notes,
    } = req.body;

    if (!vendorId || !propertyId || !contractAmountPaisa || !startDate) {
      return res.status(400).json({
        success: false,
        message: "vendorId, propertyId, contractAmountPaisa, startDate are required",
      });
    }

    if (contractType === "service" && !expenseAccountCode) {
      return res.status(400).json({
        success: false,
        message: "expenseAccountCode is required for service contracts",
      });
    }

    if (contractType === "stall_lease" && !revenueAccountCode) {
      return res.status(400).json({
        success: false,
        message: "revenueAccountCode is required for stall_lease contracts",
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
      contractType,
      serviceType: serviceType || vendor.serviceType,
      description,
      billingCycle,
      contractAmountPaisa,
      startDate,
      endDate,
      autoRenew,
      expenseAccountCode: contractType === "service" ? expenseAccountCode : null,
      revenueAccountCode: contractType === "stall_lease" ? revenueAccountCode : null,
      stallDescription: contractType === "stall_lease" ? stallDescription : null,
      eventName: contractType === "stall_lease" ? eventName : null,
      leaseDays: contractType === "stall_lease" ? leaseDays : null,
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
      { returnDocument: "after", runValidators: true },
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
export const getVendorsByServiceType = async (req, res) => {
  try {
    const { serviceType } = req.params;
    const vendors = await Vendor.find({
      serviceType,
      isActive: true,
    })
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({ success: true, vendors });
  } catch (error) {
    console.error("getVendorsByServiceType error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch vendors" });
  }
};

// ─── VENDOR PAYMENTS (AP) ──────────────────────────────────────────────────────

export const recordVendorPayment = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const {
      contractId,
      amountPaisa,
      paymentDate,
      nepaliDate,
      paymentMethod,
      bankAccountId,
      referenceNumber,
      tdsDeductedPaisa,
      notes,
    } = req.body;

    if (!amountPaisa || !paymentDate || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "amountPaisa, paymentDate, and paymentMethod are required",
      });
    }

    if (
      (paymentMethod === "bank_transfer" || paymentMethod === "cheque") &&
      !bankAccountId
    ) {
      return res.status(400).json({
        success: false,
        message: "bankAccountId is required for bank_transfer or cheque payments",
      });
    }

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }

    const payment = await VendorPayment.create({
      vendor: vendorId,
      contract: contractId || null,
      amountPaisa,
      paymentDirection: req.body.paymentDirection === "inflow" ? "inflow" : "outflow",
      paymentDate,
      nepaliDate: nepaliDate || null,
      paymentMethod,
      bankAccount: bankAccountId || null,
      referenceNumber: referenceNumber || null,
      tdsDeductedPaisa: tdsDeductedPaisa || 0,
      notes: notes || null,
      recordedBy: req.admin.id,
    });

    await payment.populate([
      { path: "contract", select: "description billingCycle contractAmountPaisa" },
      { path: "bankAccount", select: "bankName accountNumber" },
      { path: "recordedBy", select: "name email" },
    ]);

    return res.status(201).json({ success: true, message: "Payment recorded", payment });
  } catch (error) {
    console.error("recordVendorPayment error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to record payment" });
  }
};

export const getVendorPayments = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { from, to, contractId } = req.query;

    const filter = { vendor: vendorId };
    if (contractId) filter.contract = contractId;
    if (from || to) {
      filter.paymentDate = {};
      if (from) filter.paymentDate.$gte = new Date(from);
      if (to) filter.paymentDate.$lte = new Date(to);
    }

    const payments = await VendorPayment.find(filter)
      .populate("contract", "description billingCycle")
      .populate("bankAccount", "bankName accountNumber")
      .populate("recordedBy", "name email")
      .sort({ paymentDate: -1 });

    return res.status(200).json({ success: true, count: payments.length, payments });
  } catch (error) {
    console.error("getVendorPayments error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch payments" });
  }
};

export const getVendorBalance = async (req, res) => {
  try {
    const { vendorId } = req.params;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res
        .status(404)
        .json({ success: false, message: "Vendor not found" });
    }

    const [contractAgg, paymentAgg] = await Promise.all([
      VendorContract.aggregate([
        { $match: { vendor: vendor._id, isActive: true } },
        {
          $group: {
            _id: "$contractType",
            total: { $sum: "$contractAmountPaisa" },
          },
        },
      ]),
      VendorPayment.aggregate([
        { $match: { vendor: vendor._id } },
        {
          $group: {
            _id: "$paymentDirection",
            total: { $sum: "$amountPaisa" },
            totalTds: { $sum: "$tdsDeductedPaisa" },
          },
        },
      ]),
    ]);

    const serviceContractPaisa =
      contractAgg.find((r) => r._id === "service")?.total ?? 0;
    const stallLeaseContractPaisa =
      contractAgg.find((r) => r._id === "stall_lease")?.total ?? 0;

    const totalOutflowPaisa =
      paymentAgg.find((r) => r._id === "outflow")?.total ?? 0;
    const totalInflowPaisa =
      paymentAgg.find((r) => r._id === "inflow")?.total ?? 0;
    const totalTdsDeductedPaisa =
      paymentAgg.find((r) => r._id === "outflow")?.totalTds ?? 0;

    // Expense outstanding: what we still owe service vendors
    const expenseOutstandingPaisa = serviceContractPaisa - totalOutflowPaisa;
    // Revenue outstanding: what stall vendors still owe us
    const revenueOutstandingPaisa = stallLeaseContractPaisa - totalInflowPaisa;

    return res.status(200).json({
      success: true,
      balance: {
        // expense (service contracts)
        serviceContractPaisa,
        totalOutflowPaisa,
        expenseOutstandingPaisa,
        totalTdsDeductedPaisa,
        // revenue (stall_lease contracts)
        stallLeaseContractPaisa,
        totalInflowPaisa,
        revenueOutstandingPaisa,
      },
    });
  } catch (error) {
    console.error("getVendorBalance error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch vendor balance" });
  }
};
