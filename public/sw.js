self.addEventListener('install', (event) => {
    // Skip waiting to activate the new service worker immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim clients immediately so we can control them without reload
    event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    // Focus on the game window if clicked
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If there is already a window open, focus it
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    return client.focus();
                }
            }
            // If no window is open, open a new one (optional, mainly for "closed" app scenario if supported)
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
