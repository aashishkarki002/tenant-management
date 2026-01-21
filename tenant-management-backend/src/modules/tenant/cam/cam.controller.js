import { createCam } from "./cam.service.js";
export const createCamController = async (req, res) => {
    try {
        const cam = await createCam(req.body, req.admin?.id, null);
        res.status(201).json({ success: true, message: "Cam created successfully", cam });
    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: "Cam creation failed", error: error });
    }
}
export { createCamController };