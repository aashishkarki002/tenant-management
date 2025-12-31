import * as yup from "yup";

const tenantValidation = yup.object().shape({
  name: yup.string().required("Name is required"),
  email: yup.string().email("Invalid email").required("Email is required"),
  phone: yup.string().required("Phone is required"),
  address: yup.string().required("Address is required"),
  dateOfAgreementSigned: yup
    .mixed()
    .test("is-date", "Date of agreement signed is required", (value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .transform((value) => (value ? new Date(value) : null))
    .required("Date of agreement signed is required"),
  leaseStartDate: yup
    .mixed()
    .test("is-date", "Lease start date is required", (value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .transform((value) => (value ? new Date(value) : null))
    .required("Lease start date is required"),
  leaseEndDate: yup
    .mixed()
    .test("is-date", "Lease end date is required", (value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .transform((value) => (value ? new Date(value) : null))
    .required("Lease end date is required"),
  keyHandoverDate: yup
    .mixed()
    .test("is-date", "Key handover date is required", (value) => {
      if (!value) return false;
      const date = new Date(value);
      return !isNaN(date.getTime());
    })
    .transform((value) => (value ? new Date(value) : null))
    .required("Key handover date is required"),
  spaceHandoverDate: yup
    .mixed()
    .nullable()
    .transform((value) => (value && value !== "" ? new Date(value) : null)),
  spaceReturnedDate: yup
    .mixed()
    .nullable()
    .transform((value) => (value && value !== "" ? new Date(value) : null)),
  property: yup.string().required("Property is required"),
  block: yup.string().required("Block is required"),
  innerBlock: yup.string().required("Inner block is required"),
  leasedSquareFeet: yup
    .mixed()
    .test("is-number", "Leased square feet must be a number", (value) => {
      if (value === null || value === undefined || value === "") return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    })
    .transform((value) =>
      value !== null && value !== undefined && value !== ""
        ? Number(value)
        : null
    )
    .required("Size square feet is required"),
  unitNumber: yup.string().optional(),
  securityDeposit: yup
    .mixed()
    .test("is-number", "Security deposit must be a number", (value) => {
      if (value === null || value === undefined || value === "") return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    })
    .transform((value) =>
      value !== null && value !== undefined && value !== ""
        ? Number(value)
        : null
    )
    .required("Security deposit is required"),
  pricePerSqft: yup
    .mixed()
    .test("is-number", "Price per square feet must be a number", (value) => {
      if (value === null || value === undefined || value === "") return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    })
    .transform((value) =>
      value !== null && value !== undefined && value !== ""
        ? Number(value)
        : null
    )
    .required("Price per square feet is required"),
  camRatePerSqft: yup
    .mixed()
    .test("is-number", "CAM rate per square feet must be a number", (value) => {
      if (value === null || value === undefined || value === "") return false;
      const num = Number(value);
      return !isNaN(num) && isFinite(num);
    })
    .transform((value) =>
      value !== null && value !== undefined && value !== ""
        ? Number(value)
        : null
    )
    .required("CAM rate per square feet is required"),
  units: yup
    .array()
    .of(yup.string().required("Unit ID is required"))
    .min(1, "At least one unit is required")
    .required("Units are required"),
});
export default tenantValidation;
