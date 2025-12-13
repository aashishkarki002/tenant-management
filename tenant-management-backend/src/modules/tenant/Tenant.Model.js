import mongoose from "mongoose";
const tenantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
 dateOfAgreementSigned: { type: Date, required: true },
 leaseStartDate: { type: Date, required: true },
 leaseEndDate: { type: Date, required: true },
 keyHandoverDate: { type: Date, required: true },
 spacehandedOverDate: { type: Date, required: true },
 spacereturnedDate: { type: Date, required: true },
 property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
 block: { type: mongoose.Schema.Types.ObjectId, ref: "Block", required: true },
 innerBlock: { type: mongoose.Schema.Types.ObjectId, ref: "InnerBlock", required: true },
});

export default mongoose.model("Tenant", tenantSchema);