import { globalSearch } from "./search.service.js";

export const searchController = async (req, res) => {
  try {
    const { q, limit } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(200).json({ success: true, results: [], total: 0 });
    }

    const data = await globalSearch(q, parseInt(limit) || 5);
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
