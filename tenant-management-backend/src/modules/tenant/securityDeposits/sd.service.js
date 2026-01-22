import { Sd } from "./sd.model.js";
import { ledgerService } from "../../ledger/ledger.service.js";
import { createLiability } from "../.././liabilities/liabilty.service.js";
async function createSd(sdData, createdBy, session = null) {
    try {
        const sd = await Sd.create([sdData], session ? { session } : {});
        await ledgerService.recordSecurityDeposit(sd[0]._id, createdBy, session);

        await createLiability({
            source: "SECURITY_DEPOSIT",
            amount: sd[0].amount,
            date: sd[0].paidDate,
            payeeType: "TENANT",
            tenant: sd[0].tenant,
            referenceType: "SECURITY_DEPOSIT",
            referenceId: sd[0]._id,
            createdBy: createdBy,
        });
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