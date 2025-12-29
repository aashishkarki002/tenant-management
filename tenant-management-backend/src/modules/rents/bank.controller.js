import BankAccount from "./BankAccountModel.js";

export const createBankAccount = async (req, res) => {
  try {
    const { accountNumber, accountName, bankName, balance } = req.body;
    const newBankAccount = await BankAccount.create({
      accountNumber,
      accountName,
      bankName,
      balance,
    });
    return res
      .status(201)
      .json({
        success: true,
        message: "Bank account created successfully",
        bankAccount: newBankAccount,
      });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({
        success: false,
        message: "Bank account creation failed",
        error: error.message,
      });
  }
};
