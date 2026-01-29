import BankAccount from "./BankAccountModel.js";

async function applyPaymentToBank({
  paymentMethod,
  bankAccountId,
  amount,
  session,
}) {
  // Cash payments don't require bank account
  if (paymentMethod === "cash") {
    return null;
  }

  // Bank transfer and cheque require valid payment method
  if (!["bank_transfer", "cheque"].includes(paymentMethod)) {
    throw new Error("Invalid payment method");
  }

  if (!bankAccountId) {
    throw new Error("Bank account ID is required");
  }

  const bankAccount =
    await BankAccount.findById(bankAccountId).session(session);
  if (!bankAccount) {
    throw new Error("Bank account not found");
  }

  bankAccount.balance += amount;
  await bankAccount.save({ session });
  return bankAccount;
}
export { applyPaymentToBank };
