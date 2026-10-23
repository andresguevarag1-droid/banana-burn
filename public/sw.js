/* Banana Burn · service worker mínimo: notificaciones push y una página "sin conexión".
   Nunca guarda páginas de la app ni datos del usuario: solo /offline.html (estática), que se muestra
   cuando una navegación falla por falta de red. Así nunca se sirve una versión vieja de una pantalla.
   VERSION cambia con cada cambio de este archivo: el activate borra las cachés de versiones anteriores. */

const VERSION = "bb-sw-v2";
const OFFLINE_CACHE = VERSION + "-offline";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.addAll([new Request(OFFLINE_URL, { cache: "reload" }), "/icons/icon-192.png"]);
    } catch (e) { /* sin red al instalar: se intenta en la próxima instalación */ }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("bb-") && k !== OFFLINE_CACHE).map((k) => caches.delete(k)));
    // Navigation preload: la red responde en paralelo al arranque del service worker (sin costo extra al navegar).
    if (self.registration.navigationPreload) { try { await self.registration.navigationPreload.enable(); } catch (e) { /* */ } }
    await self.clients.claim();
  })());
});

// Solo navegaciones (abrir una pantalla). Todo lo demás (datos, scripts, imágenes) va directo a la red.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.mode !== "navigate" || req.method !== "GET") return;
  event.respondWith((async () => {
    try {
      const pre = await event.preloadResponse;
      if (pre) return pre;
      return await fetch(req);
    } catch (e) {
      const cached = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      return cached || new Response("Sin conexión", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
  })());
});

function safeUrl(raw) {
  try {
    const u = new URL(raw || "/app", self.location.origin);
    return u.origin === self.location.origin ? u.href : new URL("/app", self.location.origin).href;
  } catch (e) {
    return new URL("/app", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = String(data.title || "Banana Burn").slice(0, 120);
  const options = {
    body: String(data.body || "").slice(0, 240),
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: String(data.tag || "bb"),
    renotify: false,
    lang: "es",
    data: { url: safeUrl(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url === target && "focus" in c) return c.focus();
    }
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && "navigate" in c) {
        try { await c.navigate(target); return c.focus(); } catch (e) { /* abre una nueva */ }
      }
    }
    return self.clients.openWindow(target);
  })());
});

// El navegador rotó la suscripción: re-suscribe con la misma llave y avisa al servidor (usa la cookie de sesión).
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    try {
      const key = event.oldSubscription && event.oldSubscription.options && event.oldSubscription.options.applicationServerKey;
      const sub = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
      if (!sub) return;
      await fetch("/api/push/subscribe", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
    } catch (e) { /* sin red: se re-suscribe la próxima vez que abra la app */ }
  })());
});
