import mongoose from "mongoose";

export function normalizeUnitIdsArray(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  const result = [];
  for (const item of arr) {
    if (item && typeof item === "object" && Array.isArray(item.$in)) {
      result.push(...item.$in);
    } else if (item != null && item !== "") {
      result.push(item);
    }
  }
  return result;
}

export function parseUnitIds(units) {
  if (!units) throw new Error("Units are required");

  const unitArray = Array.isArray(units) ? units : [units];
  return unitArray.map((id) => {
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new Error(`Invalid unit ID: ${id}`);
    return new mongoose.Types.ObjectId(id);
  });
}

export function filterOccupiedUnits(units) {
  return units.filter((unit) => unit.isOccupied);
}
