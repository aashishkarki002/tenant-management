import fs from "fs";
import path from "path";
import Tenant from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import cloudinary from "../../config/cloudinary.js";
// Temporary folder to save uploads
const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR);

export const createTenant = async (req, res) => {
  try {
    // 1️⃣ Validate form fields

    await tenantValidation.validate(req.body, { abortEarly: false });

    // 2️⃣ Validate required files
    if (!req.files || !req.files.image || !req.files.image[0]) {
      return res
        .status(400)
        .json({ success: false, message: "Image file is required" });
    }

    const pdfFile = req.files?.pdfAgreement?.[0] || null;
    if (!pdfFile) {
      return res
        .status(400)
        .json({ success: false, message: "PDF agreement file is required" });
    }

    // Helper: save file buffer to temp path
    const saveTempFile = (file) => {
      const tempPath = path.join(TEMP_UPLOAD_DIR, file.originalname);
      fs.writeFileSync(tempPath, file.buffer);
      return tempPath;
    };

    const imageTempPath = saveTempFile(req.files.image[0]);
    const pdfTempPath = saveTempFile(pdfFile);

    const imageResult = await cloudinary.uploader.upload(imageTempPath, {
      folder: "tenants/images",
      transformation: [{ width: 1000, height: 1000, crop: "limit" }],
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    const pdfResult = await cloudinary.uploader.upload(pdfTempPath, {
      folder: "tenants/documents",
      resource_type: "raw",
      use_filename: true,
      unique_filename: false,
      overwrite: true,
    });

    // 4️⃣ Remove temporary files
    fs.unlinkSync(imageTempPath);
    fs.unlinkSync(pdfTempPath);

    // 5️⃣ Create tenant in DB
    const tenant = await Tenant.create({
      ...req.body,
      image: imageResult.secure_url,
      pdfAgreement: pdfResult.secure_url,
    });

    // 6️⃣ Respond to client
    res.status(201).json({
      success: true,
      message: "Tenant created successfully",
      tenant,
      urls: {
        imageUrl: imageResult.secure_url,
        pdfUrl: pdfResult.secure_url,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      res.status(400).json({ success: false, errors: error.errors });
    } else {
      res.status(500).json({
        success: false,
        message: "Tenant creation failed",
        error: error.message,
      });
    }
  }
};

export const getTenants = async (req, res) => {
  try {
    const tenants = await Tenant.find({ isDeleted: false })
      .populate("property")
      .populate("block")
      .populate("innerBlock");
    res.status(200).json({ success: true, tenants });
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
      .populate("innerBlock");

    if (!tenant) {
      return res
        .status(404)
        .json({ success: false, message: "Tenant not found" });
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
      .populate("innerBlock");
    res.status(200).json({ success: true, tenants });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      success: false,
      message: "Error searching tenants",
      error: error.message,
    });
  }
};
