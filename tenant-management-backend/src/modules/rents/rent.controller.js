import rent from "./Rent.js";
import bankAccount from "./BankAccountModel.js";

export const createRent = async (req, res) => {
  try {
    const {
      tenant,
      innerBlock,
      block,
      property,
      rentAmount,
      paidAmount,
      bankAccount,
      month,
      status,
      paymentDate,
      note,
      createdBy,
      paymentmethod,
      paymentProof,
    } = req.body;
    let rentStatus = "pending";
    if (paidAmount >= rentAmount) {
      rentStatus = "paid";
    } else if (paidAmount < rentAmount) {
      rentStatus = "partially_paid";
    }
    const newRent = await rent.create({
      tenant,
      innerBlock,
      block,
      property,
      rentAmount,
      paidAmount,
      bankAccount: paymentmethod === "bank" ? bankAccount : null,
      paymentDate: paidAmount > 0 ? new Date() : null,
      status,
      note,
      month,
      paymentProof,
      createdBy: req.admin.id,
    });
    if (paymentmethod === "bank" && paidAmount > 0) {
      await bankAccount.findByIdAndUpdate(bankAccount, {
        $inc: { balance: -paidAmount },
      });
    }
    return res.status(201).json({
      success: true,
      message: "Rent created successfully",
      rent: newRent,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Rent creation failed",
      error: error.message,
    });
  }
};
