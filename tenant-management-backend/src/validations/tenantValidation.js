import * as yup from "yup";

 const tenantValidation = yup.object().shape({
    name: yup.string().required("Name is required"),
    email: yup.string().email("Invalid email").required("Email is required"),
    phone: yup.string().required("Phone is required"),
    address: yup.string().required("Address is required"),
    dateOfAgreementSigned: yup.date().required("Date of agreement signed is required"),
    leaseStartDate: yup.date().required("Lease start date is required"),
    leaseEndDate: yup.date().required("Lease end date is required"),
    keyHandoverDate: yup.date().required("Key handover date is required"),
    spacehandedOverDate: yup.date().required("Space handed over date is required"),
    spacereturnedDate: yup.date().required("Space returned date is required"),
    property: yup.string().required("Property is required"),
    block: yup.string().required("Block is required"),
    innerBlock: yup.string().required("Inner block is required"),
    leasedSquareFeet: yup.number().required("Size square feet is required"),
    unitNumber: yup.string().required("Unit number is required"),
});
export default tenantValidation;