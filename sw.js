/* MindShift service worker: makes the app installable and quick to open, and keeps it working
   if the connection drops. It never caches sign-in traffic, and it never sees journal entries
   (those live in the browser's encrypted on-device storage, not in network requests). */
const VERSION = "mindshift-v1";
const SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];
const CDN_HOSTS = ["cdn.jsdelivr.net", "cdn.tailwindcss.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const NEVER_CACHE = /(^|\.)clerk\.(accounts\.dev|com)$|^img\.clerk\.com$|^challenges\.cloudflare\.com$|payhip\.com$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (NEVER_CACHE.test(url.hostname)) return; // sign-in and checkout always go to the network

  // Pages: try the network first so updates show up right away; fall back to the saved copy offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put("/", copy)); }
        return res;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Libraries and fonts (versioned URLs): serve from cache, fetch once.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
    return;
  }

  // Our own files (icons, PDFs): use the saved copy if there is one, refresh it in the background.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const net = fetch(req).then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    );
  }
});
