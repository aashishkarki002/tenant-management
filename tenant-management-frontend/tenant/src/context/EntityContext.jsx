import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../../plugins/axios";
import { useAuth } from "./AuthContext";

const EntityContext = createContext(null);

export const EntityProvider = ({ children }) => {
  const { user } = useAuth();

  const [systemMode, setSystemModeState] = useState("private");
  const [entities, setEntities] = useState([]);
  const [defaultEntityId, setDefaultEntityId] = useState(null);
  const [activeEntityId, setActiveEntityId] = useState(null); // null = show all (merged default)
  const [loading, setLoading] = useState(false);

  // Fetch entities — only for super_admin; regular admins see merged view only
  const refreshEntities = useCallback(async () => {
    if (user?.role !== "super_admin") return;
    setLoading(true);
    try {
      const [ownershipRes, configRes] = await Promise.all([
        api.get("/api/ownership"),
        api.get("/api/settings/ownership-config"),
      ]);

      if (ownershipRes.data.success) {
        setEntities(ownershipRes.data.data ?? []);
      }

      if (configRes.data.success) {
        const cfg = configRes.data.data;
        setSystemModeState(cfg?.systemMode ?? "private");
        setDefaultEntityId(cfg?.defaultEntityId ?? null);
      }
    } catch (err) {
      console.warn("[EntityContext] Failed to load entity data:", err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    if (user) refreshEntities();
  }, [user, refreshEntities]);

  // Persist system mode change via API then refresh
  const updateSystemMode = useCallback(async (mode) => {
    try {
      await api.patch("/api/settings/system-mode", { systemMode: mode });
      setSystemModeState(mode);
      // Reset active filter when mode changes
      setActiveEntityId(null);
      await refreshEntities();
    } catch (err) {
      console.warn("[EntityContext] Failed to update system mode:", err.message);
      throw err;
    }
  }, [refreshEntities]);

  return (
    <EntityContext.Provider
      value={{
        systemMode,
        entities,
        defaultEntityId,
        activeEntityId,
        loading,
        setActiveEntityId,
        updateSystemMode,
        refreshEntities,
      }}
    >
      {children}
    </EntityContext.Provider>
  );
};

export const useEntity = () => {
  const ctx = useContext(EntityContext);
  if (!ctx) throw new Error("useEntity must be used inside <EntityProvider>");
  return ctx;
};

export default EntityContext;
