import mongoose from "mongoose";
import { Tenant } from "./Tenant.Model.js";
import tenantValidation from "../../validations/tenantValidation.js";
import { Unit } from "../units/Unit.Model.js";
import { sendWelcomeEmail } from "../../config/nodemailer.js";
import { createTenantTransaction } from "./services/tenant.create.js";
import { uploadSingleFile } from "./helpers/fileUploadHelper.js";
import { paisaToRupees, rupeesToPaisa } from "../../utils/moneyUtil.js";
import { calculateMultiUnitLease } from "./domain/rent.calculator.service.js";
import { Rent } from "../rents/rent.Model.js";
import { Cam } from "../cam/cam.model.js";

export async function createTenant(body, files, adminId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Handle unitLeases coming as JSON string from FormData
    if (body.unitLeases && typeof body.unitLeases === "string") {
      try {
        const parsed = JSON.parse(body.unitLeases);
        if (Array.isArray(parsed)) {
          body.unitLeases = parsed;
          const unitIds = parsed
            .map((u) => u.unitId)
            .filter((id) => typeof id === "string" && id.trim().length > 0);

          if (unitIds.length > 0) {
            body.units = unitIds;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse unitLeases JSON:", parseError);
      }
    }

    // Handle legacy/unitNumber-based selection
    if (Array.isArray(body.unitNumber) && !body.units) {
      body.units = body.unitNumber;
    } else if (body.unitNumber && !body.units) {
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
      match: { isDeleted: false },
      select: "name address",
    })
    .populate({
      path: "block",
      match: { isDeleted: false },
      select: "name",
    })
    .populate({
      path: "innerBlock",
      match: { isDeleted: false },
      select: "name",
    })
    .populate({
      path: "units",
      match: { isDeleted: false },
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
  try {
    // Find tenant and populate all related entities
    const tenant = await Tenant.findById(id)
      .populate({
        path: "property",
        select: "name description address createdAt updatedAt",
      })
      .populate({
        path: "block",
        select: "name property createdAt updatedAt",
      })
      .populate({
        path: "innerBlock",
        select: "name block property",
      })
      .populate({
        path: "units",
        match: { isDeleted: false },
        select: "-__v",
      });

    if (!tenant) {
      return null;
    }

    // Filter out null/undefined units (in case some were soft deleted)
    if (tenant.units && Array.isArray(tenant.units)) {
      tenant.units = tenant.units.filter((u) => u !== null && u !== undefined);
    } else {
      tenant.units = [];
    }

    // Enhance each unit with currentLease information from the tenant
    if (tenant.units && tenant.units.length > 0) {
      tenant.units = tenant.units.map((unit) => {
        // Build the currentLease object using tenant's lease information
        const currentLease = {
          tenant: tenant._id,
          leaseSquareFeet: tenant.leasedSquareFeet || unit.sqft || 0,
          pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa),
          camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa),
          securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
          leaseStartDate: tenant.leaseStartDate,
          leaseEndDate: tenant.leaseEndDate,
          dateOfAgreementSigned: tenant.dateOfAgreementSigned,
          keyHandoverDate: tenant.keyHandoverDate,
          spaceHandoverDate: tenant.spaceHandoverDate,
          spaceReturnedDate: tenant.spaceReturnedDate,
          status: tenant.status || "active",
          notes: tenant.notes || "",
          tdsPercentage: tenant.tdsPercentage || 10,
          securityDepositStatus: "held", // You may want to add this field to your model

          // Financial calculations - convert from paisa to rupees
          tds: paisaToRupees(tenant.tdsPaisa),
          monthlyRent: paisaToRupees(tenant.totalRentPaisa),
          monthlyCam: paisaToRupees(tenant.camChargesPaisa),
          totalMonthly: paisaToRupees(tenant.monthlyTotalPaisa), // Using virtual
          grossAmount: paisaToRupees(tenant.grossAmountPaisa),
        };

        // Return enhanced unit with currentLease and computed fields
        return {
          ...unit.toObject(), // Convert Mongoose doc to plain object
          currentLease,
          isExpiringSoon: checkLeaseExpiringSoon(tenant.leaseEndDate),
          leaseDurationMonths: calculateLeaseDuration(
            tenant.leaseStartDate,
            tenant.leaseEndDate,
          ),
        };
      });
    }

    // Convert tenant to JSON to include all virtuals
    // The model's toJSON includes virtuals like:
    // - monthlyTotal, quarterlyTotal
    // - All formatted fields (tdsFormatted, grossAmountFormatted, etc.)
    const tenantJson = tenant.toJSON();

    // Add rupee conversions for convenience (in addition to virtuals)
    return {
      ...tenantJson,
      units: tenant.units, // Use the enhanced units array

      // Add rupee versions of paisa fields (for backward compatibility)
      tds: paisaToRupees(tenant.tdsPaisa),
      rentalRate: paisaToRupees(tenant.rentalRatePaisa),
      grossAmount: paisaToRupees(tenant.grossAmountPaisa),
      totalRent: paisaToRupees(tenant.totalRentPaisa),
      camCharges: paisaToRupees(tenant.camChargesPaisa),
      netAmount: paisaToRupees(tenant.netAmountPaisa),
      securityDeposit: paisaToRupees(tenant.securityDepositPaisa),
      quarterlyRentAmount: paisaToRupees(tenant.quarterlyRentAmountPaisa),
      pricePerSqft: paisaToRupees(tenant.pricePerSqftPaisa),
      camRatePerSqft: paisaToRupees(tenant.camRatePerSqftPaisa),

      // Note: Formatted fields are already included via toJSON() virtuals:
      // - tdsFormatted, rentalRateFormatted, grossAmountFormatted
      // - totalRentFormatted, camChargesFormatted, netAmountFormatted
      // - securityDepositFormatted, quarterlyRentAmountFormatted
      // - pricePerSqftFormatted, camRatePerSqftFormatted
      // - monthlyTotal, quarterlyTotal (from virtuals)
    };
  } catch (error) {
    console.error("Error in getTenantById:", error);
    throw error;
  }
}

/**
 * Helper function to check if lease is expiring soon (within 60 days)
 */
function checkLeaseExpiringSoon(leaseEndDate) {
  if (!leaseEndDate) return false;

  const endDate = new Date(leaseEndDate);
  const today = new Date();
  const daysUntilExpiry = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

  return daysUntilExpiry > 0 && daysUntilExpiry <= 60;
}

/**
 * Helper function to calculate lease duration in months
 */
function calculateLeaseDuration(startDate, endDate) {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  const months =
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth());

  return months;
}

function hasFinancialChanges(updates, existingTenant) {
  const financialFields = [
    "leasedSquareFeet",
    "pricePerSqft",
    "pricePerSqftPaisa",
    "camRatePerSqft",
    "camRatePerSqftPaisa",
    "tdsPercentage",
  ];

  return financialFields.some((field) => {
    if (updates[field] !== undefined) {
      // For paisa fields, compare as integers
      if (field.endsWith("Paisa")) {
        return updates[field] !== existingTenant[field];
      }
      // For regular fields, compare with small tolerance for floats
      return (
        Math.abs(Number(updates[field]) - Number(existingTenant[field])) > 0.01
      );
    }
    return false;
  });
}

/**
 * Recalculate tenant financials based on updated values
 */
function recalculateTenantFinancials(tenant, updates) {
  // Get current or updated values
  const sqft = updates.leasedSquareFeet ?? tenant.leasedSquareFeet;
  const pricePerSqft =
    updates.pricePerSqft ?? paisaToRupees(tenant.pricePerSqftPaisa);
  const camRate =
    updates.camRatePerSqft ?? paisaToRupees(tenant.camRatePerSqftPaisa);
  const tdsPercentage = updates.tdsPercentage ?? tenant.tdsPercentage ?? 10;

  // Build unit lease config for calculation
  const unitLeaseConfig = [
    {
      unitId: tenant.units[0]?.toString() || tenant.units[0]?._id?.toString(),
      leasedSquareFeet: sqft,
      pricePerSqft: pricePerSqft,
      camRatePerSqft: camRate,
      securityDeposit:
        updates.securityDeposit ?? paisaToRupees(tenant.securityDepositPaisa),
    },
  ];

  // Calculate using the rent calculator service
  const calculation = calculateMultiUnitLease(unitLeaseConfig, tdsPercentage);
  const totals = calculation.totals;

  // Return updated financial values in PAISA
  return {
    // Store in paisa (integers - source of truth)
    pricePerSqftPaisa: rupeesToPaisa(pricePerSqft),
    camRatePerSqftPaisa: rupeesToPaisa(camRate),
    tdsPaisa: rupeesToPaisa(totals.totalTds),
    rentalRatePaisa: rupeesToPaisa(totals.rentMonthly / sqft), // Net rate per sqft
    grossAmountPaisa: rupeesToPaisa(totals.grossMonthly),
    totalRentPaisa: rupeesToPaisa(totals.rentMonthly),
    camChargesPaisa: rupeesToPaisa(totals.camMonthly),
    netAmountPaisa: rupeesToPaisa(totals.netMonthly),

    // Also store rupee values for backward compatibility
    pricePerSqft: pricePerSqft,
    camRatePerSqft: camRate,
    tdsPercentage: tdsPercentage,
    leasedSquareFeet: sqft,

    // For logging
    _calculationDetails: {
      grossMonthly: totals.grossMonthly,
      totalTds: totals.totalTds,
      rentMonthly: totals.rentMonthly,
      camMonthly: totals.camMonthly,
      netMonthly: totals.netMonthly,
    },
  };
}

/**
 * Update future/pending rent records with new calculations
 */
async function updatePendingRentRecords(tenant, newFinancials, session) {
  console.log("\n🔄 Updating Pending Rent Records...");

  // Find all pending/unpaid rent records for this tenant
  const pendingRents = await Rent.find({
    tenant: tenant._id,
    status: { $in: ["pending", "partial"] }, // Only pending/partial, not paid
  }).session(session);

  console.log(`├─ Found ${pendingRents.length} pending rent record(s)`);

  if (pendingRents.length === 0) {
    console.log("└─ No pending rents to update");
    return { updated: 0 };
  }

  let updatedCount = 0;

  for (const rent of pendingRents) {
    try {
      // Calculate new rent amount based on frequency
      const frequencyMonths = rent.rentFrequency === "quarterly" ? 3 : 1;
      const newMonthlyRent = newFinancials.totalRentPaisa;
      const newRentAmount = newMonthlyRent * frequencyMonths;
      const newTdsAmount = newFinancials.tdsPaisa * frequencyMonths;

      // Only update if amounts actually changed
      if (
        Math.abs(rent.rentAmountPaisa - newRentAmount) > 1 ||
        Math.abs(rent.tdsAmountPaisa - newTdsAmount) > 1
      ) {
        console.log(`\n├─ Updating Rent Record: ${rent._id}`);
        console.log(`│  ├─ Old Rent: ${rent.rentAmountPaisa} paisa`);
        console.log(`│  ├─ New Rent: ${newRentAmount} paisa`);
        console.log(`│  ├─ Old TDS: ${rent.tdsAmountPaisa} paisa`);
        console.log(`│  └─ New TDS: ${newTdsAmount} paisa`);

        // Update the rent record
        rent.rentAmountPaisa = newRentAmount;
        rent.tdsAmountPaisa = newTdsAmount;

        // Update legacy rupee fields for backward compatibility
        rent.rentAmount = paisaToRupees(newRentAmount);
        rent.tdsAmount = paisaToRupees(newTdsAmount);

        // If has unit breakdown, update it too
        if (
          rent.useUnitBreakdown &&
          rent.unitBreakdown &&
          rent.unitBreakdown.length > 0
        ) {
          rent.unitBreakdown = rent.unitBreakdown.map((ub) => ({
            ...ub,
            rentAmountPaisa: newMonthlyRent * frequencyMonths,
            tdsAmountPaisa: newFinancials.tdsPaisa * frequencyMonths,
          }));
        }

        await rent.save({ session });
        updatedCount++;
      }
    } catch (error) {
      console.error(`│  ✗ Failed to update rent ${rent._id}:`, error.message);
      // Continue with other rents even if one fails
    }
  }

  console.log(`└─ Successfully updated ${updatedCount} rent record(s)\n`);
  return { updated: updatedCount };
}

/**
 * Update future/pending CAM records with new calculations
 */
async function updatePendingCAMRecords(tenant, newFinancials, session) {
  console.log("\n🔄 Updating Pending CAM Records...");

  // Find all pending CAM records
  const pendingCAMs = await Cam.find({
    tenant: tenant._id,
    status: { $in: ["pending", "partially_paid"] },
  }).session(session);

  console.log(`├─ Found ${pendingCAMs.length} pending CAM record(s)`);

  if (pendingCAMs.length === 0) {
    console.log("└─ No pending CAMs to update");
    return { updated: 0 };
  }

  let updatedCount = 0;

  for (const cam of pendingCAMs) {
    try {
      const newCamAmount = newFinancials.camChargesPaisa;

      // Only update if amount changed
      if (Math.abs((cam.amountPaisa || 0) - newCamAmount) > 1) {
        console.log(`\n├─ Updating CAM Record: ${cam._id}`);
        console.log(`│  ├─ Old CAM: ${cam.amountPaisa || 0} paisa`);
        console.log(`│  └─ New CAM: ${newCamAmount} paisa`);

        cam.amountPaisa = newCamAmount;
        cam.amount = paisaToRupees(newCamAmount); // Backward compatibility

        await cam.save({ session });
        updatedCount++;
      }
    } catch (error) {
      console.error(`│  ✗ Failed to update CAM ${cam._id}:`, error.message);
    }
  }

  console.log(`└─ Successfully updated ${updatedCount} CAM record(s)\n`);
  return { updated: updatedCount };
}

/**
 * Enhanced update tenant with financial recalculation
 */
export async function updateTenant(tenantId, body, files) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("\n" + "=".repeat(60));
    console.log("📝 UPDATING TENANT");
    console.log("=".repeat(60));

    // 1. Fetch existing tenant
    const existingTenant = await Tenant.findById(tenantId).session(session);
    if (!existingTenant) {
      await session.abortTransaction();
      session.endSession();
      return { success: false, statusCode: 404, message: "Tenant not found" };
    }

    console.log(`\n✓ Found tenant: ${existingTenant.name}`);

    // 2. Build update object
    const updatedTenantData = {};
    Object.keys(body).forEach((key) => {
      if (body[key] !== undefined && body[key] !== "" && body[key] !== null) {
        updatedTenantData[key] = body[key];
      }
    });

    // 3. Handle file uploads
    if (files?.image?.[0]) {
      try {
        const imageResult = await uploadSingleFile(files.image[0], {
          folder: "tenants/images",
          imageTransform: [{ width: 1000, height: 1000, crop: "limit" }],
        });
        updatedTenantData.image = imageResult.url;
      } catch (error) {
        console.error("Image upload failed:", error);
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          statusCode: 500,
          message: "Image upload failed",
          error: error.message,
        };
      }
    }

    if (files?.pdfAgreement?.[0]) {
      try {
        const pdfResult = await uploadSingleFile(files.pdfAgreement[0], {
          folder: "tenants/agreements",
        });
        updatedTenantData.pdfAgreement = pdfResult.url;
      } catch (error) {
        console.error("PDF upload failed:", error);
        await session.abortTransaction();
        session.endSession();
        return {
          success: false,
          statusCode: 500,
          message: "PDF upload failed",
          error: error.message,
        };
      }
    }

    // 4. Check if financial data changed
    const financialsChanged = hasFinancialChanges(
      updatedTenantData,
      existingTenant,
    );

    console.log(
      `\n💰 Financial data changed: ${financialsChanged ? "YES" : "NO"}`,
    );

    let recalculationResult = null;

    // 5. If financials changed, recalculate everything
    if (financialsChanged) {
      console.log("\n🔢 Recalculating Financials...");

      recalculationResult = recalculateTenantFinancials(
        existingTenant,
        updatedTenantData,
      );

      console.log("\n✓ Recalculation Complete:");
      console.log(
        "├─ Monthly Rent (Net):",
        paisaToRupees(recalculationResult.totalRentPaisa),
      );
      console.log(
        "├─ Monthly CAM:",
        paisaToRupees(recalculationResult.camChargesPaisa),
      );
      console.log(
        "├─ Monthly TDS:",
        paisaToRupees(recalculationResult.tdsPaisa),
      );
      console.log(
        "└─ Monthly Total:",
        paisaToRupees(recalculationResult.netAmountPaisa),
      );

      // Merge recalculated financials into update data
      Object.assign(updatedTenantData, recalculationResult);

      // Calculate quarterly amount if tenant uses quarterly frequency
      if (existingTenant.rentPaymentFrequency === "quarterly") {
        const quarterlyRentAmountPaisa = recalculationResult.totalRentPaisa * 3;
        updatedTenantData.quarterlyRentAmountPaisa = quarterlyRentAmountPaisa;
        console.log(
          "\n├─ Quarterly Rent:",
          paisaToRupees(quarterlyRentAmountPaisa),
        );
      }
    }

    // 6. Validation
    if (Object.keys(updatedTenantData).length === 0) {
      await session.abortTransaction();
      session.endSession();
      return {
        success: false,
        statusCode: 400,
        message: "No fields to update",
      };
    }

    // 7. Update the tenant document
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenantId,
      { $set: updatedTenantData },
      { new: true, session },
    )
      .populate("property")
      .populate("block")
      .populate("innerBlock")
      .populate("units");

    console.log("\n✓ Tenant document updated");

    // 8. Update related records if financials changed
    let rentUpdateResult = { updated: 0 };
    let camUpdateResult = { updated: 0 };

    if (financialsChanged && recalculationResult) {
      // Update pending rent records
      rentUpdateResult = await updatePendingRentRecords(
        updatedTenant,
        recalculationResult,
        session,
      );

      // Update pending CAM records
      camUpdateResult = await updatePendingCAMRecords(
        updatedTenant,
        recalculationResult,
        session,
      );
    }

    // 9. Update unit occupancy status if needed
    if (updatedTenantData.units || updatedTenantData.status === "vacated") {
      const shouldBeOccupied = updatedTenantData.status !== "vacated";
      await Unit.updateMany(
        { _id: { $in: updatedTenant.units } },
        { $set: { isOccupied: shouldBeOccupied } },
        { session },
      );
      console.log(
        `\n✓ Unit occupancy updated: ${shouldBeOccupied ? "occupied" : "vacant"}`,
      );
    }

    // 10. Commit transaction
    await session.commitTransaction();
    session.endSession();

    // 11. Build response message
    let message = "Tenant updated successfully";
    if (financialsChanged) {
      message += `. Recalculated financials and updated ${rentUpdateResult.updated} rent record(s) and ${camUpdateResult.updated} CAM record(s).`;
    }

    console.log("\n" + "=".repeat(60));
    console.log("✅ UPDATE COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
    if (financialsChanged) {
      console.log("📊 Summary:");
      console.log(`├─ Rent records updated: ${rentUpdateResult.updated}`);
      console.log(`├─ CAM records updated: ${camUpdateResult.updated}`);
      console.log(
        `└─ New monthly total: ₹${paisaToRupees(recalculationResult.netAmountPaisa).toLocaleString()}`,
      );
    }
    console.log("=".repeat(60) + "\n");

    return {
      success: true,
      statusCode: 200,
      message,
      tenant: updatedTenant,
      recalculation: financialsChanged
        ? {
            rentsUpdated: rentUpdateResult.updated,
            camsUpdated: camUpdateResult.updated,
            newMonthlyRent: paisaToRupees(recalculationResult.totalRentPaisa),
            newMonthlyCam: paisaToRupees(recalculationResult.camChargesPaisa),
            newMonthlyTotal: paisaToRupees(recalculationResult.netAmountPaisa),
          }
        : null,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("\n❌ Tenant update error:", error);
    return {
      success: false,
      statusCode: 500,
      message: "Error updating tenant",
      error: error.message,
    };
  }
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
  if (search) {
    const escaped = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filters.name = new RegExp(escaped, "i");
  }

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
