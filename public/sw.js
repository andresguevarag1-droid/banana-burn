/* Banana Burn · service worker mínimo: SOLO notificaciones push.
   Sin manejador de fetch ni caché offline, a propósito: nunca sirve páginas autenticadas viejas. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
  const title = String(data.title || "Banana Burn 🍌").slice(0, 120);
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
