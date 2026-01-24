import fs from "fs";
import path from "path";
import { Tenant } from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import cloudinary from "../../config/cloudinary.js";
import { Rent } from "../rents/rent.Model.js";
import mongoose from "mongoose";
import { Unit } from "./units/unit.model.js";
import { getNepaliMonthDates } from "../../utils/nepaliDateHelper.js";
import { sendEmail } from "../../config/nodemailer.js";
import { ledgerService } from "../ledger/ledger.service.js";
import { createCam } from "./cam/cam.service.js";
import { createSd } from "./securityDeposits/sd.service.js";
const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR);
export const createTenant = async (req, res) => {
  const {
    reminderDay,
    lastDay,
    npMonth,
    npYear,
    nepaliDate,

    englishMonth,
    englishYear,

    englishDueDate,
  } = getNepaliMonthDates();
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Handle unitNumber to units conversion for backward compatibility
    if (req.body.unitNumber && !req.body.units) {
      req.body.units = [req.body.unitNumber];
    }

    await tenantValidation.validate(req.body, { abortEarly: false });

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one document is required",
      });
    }

    const saveTempFile = (file) => {
      const tempPath = path.join(TEMP_UPLOAD_DIR, file.originalname);
      fs.writeFileSync(tempPath, file.buffer);
      return tempPath;
    };

    const documents = [];

    for (const field in req.files) {
      const uploadedFiles = Array.isArray(req.files[field])
        ? req.files[field]
        : [req.files[field]];

      const filesArr = [];

      for (const file of uploadedFiles) {
        const tempPath = saveTempFile(file);

        // Check both mimetype and file extension for PDF detection
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const isPdf =
          fileExtension === ".pdf" ||
          file.mimetype === "application/pdf" ||
          file.mimetype === "application/x-pdf";

        const uploadOptions = isPdf
          ? {
              folder: "tenants/pdfs",
              resource_type: "raw",
              use_filename: true,
              unique_filename: false,
              overwrite: true,
            }
          : {
              folder: "tenants/images",
              transformation: [{ width: 1000, height: 1000, crop: "limit" }],
              use_filename: true,
              unique_filename: false,
              overwrite: true,
            };

        const result = await cloudinary.uploader.upload(
          tempPath,
          uploadOptions
        );

        fs.unlinkSync(tempPath);

        filesArr.push({ url: result.secure_url });
      }

      documents.push({
        type: field,
        files: filesArr,
      });
    }


    let unitIds = [];
    if (req.body.units && Array.isArray(req.body.units)) {
      unitIds = req.body.units.map((unitId) => {
        if (mongoose.Types.ObjectId.isValid(unitId)) {
          return new mongoose.Types.ObjectId(unitId);
        }
        throw new Error(`Invalid unit ID: ${unitId}`);
      });
    } else if (req.body.units) {
      // Handle single unit as string
      if (mongoose.Types.ObjectId.isValid(req.body.units)) {
        unitIds = [new mongoose.Types.ObjectId(req.body.units)];
      } else {
        throw new Error(`Invalid unit ID: ${req.body.units}`);
      }
    } else {
      throw new Error("Units are required");
    }

    // Verify units exist and are not already occupied
    console.log(unitIds);
    const units = await Unit.find({ _id: { $in: unitIds } }).session(session);
    if (units.length !== unitIds.length) {
      throw new Error("One or more units not found");
    }

    // Check if any unit is already occupied
    const occupiedUnits = units.filter((unit) => unit.isOccupied);
    if (occupiedUnits.length > 0) {
      throw new Error(
        `One or more units are already occupied: ${occupiedUnits
          .map((u) => u.name)
          .join(", ")}`
      );
    }

    const tenant = await Tenant.create(
      [
        {
          ...req.body,
          units: unitIds,
          documents,
          cam: {
            ratePerSqft: req.body.camRatePerSqft,
          },
          isDeleted: false,
        },
      ],
      { session }
    );

    // Mark units as occupied
    await Unit.updateMany(
      { _id: { $in: unitIds } },
      { $set: { isOccupied: true } },
      { session }
    );

 const rent = await Rent.create(
      [
        {
          tenant: tenant[0]._id,
          month: englishMonth,
          year: englishYear,
          innerBlock: tenant[0].innerBlock,
          block: tenant[0].block,
          property: tenant[0].property,
          rentAmount: tenant[0].totalRent,
          status: "pending",
          createdBy: req.admin.id,
          units: tenant[0].units,
          englishMonth: englishMonth,
          englishYear: englishYear,
          nepaliMonth: npMonth,
          nepaliYear: npYear,
          nepaliDate: nepaliDate,
          nepaliDueDate: lastDay,
          englishDueDate: englishDueDate,
          dueDate: reminderDay,
          lastPaidDate: null,
          lastPaidBy: null,
          lateFee: 0,
          lateFeeDate: null,
          lateFeeApplied: false,
          lateFeeStatus: "pending",
        },
      ],
      { session }
    );
  
    await ledgerService.recordRentCharge(rent[0]._id, session);
const cam = await createCam({
  tenant: tenant[0]._id,
  property: tenant[0].property,
  block: tenant[0].block,
  innerBlock: tenant[0].innerBlock,
  nepaliMonth: npMonth,
  nepaliYear: npYear,
  nepaliDate: nepaliDate,
  amount: tenant[0].camCharges,
  status: "pending",
  paidDate: null,
  notes: "",
  year: englishYear,
  month: englishMonth,
}, req.admin.id, session
);
if (!cam.success) {
  await session.abortTransaction();
  session.endSession();
  return res.status(500).json({
    success: false,
    message: cam.message,
  });
}
    const sd = await createSd({
      tenant: tenant[0]._id,
      property: tenant[0].property,
      block: tenant[0].block,
      innerBlock: tenant[0].innerBlock,
      amount: tenant[0].securityDeposit,
      status: "paid",
      paidDate: new Date(),
      notes: "",
      year: englishYear,
      month: englishMonth,
      nepaliMonth: npMonth,
      nepaliYear: npYear,
      nepaliDate: nepaliDate,
    }, req.admin.id, session);
    if (!sd.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({
        success: false,
        message: sd.message,
      });
    }
 
    await session.commitTransaction();
    session.endSession();

    // Send welcome email after transaction commits (non-blocking)
    if (tenant[0].email) {
      sendEmail({
        to: tenant[0].email,
        subject: "Welcome to our property management system",
        html: `Welcome to our property management system.
    You will receive a notification via this email for any updates regarding your units.`,
      })
        .then(() => {
          console.log(`Welcome email sent successfully to ${tenant[0].email}`);
        })
        .catch((emailError) => {
          console.error(
            `Failed to send welcome email to ${tenant[0].email}:`,
            emailError.message
          );
          // Don't fail the request if email fails
        });
    }

    res.status(201).json({
      success: true,
      message: "Tenant and initial rent created successfully",
      tenant: tenant[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("Tenant creation error:", error);
    res.status(500).json({
      success: false,
      message: "Tenant creation failed",
      error: error.message,
    });
  }
};

export const getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({ isDeleted: false })
      .populate({
        path: "property",
        match: { isDeleted: { $ne: true } }
      })
      .populate({
        path: "block",
        match: { isDeleted: { $ne: true } }
      })
      .populate({
        path: "innerBlock",
        match: { isDeleted: { $ne: true } }
      })
      .populate({
        path: "units",
        match: { isDeleted: { $ne: true } }
      })

    
    // Filter out tenants where all units are null (deleted)
    const validTenants = tenants.filter(tenant => {
      // If units array exists and has at least one valid unit, keep the tenant
      if (tenant.units && Array.isArray(tenant.units) && tenant.units.length > 0) {
        const validUnits = tenant.units.filter(unit => unit !== null);
        if (validUnits.length > 0) {
          tenant.units = validUnits; // Replace with filtered units
          return true;
        }
      }
      // If no units or all units are null, still keep tenant but ensure units is empty array
      if (!tenant.units || tenant.units.length === 0) {
        tenant.units = [];
      }
      return true; // Keep tenant even if units are missing
    });
    
    res.status(200).json({ success: true, tenants: validTenants });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching tenants",
      error: error,
    });
  }
};
export const getTenantById = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id)
      .populate("property")
      .populate("block")
      .populate("innerBlock")
      .populate("units");

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }

    // Filter out null units
    if (tenant.units && Array.isArray(tenant.units)) {
      tenant.units = tenant.units.filter(unit => unit !== null && unit !== undefined);
    } else {
      tenant.units = [];
    }

    res.status(200).json({ success: true, tenant });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error fetching tenant",
      error: error.message,
    });
  }
};
export const updateTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;

    const existingTenant = await Tenant.findById(tenantId);
    if (!existingTenant) {
      return res.status(404).json({
        success: false,
        message: "Tenant not found",
      });
    }

    const updatedTenantData = {};

    /* ---------- BODY FIELDS ---------- */
    Object.keys(req.body).forEach((key) => {
      if (req.body[key] !== undefined && req.body[key] !== "") {
        updatedTenantData[key] = req.body[key];
      }
    });

    // Helper
    const saveTempFile = (file) => {
      const tempPath = path.join(TEMP_UPLOAD_DIR, file.originalname);
      fs.writeFileSync(tempPath, file.buffer);
      return tempPath;
    };

    /* ---------- IMAGE ---------- */
    if (req.files?.image?.[0]) {
      const imageTempPath = saveTempFile(req.files.image[0]);

      const imageResult = await cloudinary.uploader.upload(imageTempPath, {
        folder: "tenants/images",
        transformation: [{ width: 1000, height: 1000, crop: "limit" }],
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      });

      fs.unlinkSync(imageTempPath);
      updatedTenantData.image = imageResult.secure_url;
    }

    /* ---------- PDF ---------- */
    if (req.files?.pdfAgreement?.[0]) {
      const pdfTempPath = saveTempFile(req.files.pdfAgreement[0]);

      const pdfResult = await cloudinary.uploader.upload(pdfTempPath, {
        folder: "tenants/documents",
        resource_type: "raw",
        use_filename: true,
        unique_filename: false,
        overwrite: true,
      });
      console.log(
        req.files.pdfAgreement[0].originalname,
        req.files.pdfAgreement[0].mimetype
      );

      fs.unlinkSync(pdfTempPath);
      updatedTenantData.pdfAgreement = pdfResult.secure_url;
    }

    if (Object.keys(updatedTenantData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: updatedTenantData },
      { new: true }
    )
      .populate("property")
      .populate("block")
      .populate("innerBlock");
    const updatedUnits = await Unit.updateMany(
      { _id: { $in: updatedTenant.units } },
      { $set: { isOccupied: true } }
    );
    if (!updatedUnits) {
      return res.status(400).json({
        success: false,
        message: "Failed to update units",
      });
    }

    res.status(200).json({
      success: true,
      message: "Tenant updated successfully",
      tenant: updatedTenant,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error updating tenant",
      error: error.message,
    });
  }
};
export const deleteTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;
    const softDeletedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { isDeleted: true },
      { new: true }
    );
    await Unit.updateMany(
      { _id: { $in: softDeletedTenant.units } },
      { $set: { isOccupied: false } }
    );
    if (!softDeletedTenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }
    res.status(200).json({
      success: true,
      message: "Tenant deleted successfully",
      tenant: softDeletedTenant,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error deleting tenant",
      error: error.message,
    });
  }
};
export const restoreTenant = async (req, res) => {
  try {
    const tenantId = req.params.id;
    const restoredTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { isDeleted: false },
      { new: true }
    );
    if (!restoredTenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
    }
    res.status(200).json({
      success: true,
      message: "Tenant restored successfully",
      tenant: restoredTenant,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error restoring tenant",
      error: error.message,
    });
  }
};
export const searchTenants = async (req, res) => {
  try {
    const { search, property, block, innerBlock } = req.query;
    const filters = { isDeleted: false };
    if (property) {
      filters.property = property;
    }
    if (block) {
      filters.block = block;
    }
    if (innerBlock) {
      filters.innerBlock = innerBlock;
    }
    if (search) {
      filters.name = { $regex: search, $options: "i" };
    }
    const tenants = await Tenant.find(filters)
      .populate("property")
      .populate("block")
      .populate("innerBlock")
      .populate("units");
    
    // Filter out null values from populated fields
    const validTenants = tenants.map(tenant => {
      // Filter out null units
      if (tenant.units && Array.isArray(tenant.units)) {
        tenant.units = tenant.units.filter(unit => unit !== null && unit !== undefined);
      } else {
        tenant.units = [];
      }
      return tenant;
    });
    
    res.status(200).json({ success: true, tenants: validTenants });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error searching tenants",
      error: error.message,
    });
  }
};
