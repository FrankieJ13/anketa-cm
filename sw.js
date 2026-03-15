// ===== SERVICE WORKER — Анкета клиента PWA =====
const CACHE_NAME = 'anketa-pwa-v3';

// Ресурсы для кэширования при установке
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

// Внешние ресурсы (CDN), которые кэшируем при первом обращении
const CDN_CACHE_NAME = 'anketa-cdn-v3';


// ===== INSTALL =====
self.addEventListener('install', function(event) {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Кэширование основных файлов');
      return cache.addAll(PRECACHE_URLS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ===== ACTIVATE =====
self.addEventListener('activate', function(event) {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) {
            return name !== CACHE_NAME && name !== CDN_CACHE_NAME;
          })
          .map(function(name) {
            console.log('[SW] Удаление старого кэша:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ===== FETCH =====
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Стратегия: Network First для локальных файлов (всегда свежие данные)
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then(function(networkResponse) {
          // Обновляем кэш при успешном сетевом ответе
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(function() {
          // Если нет сети — берём из кэша
          console.log('[SW] Сеть недоступна, берём из кэша:', event.request.url);
          return caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            // Если запрашивают страницу — возвращаем index.html
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html');
            }
          });
        })
    );
    return;
  }

  // Стратегия: Cache First для CDN ресурсов (быстрая загрузка)
  event.respondWith(
    caches.match(event.request).then(function(cachedResponse) {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(function(networkResponse) {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CDN_CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(function() {
        console.log('[SW] CDN недоступен:', event.request.url);
      });
    })
  );
});
