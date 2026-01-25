import { Electricity } from "./Electricity.Model.js";
export const createElectricity = async (electricityData) => {
    try {
        const electricity = await Electricity.create(electricityData);
        return electricity;
    } catch (error) {
        throw new Error(error.message || "Failed to create electricity record");
    }
}
export const getElectricity = async (id) => {
    const electricity = await Electricity.findById(id);
    return electricity;
}
export const getAllElectricity = async () => {
    try {
        const electricity = await Electricity.find().populate("tenant").populate("unit").populate("property").populate("block");
        return {
            success: true,
            message: "Electricity records fetched successfully",
            data: electricity,
        };
    } catch (error) {
        throw new Error(error.message || "Failed to get all electricity records");
    }
    
}

export const updateElectricity = async (id, electricityData) => {
    const electricity = await Electricity.findByIdAndUpdate(id, electricityData, { new: true });
    return electricity;
}