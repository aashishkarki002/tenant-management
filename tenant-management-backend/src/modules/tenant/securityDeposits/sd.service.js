import { Sd } from "./sd.model.js";
import { ledgerService } from "../../ledger/ledger.service.js";
async function createSd(sdData, createdBy, session = null) {
    try {
        const sd = await Sd.create([sdData], session ? { session } : {});
        await ledgerService.recordSecurityDeposit(sd[0]._id, createdBy, session);
        
        return {
            success: true,
            message: "Sd created successfully",
            data: sd[0],
        };
    } catch (error) {
        console.error("Failed to create sd:", error);
        return {
            success: false,
            message: "Failed to create sd",
            error: error.message,
        };
    }
}
export { createSd };