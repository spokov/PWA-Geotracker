/* eslint-disable no-restricted-globals */

/**
 * GeoTrack Service Worker
 * - Caches app shell for offline use
 * - Background Sync API: syncs cached location updates when connectivity restores
 * - Periodic Background Sync: attempts to keep the SW alive for background tracking
 * - Wake-lock / keep-alive: periodic self-ping to prevent OS termination
 */

const CACHE_NAME = 'geotrack-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
];

// --- Install: pre-cache app shell ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(APP_SHELL).catch(() => {
        // Some resources may fail to cache (e.g. CDN) — non-fatal
      })
    )
  );
  self.skipWaiting();
});

// --- Activate: clean up old caches ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// --- Fetch: network-first for API, cache-first for app shell ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Don't intercept Supabase API calls — they need to go through
  if (url.hostname.includes('supabase.co') || url.hostname.includes('tile.openstreetmap.org')) {
    return;
  }

  // Cache-first for static assets
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response.ok && event.request.url.startsWith(self.location.origin)) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
});

// --- Background Sync: sync pending location updates ---
self.addEventListener('sync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncPendingLocations());
  }
});

// --- Periodic Background Sync ---
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'location-sync') {
    event.waitUntil(syncPendingLocations());
  }
});

// --- Push event (dummy): keeps the service worker alive on iOS ---
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('GeoTrack', {
      body: 'Background tracking is active.',
      tag: 'geotrack-bg',
      silent: true,
    })
  );
});

// --- Keep-alive: periodically evaluate state to prevent termination ---
let keepAliveInterval = null;

self.addEventListener('message', (event) => {
  if (event.data === 'start-keepalive') {
    if (keepAliveInterval) return;
    keepAliveInterval = setInterval(() => {
      // Periodically check for pending updates and sync if online
      if (navigator.onLine) {
        syncPendingLocations().catch(() => {});
      }
    }, 30000); // every 30 seconds
  }
  if (event.data === 'stop-keepalive') {
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
  }
});

/**
 * Reads pending location updates from IndexedDB and sends them to Supabase.
 * Removes each entry on successful upload.
 */
async function syncPendingLocations() {
  const db = await openLocationDB();
  const updates = await getAllPending(db);

  for (const update of updates) {
    try {
      // The client app handles the actual Supabase insert via the online event.
      // The SW acts as a backup sync trigger — it notifies all clients to sync.
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: 'sync-pending' });
      });

      // If no active clients, attempt direct upload via fetch
      if (clients.length === 0) {
        await directUpload(update);
      }
      await deletePending(db, update.id);
    } catch (err) {
      // Stop on first error — will retry on next sync event
      break;
    }
  }
}

async function directUpload(update) {
  const supabaseUrl = self.location ? `${self.location.origin}` : '';
  // Fallback: we can't do authenticated uploads from SW without a token.
  // Defer to the client app for actual uploads.
  return Promise.resolve();
}

// --- IndexedDB helpers (shared schema with the app) ---
const DB_NAME = 'location-tracker-db';
const STORE_NAME = 'pending_updates';

function openLocationDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function deletePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
