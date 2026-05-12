import { useState, useEffect } from "react";
import api from "../../plugins/axios";

export function useTenant() {
  const [tenants, setTenants] = useState([]); // Changed from tenant to tenants, and null to []
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const getTenants = async () => {
      try {
        setLoading(true);
        const response = await api.get("/api/tenant/get-tenants");
        if (response.data.success) {
          setTenants(response.data.tenants || []);
        } else {
          throw new Error(response.data.message || "Failed to fetch tenants");
        }
      } catch (error) {
        console.error("Error fetching tenants:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    getTenants();
  }, []);

  return { tenants, loading, error };
}
