import api from "../../plugins/axios";

export async function resolveEntityId() {
  if (window.__entityCtx__?.activeEntityId) return window.__entityCtx__.activeEntityId;
  if (window.__entityCtx__?.defaultEntityId) return window.__entityCtx__.defaultEntityId;
  try {
    const res = await api.get("/api/settings/system");
    const cfg = res.data?.data ?? res.data;
    const entityId = cfg?.defaultEntityId;
    if (!entityId) throw new Error("No default entity configured");
    return entityId;
  } catch (err) {
    throw new Error("Could not resolve entity — please refresh or contact support");
  }
}

