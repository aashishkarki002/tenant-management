// src/hooks/usePushNotification.ts
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

  const browserSupportsPush =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    window.isSecureContext;

  // ── Check if a local push subscription already exists ──────────────────────
  const checkSubscription = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY || !browserSupportsPush) return;
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
  }, [browserSupportsPush]);

  // ── Silent renewal on every app open ───────────────────────────────────────
  // Returns "ok", "no_subscription", or "unknown_endpoint".
  // "unknown_endpoint" means the server DB record was deleted (e.g. after a
  // 410 Gone from the push service) — caller should trigger re-subscription.
  const silentRenew = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY || !browserSupportsPush) return "no_subscription";
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) return "no_subscription";
      const sub = await registration.pushManager.getSubscription();
      if (!sub) return "no_subscription";
      const res = await fetch("/api/push/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const data = await res.json();
      if (!data.success && data.reason === "unknown_endpoint") {
        return "unknown_endpoint";
      }
      return "ok";
    } catch {
      return "ok"; // network error — stay silent, don't thrash
    }
  }, [browserSupportsPush]);

  // ── Subscribe ───────────────────────────────────────────────────────────────
  const requestPermissionAndSubscribe = useCallback(async () => {
    if (!user || !VAPID_PUBLIC_KEY || !browserSupportsPush) return;
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
        const renewRes = await fetch("/api/push/renew", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscription: existing.toJSON() }),
        });
        const renewData = await renewRes.json();
        if (renewData.success) {
          setIsSubscribed(true);
          return;
        }
      }

      const newSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await api.post("/api/push/subscribe", {
        subscription: newSubscription.toJSON(),
      });
      setIsSubscribed(true);
    } catch (err) {
      const msg = err.message || String(err);
      if (import.meta.env.DEV) console.warn("[push] Registration failed:", msg);
    }
  }, [user, browserSupportsPush]);

  // ── NEW: Unsubscribe ────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    if (!browserSupportsPush) return;
    try {
      const registration =
        await navigator.serviceWorker.getRegistration("/sw.js");
      if (!registration) {
        setIsSubscribed(false);
        return;
      }
      const sub = await registration.pushManager.getSubscription();
      if (!sub) {
        setIsSubscribed(false);
        return;
      }

      await sub.unsubscribe(); // removes from browser
      // Tell the server to purge the DB record
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      setIsSubscribed(false);
    } catch (err) {
      if (import.meta.env.DEV) console.warn("[push] Unsubscribe failed:", err);
    }
  }, [browserSupportsPush]);

  // ── NEW: Re-subscribe (fixes stale/broken subscriptions) ───────────────────
  // This is the "I'm not getting notifications" recovery action.
  // Forces a fresh subscription end-to-end — clears old browser record,
  // removes the server DB entry, then creates a brand-new subscription.
  const resubscribe = useCallback(async () => {
    await unsubscribe();
    await requestPermissionAndSubscribe();
  }, [unsubscribe, requestPermissionAndSubscribe]);

  // ── Effect ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      setIsReady(false);
      return;
    }
    if (!VAPID_PUBLIC_KEY) {
      if (import.meta.env.DEV)
        console.warn("[push] VITE_VAPID_PUBLIC_KEY not set");
      setIsReady(false);
      return;
    }
    if (!browserSupportsPush) {
      setIsReady(false);
      return;
    }

    setPermissionState(Notification.permission);
    setIsReady(true);
    checkSubscription();
    silentRenew().then((result) => {
      // If the server DB record was deleted (push subscription expired/rotated),
      // auto-resubscribe when the user is logged in and permission is already granted.
      // This fixes the silent failure where the browser still holds a subscription
      // object but the server has no record to push to.
      if (result === "unknown_endpoint" && Notification.permission === "granted") {
        requestPermissionAndSubscribe();
      }
    });
  }, [user, browserSupportsPush, checkSubscription, silentRenew, requestPermissionAndSubscribe]);

  return {
    permissionState,
    isReady,
    isSubscribed,
    isIOS,
    isStandalone,
    browserSupportsPush,
    requestPermissionAndSubscribe,
    unsubscribe,
    resubscribe, // ← the key recovery action
  };
}

// ── SW message listener ────────────────────────────────────────────────────────
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
