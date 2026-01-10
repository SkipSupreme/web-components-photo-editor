/**
 * Service Worker - Offline Support for Photo Editor
 * Caches application assets for offline use
 */

const CACHE_NAME = 'photo-editor-v1';
const STATIC_CACHE = 'photo-editor-static-v1';
const DYNAMIC_CACHE = 'photo-editor-dynamic-v1';

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/styles/main.css',
  // Core modules
  '/src/core/store.js',
  '/src/core/event-bus.js',
  '/src/core/commands.js',
  '/src/core/shortcuts.js',
  // Document modules
  '/src/document/document.js',
  '/src/document/layer.js',
  '/src/document/selection.js',
  '/src/document/transform.js',
  // Tool modules
  '/src/tools/tool-manager.js',
  '/src/tools/base-tool.js',
  '/src/tools/brush/brush-tool.js',
  '/src/tools/brush/brush-engine.js',
  '/src/tools/brush/brush-presets.js',
  '/src/tools/eraser-tool.js',
  '/src/tools/move-tool.js',
  '/src/tools/eyedropper-tool.js',
  '/src/tools/fill-tool.js',
  '/src/tools/gradient-tool.js',
  '/src/tools/crop-tool.js',
  '/src/tools/transform-tool.js',
  '/src/tools/selection/marquee-tool.js',
  '/src/tools/selection/lasso-tool.js',
  '/src/tools/selection/magic-wand-tool.js',
  // Engine modules
  '/src/engine/renderer.js',
  '/src/engine/compositor.js',
  // Effects
  '/src/effects/adjustments/index.js',
  // I/O modules
  '/src/io/file-handler.js',
  '/src/io/image-import.js',
  '/src/io/image-export.js',
  '/src/io/psd/psd-import.js',
  '/src/io/psd/psd-export.js',
  // Storage modules
  '/src/storage/db.js',
  '/src/storage/project-store.js',
  '/src/storage/autosave.js',
  // Components
  '/src/components/app-shell.js',
  '/src/components/canvas/editor-canvas.js',
  '/src/components/canvas/canvas-overlay.js',
  '/src/components/panels/layers-panel.js',
  '/src/components/panels/color-panel.js',
  '/src/components/panels/history-panel.js',
  '/src/components/panels/brushes-panel.js',
  '/src/components/panels/adjustments-panel.js',
  '/src/components/dialogs/export-dialog.js',
  // Workers
  '/workers/psd-worker.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets...');
        // Cache what we can, don't fail on missing files
        return Promise.allSettled(
          STATIC_ASSETS.map(url =>
            cache.add(url).catch(err => {
              console.warn(`[SW] Failed to cache: ${url}`, err);
            })
          )
        );
      })
      .then(() => {
        console.log('[SW] Static assets cached');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              // Delete old caches
              return name.startsWith('photo-editor-') &&
                     name !== STATIC_CACHE &&
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Skip chrome-extension and devtools requests
  if (url.protocol === 'chrome-extension:' || url.pathname.includes('__')) {
    return;
  }

  event.respondWith(
    handleFetch(request)
  );
});

/**
 * Handle fetch requests with cache-first strategy for static assets
 * and network-first for dynamic content
 */
async function handleFetch(request) {
  const url = new URL(request.url);

  // Static assets - cache first
  if (isStaticAsset(url)) {
    return cacheFirst(request);
  }

  // Dynamic content - network first
  return networkFirst(request);
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.html', '.woff', '.woff2', '.ttf', '.svg', '.png', '.jpg', '.ico'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
         url.pathname === '/';
}

/**
 * Cache-first strategy
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached response and update cache in background
    updateCache(request);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, return offline page if available
    return caches.match('/offline.html');
  }
}

/**
 * Network-first strategy
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }

    throw error;
  }
}

/**
 * Update cache in background (stale-while-revalidate)
 */
async function updateCache(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Silently fail - we already have a cached version
  }
}

// Message handling
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;

    case 'GET_CACHE_SIZE':
      getCacheSize().then((size) => {
        event.ports[0].postMessage({ size });
      });
      break;

    case 'CACHE_URLS':
      cacheUrls(data.urls).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter(name => name.startsWith('photo-editor-'))
      .map(name => caches.delete(name))
  );
}

/**
 * Get total cache size
 */
async function getCacheSize() {
  if (!navigator.storage || !navigator.storage.estimate) {
    return null;
  }

  const estimate = await navigator.storage.estimate();
  return {
    usage: estimate.usage,
    quota: estimate.quota,
    percent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
  };
}

/**
 * Cache specific URLs
 */
async function cacheUrls(urls) {
  const cache = await caches.open(DYNAMIC_CACHE);
  await Promise.allSettled(
    urls.map(url => cache.add(url).catch(() => {}))
  );
}

// Background sync for saving work when back online
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-project') {
    event.waitUntil(syncProject());
  }
});

async function syncProject() {
  // Notify clients to sync their projects
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_PROJECT'
    });
  });
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/assets/icons/icon-192.png',
      badge: '/assets/icons/badge-72.png',
      data: data.url
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.notification.data) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});

console.log('[SW] Service worker loaded');
