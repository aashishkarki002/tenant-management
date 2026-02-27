// src/hooks/usePushNotification.js
import { useEffect, useState, useCallback } from "react";
import api from "../../plugins/axios";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(user) {
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true);

  // ── Unchanged: check if a local push subscription already exists ────────────
  const checkSubscription = useCallback(async () => {
    if (
      !VAPID_PUBLIC_KEY ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !window.isSecureContext
    ) {
      return;
    }
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  // ── NEW: silent renewal — runs on every app open, no UI, no token needed ────
  // The browser already holds the subscription. We just ping /api/push/renew
  // (no Authorization header — raw fetch bypasses the axios interceptor) so the
  // server keeps its DB record fresh even after weeks of inactivity.
  const silentRenew = useCallback(async () => {
    if (
      !VAPID_PUBLIC_KEY ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !window.isSecureContext
    )
      return;

    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) return;

      const sub = await registration.pushManager.getSubscription();
      if (!sub) return;

      // Raw fetch — no Authorization header, no axios interceptor
      await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    } catch {
      // Always silent — renewal failure should never surface to the user
    }
  }, []);

  // ── UPDATED: subscribe flow now handles the renew → fallback pattern ─────────
  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!window.isSecureContext) return;
    if (Notification.permission === "denied") return;

    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        setPermissionState(permission);
        if (permission !== "granted") return;
      }

      const existing = await registration.pushManager.getSubscription();

      if (existing) {
        // CHANGED: don't just setIsSubscribed and return.
        // Try to renew on the server first — this is the path that runs when
        // the user explicitly opens the PWA after a long gap and the banner
        // triggers requestPermissionAndSubscribe.
        const renewRes = await fetch("/api/push/renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: existing.toJSON() }),
        });
        const renewData = await renewRes.json();

        if (renewData.success) {
          // Server recognises this endpoint — all good, no token needed
          setIsSubscribed(true);
          return;
        }

        // Server returned unknown_endpoint: our DB has no record of this
        // subscription (e.g. DB restored from backup, new device).
        // Fall through to create a fresh subscription with auth.
        if (import.meta.env.DEV)
          console.log(
            "[push] unknown endpoint — falling back to full subscribe",
          );
      }

      // Either no local subscription at all, or renewal said unknown_endpoint.
      // This is the only path that needs a valid access token.
      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await api.post("/api/push/subscribe", {
        subscription: newSubscription.toJSON(),
      });
      setIsSubscribed(true);
      if (import.meta.env.DEV) console.log("[push] ✅ Subscribed and saved");
    } catch (err) {
      const msg = err.message || String(err);
      if (import.meta.env.DEV) {
        console.warn("[push] Registration failed:", msg);
      } else if (
        !msg.includes("push service") &&
        !msg.includes("Registration failed")
      ) {
        console.warn("[push] Setup failed:", msg);
      }
    }
  }, [user]);

  // ── UPDATED: added silentRenew() call on every mount ─────────────────────────
  useEffect(() => {
    if (!user) {
      setIsReady(false);
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      if (import.meta.env.DEV)
        console.warn("[push] VITE_VAPID_PUBLIC_KEY not set in .env");
      setIsReady(false);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      if (import.meta.env.DEV)
        console.warn("[push] Browser does not support Web Push");
      setIsReady(false);
      return;
    }
    if (!window.isSecureContext) {
      if (import.meta.env.DEV)
        console.warn("[push] Web Push requires HTTPS (or localhost)");
      setIsReady(false);
      return;
    }

    setPermissionState(Notification.permission);
    setIsReady(true);
    checkSubscription();

    // Silently keep the server DB record alive on every app open.
    // Uses raw fetch (no token), so safe regardless of auth state.
    silentRenew();
  }, [user, checkSubscription, silentRenew]);

  return {
    permissionState,
    isReady,
    isSubscribed,
    isIOS,
    isStandalone,
    requestPermissionAndSubscribe,
  };
}

// ── SW message listener ───────────────────────────────────────────────────────
// Wire this once in App.jsx so notification taps deep-link and mark as read.
//
// Usage in App.jsx:
//   import { setupSwMessageListener } from "./hooks/usePushNotification";
//   useEffect(() => {
//     return setupSwMessageListener(navigate, async (id) => {
//       await api.patch(`/api/notification/mark-notification-as-read/${id}`);
//     });
//   }, [navigate]);
export function setupSwMessageListener(navigate, onNotificationRead) {
  if (!("serviceWorker" in navigator)) return () => {};

  const handler = (event) => {
    if (event.data?.type !== "NOTIFICATION_CLICK") return;
    const { url, notificationId } = event.data;
    if (url) navigate(url);
    if (notificationId && onNotificationRead)
      onNotificationRead(notificationId);
  };

  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
