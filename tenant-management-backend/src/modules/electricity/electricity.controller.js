import fs from "fs";
import path from "path";
import cloudinary from "../../config/cloudinary.js";
import { createElectricity as createElectricityService } from "./electricity.service.js";
import { getAllElectricity as getAllElectricityService } from "./electricity.service.js";

const TEMP_UPLOAD_DIR = path.join(process.cwd(), "tmp");
if (!fs.existsSync(TEMP_UPLOAD_DIR)) fs.mkdirSync(TEMP_UPLOAD_DIR);

export const createElectricity = async (req, res) => {
    try {
        const { 
             tenant,
            unit,
            property,
            block,
            previousUnit, 
            currentUnit, 
            ratePerUnit, 
            
            nepaliMonth, 
            nepaliYear, 
            nepaliDate, 
            billMedia, 
            status, 
            createdBy 
        } = req.body;
        
        // Calculate consumedUnit and amount based on the rate
        const consumedUnit = currentUnit - previousUnit;
        if (consumedUnit < 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Current unit cannot be less than previous unit" 
            });
        }
        
        const calculatedAmount = consumedUnit * ratePerUnit;
        
        const electricityData = {
            tenant: tenant,
            unit: unit,
            property: property,
            block: block,
            previousUnit,
            currentUnit,
            consumedUnit,
            ratePerUnit,
            amount: calculatedAmount,
            nepaliMonth,
            nepaliYear,
            nepaliDate,
            status,
            createdBy
        };

        // Handle file upload if present
        if (req.file) {
            try {
                // Save buffer to temporary file
                const tempPath = path.join(TEMP_UPLOAD_DIR, req.file.originalname);
                fs.writeFileSync(tempPath, req.file.buffer);

                // Check if file is PDF or image
                const fileExtension = path.extname(req.file.originalname).toLowerCase();
                const isPdf =
                    fileExtension === ".pdf" ||
                    req.file.mimetype === "application/pdf" ||
                    req.file.mimetype === "application/x-pdf";

                // Upload to Cloudinary
                const uploadOptions = isPdf
                    ? {
                        folder: "electricity/bills",
                        resource_type: "raw",
                        use_filename: true,
                        unique_filename: false,
                        overwrite: true,
                    }
                    : {
                        folder: "electricity/bills",
                        transformation: [{ width: 1000, height: 1000, crop: "limit" }],
                        use_filename: true,
                        unique_filename: false,
                        overwrite: true,
                    };

                const result = await cloudinary.uploader.upload(tempPath, uploadOptions);

                // Delete temporary file
                fs.unlinkSync(tempPath);

                // Set billMedia with Cloudinary result
                electricityData.billMedia = {
                    url: result.secure_url,
                    publicId: result.public_id,
                    generatedAt: new Date(),
                };
            } catch (uploadError) {
                // Clean up temp file if it exists
                const tempPath = path.join(TEMP_UPLOAD_DIR, req.file.originalname);
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
                return res.status(400).json({
                    success: false,
                    message: "Failed to upload file: " + uploadError.message,
                });
            }
        }

        const electricity = await createElectricityService(electricityData);
        res.status(201).json({ success: true, electricity });
    } catch (error) {
        // Handle Mongoose validation errors
        let errorMessage = error.message || "Failed to create electricity record";
        
        // If it's a Mongoose validation error, extract the first error message
        if (error.name === "ValidationError") {
            const firstError = Object.values(error.errors)[0];
            errorMessage = firstError?.message || errorMessage;
        }
        
        res.status(500).json({ success: false, message: errorMessage });
    }
}
export const getAllElectricity = async (req, res) => {
    try {
        const electricity = await getAllElectricityService();
        res.status(200).json({ success: true, electricity });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
}