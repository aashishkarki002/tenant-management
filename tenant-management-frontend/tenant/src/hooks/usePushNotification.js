// src/hooks/usePushNotifications.js
import { useEffect } from "react";
import api from "../../plugins/axios"; // your existing axios instance

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function usePushNotifications(user) {
  useEffect(() => {
    if (!user) return;
    if (!VAPID_PUBLIC_KEY) {
      console.warn("[push] VITE_VAPID_PUBLIC_KEY not set in .env");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.warn("[push] Browser does not support Web Push");
      return;
    }
    if (!window.isSecureContext) {
      console.warn("[push] Web Push requires HTTPS (or localhost)");
      return;
    }

    async function registerAndSubscribe() {
      try {
        // Register service worker (safe to call repeatedly — browser deduplicates)
        const registration = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        // Request permission only if not already decided
        if (Notification.permission === "denied") return;
        if (Notification.permission === "default") {
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;
        }

        // Check for existing subscription — don't re-subscribe
        const existing = await registration.pushManager.getSubscription();
        if (existing) return;

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        // Save to backend
        await api.post("/api/push/subscribe", { subscription });
        console.log("[push] ✅ Subscribed and saved");
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
    }

    registerAndSubscribe();
  }, [user]);
}
