import mongoose from "mongoose";
import { Tenant } from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import { Unit } from "../units/Unit.Model.js";
import { sendWelcomeEmail } from "../../config/nodemailer.js";
import { createTenantTransaction } from "./services/tenant.create.js";
import { uploadSingleFile } from "./helpers/fileUploadHelper.js"; // ✅ NEW: Direct upload

export async function createTenant(body, files, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (body.unitNumber && !body.units) {
      console.log("body.unitNumber", body.unitNumber);
      body.units = [body.unitNumber];
    }

    await tenantValidation.validate(body, { abortEarly: false });

    const documentFields = [
      "image",
      "pdfAgreement",
      "citizenShip",
      "company_docs",
      "tax_certificate",
      "bank_guarantee",
      "cheque",
      "other",
    ];

    const hasDocuments =
      files &&
      documentFields.some(
        (field) =>
          files[field] &&
          (Array.isArray(files[field]) ? files[field].length > 0 : true),
      );

    if (!hasDocuments) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "Tenant documents are required",
      };
    }

    const tenant = await createTenantTransaction(body, files, adminId, session);

    await session.commitTransaction();
    session.endSession();

    if (tenant.email) {
      sendWelcomeEmail({
        to: tenant.email,
        tenantName: tenant.name,
      })
        .then(() =>
          console.log(`Welcome email sent successfully to ${tenant.email}`),
        )
        .catch((emailError) =>
          console.error(
            `Failed to send welcome email to ${tenant.email}:`,
            emailError.message,
          ),
        );
    }

    return {
      success: true,
      statusCode: 201,
      message: "Tenant and initial rent created successfully",
      tenant,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Tenant creation error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Tenant creation failed",
      error: error.message,
    };
  }
}

export async function getTenants() {
  // Fetch tenants with populated relations
  const tenants = await Tenant.find({ isDeleted: false })
    .populate({
      path: "property",
      match: { isDeleted: { $ne: true } },
      select: "name address",
    })
    .populate({
      path: "block",
      match: { isDeleted: { $ne: true } },
      select: "name",
    })
    .populate({
      path: "innerBlock",
      match: { isDeleted: { $ne: true } },
      select: "name",
    })
    .populate({
      path: "units",
      match: { isDeleted: { $ne: true } },
      select: "unitNumber sqft price",
    });

  // Filter out tenants with no valid units
  const validTenants = tenants.filter(
    (tenant) => Array.isArray(tenant.units) && tenant.units.length > 0,
  );

  // Convert to JSON so virtuals are applied
  return validTenants.map((tenant) => tenant.toJSON());
}

export async function getTenantById(id) {
  const tenant = await Tenant.findById(id)
    .populate("property")
    .populate("block")
    .populate("innerBlock")
    .populate("units");

  if (!tenant) return null;

  if (tenant.units && Array.isArray(tenant.units)) {
    tenant.units = tenant.units.filter((u) => u !== null && u !== undefined);
  } else {
    tenant.units = [];
  }

  return tenant;
}

export async function updateTenant(tenantId, body, files) {
  const existingTenant = await Tenant.findById(tenantId);
  if (!existingTenant) {
    return { success: false, statusCode: 404, message: "Tenant not found" };
  }

  const updatedTenantData = {};
  Object.keys(body).forEach((key) => {
    if (body[key] !== undefined && body[key] !== "") {
      updatedTenantData[key] = body[key];
    }
  });

  // ✨ OPTIMIZED: Image upload (no disk I/O)
  if (files?.image?.[0]) {
    try {
      const imageResult = await uploadSingleFile(files.image[0], {
        folder: "tenants/images", // ✅ Folder specified
        imageTransform: [{ width: 1000, height: 1000, crop: "limit" }],
      });
      updatedTenantData.image = imageResult.url;
    } catch (error) {
      console.error("[updateTenant] Image upload failed:", error);
      return {
        success: false,
        statusCode: 500,
        message: "Image upload failed",
        error: error.message,
      };
    }
  }

  // ✨ OPTIMIZED: PDF upload (no disk I/O)
  if (files?.pdfAgreement?.[0]) {
    try {
      const pdfResult = await uploadSingleFile(files.pdfAgreement[0], {
        folder: "tenants/agreements", // ✅ Specific folder
      });
      updatedTenantData.pdfAgreement = pdfResult.url;
    } catch (error) {
      console.error("[updateTenant] PDF upload failed:", error);
      return {
        success: false,
        statusCode: 500,
        message: "PDF upload failed",
        error: error.message,
      };
    }
  }

  if (Object.keys(updatedTenantData).length === 0) {
    return { success: false, statusCode: 400, message: "No fields to update" };
  }

  const updatedTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { $set: updatedTenantData },
    { new: true },
  )
    .populate("property")
    .populate("block")
    .populate("innerBlock");

  await Unit.updateMany(
    { _id: { $in: updatedTenant.units } },
    { $set: { isOccupied: true } },
  );

  return {
    success: true,
    statusCode: 200,
    message: "Tenant updated successfully",
    tenant: updatedTenant,
  };
}

export async function deleteTenant(tenantId) {
  const softDeletedTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { isDeleted: true },
    { new: true },
  );

  if (!softDeletedTenant) {
    return { success: false, statusCode: 404, message: "Tenant not found" };
  }

  await Unit.updateMany(
    { _id: { $in: softDeletedTenant.units } },
    { $set: { isOccupied: false } },
  );

  return {
    success: true,
    statusCode: 200,
    message: "Tenant deleted successfully",
    tenant: softDeletedTenant,
  };
}

export async function restoreTenant(tenantId) {
  const restoredTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { isDeleted: false },
    { new: true },
  );

  if (!restoredTenant) {
    return { success: false, statusCode: 404, message: "Tenant not found" };
  }

  return {
    success: true,
    statusCode: 200,
    message: "Tenant restored successfully",
    tenant: restoredTenant,
  };
}

export async function searchTenants(query) {
  const { search, property, block, innerBlock } = query;
  const filters = { isDeleted: false };
  if (property) filters.property = property;
  if (block) filters.block = block;
  if (innerBlock) filters.innerBlock = innerBlock;
  if (search) filters.name = { $regex: search, $options: "i" };

  const tenants = await Tenant.find(filters)
    .populate("property")
    .populate("block")
    .populate("innerBlock")
    .populate("units");

  const validTenants = tenants.map((tenant) => {
    if (tenant.units && Array.isArray(tenant.units)) {
      tenant.units = tenant.units.filter((u) => u !== null && u !== undefined);
    } else {
      tenant.units = [];
    }
    return tenant;
  });

  return validTenants;
}
