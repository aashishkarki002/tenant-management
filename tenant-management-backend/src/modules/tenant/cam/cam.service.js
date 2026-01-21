import { Cam } from "./cam.model.js";
import { ledgerService } from "../../ledger/ledger.service.js";
async function createCam(camData, createdBy, session = null) {
    try {
        const cam = await Cam.create(
            [camData],
            session ? { session } : {}
          );
        await ledgerService.recordCamCharge(cam[0]._id, createdBy, session);
        return {
            success: true,
            message: "Cam created successfully",
            data: cam[0],
        };
    } catch (error) {
        console.error("Failed to create cam:", error);
        return {
            success: false,
            message: "Failed to create cam",
            error: error.message,
        };
    }
}
export { createCam };