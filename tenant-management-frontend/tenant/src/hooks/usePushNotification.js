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
    typeof Notification !== "undefined" ? Notification.permission : "default"
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
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      }
    } catch {
      setIsSubscribed(false);
    }
  }, []);

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
        setIsSubscribed(true);
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      await api.post("/api/push/subscribe", { subscription });
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

  useEffect(() => {
    if (!user) {
      setIsReady(false);
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      if (import.meta.env.DEV) console.warn("[push] VITE_VAPID_PUBLIC_KEY not set in .env");
      setIsReady(false);
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      if (import.meta.env.DEV) console.warn("[push] Browser does not support Web Push");
      setIsReady(false);
      return;
    }
    if (!window.isSecureContext) {
      if (import.meta.env.DEV) console.warn("[push] Web Push requires HTTPS (or localhost)");
      setIsReady(false);
      return;
    }

    setPermissionState(Notification.permission);
    setIsReady(true);
    checkSubscription();
  }, [user, checkSubscription]);

  return {
    permissionState,
    isReady,
    isSubscribed,
    isIOS,
    isStandalone,
    requestPermissionAndSubscribe,
  };
}
