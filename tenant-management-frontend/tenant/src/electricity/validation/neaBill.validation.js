import * as Yup from "yup";

export const neaBillValidationSchema = Yup.object({
  periodKey: Yup.string().required("Billing period is required"),

  totalAmount: Yup.number()
    .typeError("Enter a valid amount")
    .positive("Amount must be greater than 0")
    .required("Total amount is required"),

  totalUnits: Yup.number()
    .nullable()
    .transform((_, val) => (val === "" ? null : Number(val))),

  demandCharge: Yup.number()
    .nullable()
    .transform((_, val) => (val === "" ? null : Number(val))),

  energyCharge: Yup.number()
    .nullable()
    .transform((_, val) => (val === "" ? null : Number(val))),
});
