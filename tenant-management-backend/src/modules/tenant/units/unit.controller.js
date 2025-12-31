import mongoose from "mongoose";
import { Unit } from "./unit.model.js";
import { connectDB } from "../../../config/db.js";

connectDB();

const units = [
  {
    name: "Unit A1",
    property: "693d7d94f82ef4b0c10062ec",
    block: "693d7e5b5bc40aa7b445c129",
    innerBlock: "69412270ecc0d3779c8cf89e",
  },
  {
    name: "Unit A2",
    property: "693d7d94f82ef4b0c10062ec",
    block: "693d7e5b5bc40aa7b445c129",
    innerBlock: "69412254ee2edd9e6d5835ca",
  },
  {
    name: "Unit A3",
    property: "693d7d94f82ef4b0c10062ec",
    block: "693d7e32ca809ccf657dad0f",
    innerBlock: "69412254ee2edd9e6d5835ca",
  },
  {
    name: "Unit A4",
    property: "693d7d94f82ef4b0c10062ec",
    block: "693d7e32ca809ccf657dad0f",
    innerBlock: "69412270ecc0d3779c8cf89e",
  },
];

export default async function createUnit(req, res) {
  try {
    const createdUnits = await Unit.create(units);
    res
      .status(201)
      .json({
        success: true,
        message: "Units created successfully",
        units: createdUnits,
      });
  } catch (error) {
    console.error(error.message);
    res
      .status(500)
      .json({
        success: false,
        message: "Units creation failed",
        error: error.message,
      });
  }
}
