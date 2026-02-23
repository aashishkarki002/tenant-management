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

  const { title, body, data } = event.data.json();

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/logo.png", // put your app logo at /public/logo.png
      badge: "/badge.png", // small monochrome icon (Android status bar)
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false, // flip to true for critical alerts that shouldn't auto-dismiss
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow("/");
      }),
  );
});
