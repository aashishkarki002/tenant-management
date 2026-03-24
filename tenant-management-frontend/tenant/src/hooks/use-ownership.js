import { useState, useEffect } from "react";
import api from "../../plugins/axios";
import { toast } from "sonner";

function useOwnership() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getEntities = async () => {
      setLoading(true);
      try {
        const response = await api.get("/api/ownership");
        if (response.data.success) {
          setEntities(response.data.data || []);
        } else {
          throw new Error(response.data.message || "Failed to fetch entities");
        }
      } catch (error) {
        console.error("Error fetching ownership entities:", error);
        toast.error("Failed to fetch ownership entities. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    getEntities();
  }, []);

  return { entities, loading };
}

export default useOwnership;
