const CACHE_NAME = 'secret-reading-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Install Event - Pre-cache essential static shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Cache prefill warning:', err);
      });
    })
  );
});

// Activate Event - Clean up old cache structures
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting stale cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Advanced Stale-While-Revalidate with caching
self.addEventListener('fetch', (event) => {
  // Only intercept local GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip external APIs/auth redirects or firestore endpoints to avoid corrupting db queries offline
  if (!url.origin.startsWith(self.location.origin) || url.pathname.startsWith('/api') || url.pathname.includes('firestore')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        console.warn('[SW] Offline fetch failed, serving cached copy if exists:', err);
        return cachedResponse;
      });

      // Serve from cache immediately if exists, then update in background; otherwise wait for network fetch
      return cachedResponse || fetchPromise;
    })
  );
});

// Native Android Background Notification Handlers

// Listen for push notifications from backend (if configured)
self.addEventListener('push', (event) => {
  let data = { title: '私密阅读专栏', body: '您有新的消息。', icon: '/favicon.ico' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: '私密阅读专栏', body: event.data.text(), icon: '/favicon.ico' };
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=192&q=80',
    badge: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=192&q=80',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    tag: 'secret-reading-push',
    renotify: true,
    actions: [
      { action: 'open', title: '立即查看' },
      { action: 'close', title: '忽略' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Listen for direct messages from the React app (e.g. diagnostic system test notifications)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'TRIGGER_TEST_NOTIFICATION') {
    const payload = event.data.payload || {};
    
    // Support delayed trigger (e.g. 5s delay so user can lock the device or go home to test background behavior!)
    const delay = payload.delay || 0;
    
    setTimeout(() => {
      const options = {
        body: payload.body || '测试系统级通知，连接已成功建立！',
        icon: payload.icon || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=192&q=80',
        badge: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=192&q=80',
        vibrate: [200, 100, 200], // Cool double haptic vibration on Android!
        tag: 'secret-reading-system-test',
        renotify: true,
        requireInteraction: true, // Keep it visible until action
        data: {
          url: payload.url || '/'
        },
        actions: [
          { action: 'open', title: '打开应用' },
          { action: 'close', title: '关闭' }
        ]
      };

      self.registration.showNotification(payload.title || '🔔 系统级通知测试', options);
    }, delay);
  }
});

// Handle notification interaction (click actions)
self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification banner

  if (event.action === 'close') {
    return;
  }

  // Handle opening or focusing the app window
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data?.url || '/';
      
      // If there is already an open window, focus it and redirect
      for (const client of clientList) {
        if (client.url.includes(self.location.host) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url: targetUrl });
          return client.focus();
        }
      }
      
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

