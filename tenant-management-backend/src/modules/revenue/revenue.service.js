import { Revenue } from "./Revenue.Model.js";
import { RevenueSource } from "./RevenueSource.Model.js";
import { Tenant } from "../tenant/Tenant.Model.js";
import Admin from "../auth/admin.Model.js";
 async function createRevenue(revenueData) {
    try {
        const { source, amount, date, payerType, tenant, referenceType, referenceId, status, notes, createdBy ,adminId } = revenueData;
        const revenueSource = await RevenueSource.findById(source);
        if (!revenueSource) {
            throw new Error("Revenue source not found");
        }
    
        const existingAdmin = await Admin.findById(createdBy);
        if (!existingAdmin) {
            throw new Error("Admin not found");
        }
        const revenue = await Revenue.create({ source, amount, date, payerType, tenant, referenceType, referenceId, status, notes, createdBy });
        return {
            success: true,
            message: "Revenue created successfully",
            data: revenue,
        };
    } catch (error) {
        console.error("Failed to create revenue:", error);
        return {
            success: false,
            message: "Failed to create revenue",
            error: error.message,
        };
    }
}
export { createRevenue };
async function getRevenue(revenueId) {
    try {
        const revenue = await Revenue.findById(revenueId).populate("source").populate("tenant").populate("createdBy");
        if (!revenue) {
            throw new Error("Revenue not found");
        }
        return revenue;
    } catch (error) {
        console.error("Failed to get revenue:", error);
        throw error;
    }
}
export { getRevenue };

async function getAllRevenue() {
    try {
        const revenue = await Revenue.find()
        return {
            success: true,
            message: "Revenue fetched successfully",
            data: revenue,
        };
    } catch (error) {
        console.error("Failed to get all revenue:", error);
        return {
            success: false,
            message: "Failed to get all revenue",
            error: error.message,
        };
    }
}
export { getAllRevenue };