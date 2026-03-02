// src/hooks/useBadge.js
import { useEffect } from "react";

export function useAppBadge(unreadCount = 0) {
  useEffect(() => {
    if (!("setAppBadge" in navigator)) return; // Not supported, fail silently

    if (unreadCount > 0) {
      navigator.setAppBadge(unreadCount).catch(() => {});
    } else {
      navigator.clearAppBadge().catch(() => {});
    }
  }, [unreadCount]);
}
