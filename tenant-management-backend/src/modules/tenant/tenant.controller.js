import Tenant from "./Tenant.Model.js";
import middleware from "../../middleware/auth.middleware.js";
export default async function createTenant(req, res) {
    middleware(req, res, async () => {
    try {
        const { name, email, phone, address, dateOfAgreementSigned, leaseStartDate, leaseEndDate, keyHandoverDate, spacehandedOverDate, spacereturnedDate, property, block, innerBlock } = req.body;
        const tenant = await Tenant.create({ name, email, phone, address, dateOfAgreementSigned, leaseStartDate, leaseEndDate, keyHandoverDate, spacehandedOverDate, spacereturnedDate, property, block, innerBlock });
        res.status(201).json({ success: true, message: "Tenant created successfully", tenant });
    } catch (error) {
            console.log(error);
            res.status(500).json({ success: false, message: "Tenant creation failed", error: error });
        }
    });
}