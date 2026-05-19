import { resetTestData } from "./devTools.service.js";

export async function resetTestDataController(req, res) {
  try {
    const counts = await resetTestData();
    return res.status(200).json({ success: true, deleted: counts });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
