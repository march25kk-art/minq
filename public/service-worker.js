const CACHE_NAME = "minq-shell-v12";
const APP_SHELL = [
  "/",
  "/style.css",
  "/app.js",
  "/mbti.html",
  "/mbti.js",
  "/diagnosis.js",
  "/manifest.webmanifest",
  "/favicon-96.png",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isShellAsset = APP_SHELL.includes(url.pathname);
  const isNavigation = event.request.mode === "navigate";
  const isQuestionList = url.pathname === "/questions";

  if (!isShellAsset && !isNavigation && !isQuestionList) return;

  // 投稿直後の内容を確実に反映するため、質問一覧はネットワークを優先する。
  if (isQuestionList) {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" }))
        .then(async response => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CSS・JSはキャッシュを即表示し、裏側で最新版へ更新する。
  if (isShellAsset) {
    const cachePromise = caches.open(CACHE_NAME);
    const cachedPromise = cachePromise.then(cache => cache.match(event.request));
    const networkPromise = fetch(event.request).then(async response => {
        if (response.ok) {
          const cache = await cachePromise;
          await cache.put(event.request, response.clone());
        }
        return response;
      });
    event.waitUntil(networkPromise.then(() => undefined, () => undefined));
    event.respondWith(cachedPromise.then(cached => cached || networkPromise));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .catch(() => caches.match(event.request).then(response => response || (isNavigation ? caches.match("/") : undefined)))
  );
});
