import api from "../../plugins/axios";
import { HARDCODED_ENTITY_ID } from "./loan.constants";

export async function resolveEntityId() {
  if (window.__entityCtx__?.activeEntityId) return window.__entityCtx__.activeEntityId;
  if (window.__entityCtx__?.defaultEntityId) return window.__entityCtx__.defaultEntityId;
  try {
    const res = await api.get("/api/settings/system");
    const cfg = res.data?.data ?? res.data;
    return cfg?.defaultEntityId ?? HARDCODED_ENTITY_ID;
  } catch {
    return HARDCODED_ENTITY_ID;
  }
}

