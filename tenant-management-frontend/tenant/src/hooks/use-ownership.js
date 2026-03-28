import { useState, useEffect, useCallback } from "react";
import api from "../../plugins/axios";
import { toast } from "sonner";

function useOwnership() {
  const [entities, setEntities] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getData = async () => {
      setLoading(true);
      try {
        const [entitiesRes, blocksRes] = await Promise.all([
          api.get("/api/ownership"),
          api.get("/api/blocks/get-allblocks")
        ]);

        if (entitiesRes.data.success) {
          setEntities(entitiesRes.data.data || []);
        } else {
          throw new Error(entitiesRes.data.message || "Failed to fetch entities");
        }

        const blocksList = blocksRes.data?.data ?? [];
        setBlocks(Array.isArray(blocksList) ? blocksList : []);
      } catch (error) {
        console.error("Error fetching ownership data:", error);
        toast.error("Failed to fetch ownership data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    getData();
  }, []);

  const getBlocksForEntity = useCallback((entityId) => {
    if (!entityId || !Array.isArray(blocks)) return [];
    const target = String(entityId);
    return blocks.filter((block) => {
      const ref = block.ownershipEntityId ?? block.ownershipEntity;
      const id = ref?._id ?? ref;
      return id != null && String(id) === target;
    });
  }, [blocks]);

  return { entities, blocks, loading, getBlocksForEntity };
}

export default useOwnership;
