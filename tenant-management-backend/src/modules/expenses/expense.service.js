import { Expense } from "./Expense.Model.js";
import ExpenseSource from "./ExpenseSource.Model.js";
import Admin from "../auth/admin.Model.js";
import mongoose from "mongoose";
import { ledgerService } from "../ledger/ledger.service.js";
export async function createExpense(expenseData) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      source,
      amount,
      EnglishDate,
      nepaliDate,
      nepaliMonth,
      nepaliYear,
      payeeType,
      tenant,
      referenceType,
      referenceId,
      status,
      notes,
      createdBy,
      expenseCode,
    } = expenseData;
    const expenseSource = await ExpenseSource.findById(source).session(session);
    if (!expenseSource) {
      throw new Error("Expense source not found");
    }
    const existingAdmin = await Admin.findById(createdBy).session(session);
    if (!existingAdmin) {
      throw new Error("Admin not found");
    }
    // Create expense first so we have an _id for the transaction referenceId
    const [expense] = await Expense.create(
      [
        {
          source: expenseSource._id,
          amount,
          EnglishDate,
          nepaliDate,
          nepaliMonth,
          nepaliYear,
          payeeType,
          tenant,
          referenceType,
          referenceId,
          status,
          notes,
          createdBy,
          expenseCode,
        },
      ],
      { session },
    );
    // Record expense in ledger after creation so expense._id exists
    const expenseEntry = await ledgerService.recordExpense(expense, session);
    if (!expenseEntry.success) {
      throw new Error(expenseEntry.message);
    }
    await session.commitTransaction();
    session.endSession();
    return {
      success: true,
      message: "Expense created successfully",
      data: expense,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // Handle Mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors)
        .map((err) => err.message)
        .join(", ");
      return {
        success: false,
        message: "Validation error",
        error: validationErrors,
      };
    }

    return {
      success: false,
      message: "Failed to create expense",
      error: error.message,
    };
  }
}

async function getAllExpenses() {
  try {
    const expenses = await Expense.find();
    return {
      success: true,
      message: "Expenses fetched successfully",
      data: expenses,
    };
  } catch (error) {
    console.error("Failed to get expenses:", error);
    throw error;
  }
}

export { getAllExpenses };
