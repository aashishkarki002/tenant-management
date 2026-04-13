import { useState, useEffect } from "react";
import api from "../../plugins/axios";

/**
 * Fetches all blocks from /api/blocks/get-allblocks.
 * Returns a flat list of { _id, name, ... } objects.
 */
export function useBlocks() {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/blocks/get-allblocks", { signal: controller.signal })
      .then((res) => {
        const data = res.data?.blocks || res.data?.data || [];
        setBlocks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (err.name === "AbortError" || err.code === "ERR_CANCELED") return;
        console.error("[useBlocks]", err);
        setBlocks([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, []);

  return { blocks, loading };
}
