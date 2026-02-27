// /public/sw.js
// Vite serves /public at the root, so this will be available at /sw.js

self.addEventListener("install", () => {
  console.log("[SW] installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] activated");
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "New Notification", body: event.data.text(), data: {} };
  }

  const { title, body, data = {} } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png",
      badge: "/badge.png",
      // tag deduplicates: same paymentId = replace old notification, don't stack
      tag:
        data.notificationId ||
        data.maintenanceId ||
        data.paymentId ||
        "default",
      renotify: true,
      data,
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }),
  );
});

// ── Build deep-link URL from notification type/data ───────────────────────────
function resolveUrl(data = {}) {
  if (data.maintenanceId) return `/maintenance/${data.maintenanceId}`;
  if (data.paymentId) return `/payments/${data.paymentId}`;
  // Default: open the notifications page so the user can see what came in
  return "/notifications";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = resolveUrl(data);

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse an existing open tab if possible
        for (const client of clientList) {
          if (
            client.url.startsWith(self.location.origin) &&
            "focus" in client
          ) {
            client.focus();
            // Tell the app to navigate and mark the notification read
            client.postMessage({
              type: "NOTIFICATION_CLICK",
              url: targetUrl,
              notificationId: data.notificationId,
            });
            return;
          }
        }
        // No open tab — open a new one
        if (clients.openWindow) return clients.openWindow(targetUrl);
      }),
  );
});
