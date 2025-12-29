import * as yup from "yup";

// Helper function to transform date strings to Date objects
const transformDate = (value, originalValue) => {
  if (originalValue === "" || originalValue == null) return undefined;
  const date = new Date(originalValue);
  return isNaN(date.getTime()) ? undefined : date;
};

// Helper function to transform number strings to numbers
const transformNumber = (value, originalValue) => {
  if (originalValue === "" || originalValue == null) return undefined;
  const num = parseFloat(originalValue);
  return isNaN(num) ? undefined : num;
};

const tenantValidation = yup.object().shape({
    name: yup.string().required("Name is required"),
    email: yup.string().email("Invalid email").required("Email is required"),
    phone: yup.string().required("Phone is required"),
    address: yup.string().required("Address is required"),
    dateOfAgreementSigned: yup
      .date()
      .transform(transformDate)
      .typeError("Date of agreement signed must be a valid date")
      .required("Date of agreement signed is required"),
    leaseStartDate: yup
      .date()
      .transform(transformDate)
      .typeError("Lease start date must be a valid date")
      .required("Lease start date is required"),
    leaseEndDate: yup
      .date()
      .transform(transformDate)
      .typeError("Lease end date must be a valid date")
      .required("Lease end date is required"),
    keyHandoverDate: yup
      .date()
      .transform(transformDate)
      .typeError("Key handover date must be a valid date")
      .required("Key handover date is required"),
    spacehandedOverDate: yup
      .date()
      .transform(transformDate)
      .typeError("Space handed over date must be a valid date")
      .required("Space handed over date is required"),
    spacereturnedDate: yup
      .date()
      .transform(transformDate)
      .typeError("Space returned date must be a valid date")
      .required("Space returned date is required"),
    property: yup.string().required("Property is required"),
    block: yup.string().required("Block is required"),
    innerBlock: yup.string().required("Inner block is required"),
    leasedSquareFeet: yup
      .number()
      .transform(transformNumber)
      .typeError("Size square feet must be a valid number")
      .required("Size square feet is required"),
    unitNumber: yup.string().required("Unit number is required"),
});
export default tenantValidation;