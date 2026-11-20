/* Service Worker (wie Fraxx): Offline-Betrieb und Updates.
   Die App kommt immer aus dem Speicher. Eine neue Fassung wird im Hintergrund geladen,
   aber erst übernommen, wenn der Nutzer im Hinweis „Update verfügbar“ auf „Jetzt aktualisieren“ tippt. */
const VERSION = "28af4f52bf";
const PREFIX = "arnold-shell-";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "data/release.json"];
const SHELL_CACHE = PREFIX + VERSION, RUNTIME = "arnold-runtime";

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" }))))
    .then(() => { if (!self.registration.active) return self.skipWaiting(); }));
});
self.addEventListener("message", e => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== SHELL_CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.open(RUNTIME).then(async c => { const hit = await c.match(req); if (hit) return hit; const r = await fetch(req); if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Änderungshinweise und Anleitung: Netz zuerst, offline die zuletzt gesehene Fassung
  if (url.pathname.endsWith("/data/changes.json") || url.pathname.includes("/anleitung/")) {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const k = r.clone(); caches.open(RUNTIME).then(c => c.put(req, k)); } return r; })
      .catch(async () => (await caches.match(req, { ignoreSearch: true })) || Response.error()));
    return;
  }
  // App (inkl. release.json = eigene Version): aus dem Speicher dieser Fassung
  e.respondWith(caches.open(SHELL_CACHE).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === "navigate" ? await c.match("index.html") || await c.match("./") : null);
    if (hit) return hit;
    try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
    catch (err) { return Response.error(); }
  }));
});
