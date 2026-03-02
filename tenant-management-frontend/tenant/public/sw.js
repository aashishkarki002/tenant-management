// /public/sw.js

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
    self.registration
      .showNotification(title, {
        body,
        icon: "/logo.png",
        badge: "/badge.png",
        tag:
          data.notificationId ||
          data.maintenanceId ||
          data.paymentId ||
          "default",
        renotify: true,
        data,
        vibrate: [200, 100, 200],
        requireInteraction: false,
      })
      .then(() => {
        // ✅ Increment the app icon badge count
        return self.registration.getNotifications().then((notifications) => {
          navigator.setAppBadge(notifications.length).catch(() => {});
        });
      }),
  );
});

// ✅ Clear badge when user clicks a notification
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = resolveUrl(data);

  event.waitUntil(
    self.registration
      .getNotifications()
      .then((notifications) => {
        // If no more notifications, clear the badge
        if (notifications.length === 0) {
          navigator.clearAppBadge().catch(() => {});
        } else {
          navigator.setAppBadge(notifications.length).catch(() => {});
        }
      })
      .then(() =>
        clients
          .matchAll({ type: "window", includeUncontrolled: true })
          .then((clientList) => {
            for (const client of clientList) {
              if (
                client.url.startsWith(self.location.origin) &&
                "focus" in client
              ) {
                client.focus();
                client.postMessage({
                  type: "NOTIFICATION_CLICK",
                  url: targetUrl,
                  notificationId: data.notificationId,
                });
                return;
              }
            }
            if (clients.openWindow) return clients.openWindow(targetUrl);
          }),
      ),
  );
});
