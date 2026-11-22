// Service worker de HassanGym: permite abrir la app sin conexión.
// - La app (index.html y sus archivos): primero internet, para tener SIEMPRE la
//   última versión; si no hay conexión, la copia guardada.
// - Fotos de ejercicios: se guardan las que ya se han visto (máximo 120).
// - La IA (Groq) y el servidor de perfiles nunca se guardan: siempre van por internet.
const VERSION = 'hassangym-v1';
const APP = ['./', './index.html', './manifest.webmanifest', './iconos/icono-192.png', './iconos/icono-512.png', './iconos/apple-touch-icon.png'];
const FOTOS = 'hassangym-fotos';
const MAX_FOTOS = 120;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== VERSION && k !== FOTOS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function primeroInternet(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req, { cache: 'no-cache' });
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./index.html')) || Response.error();
  }
}

async function fotoGuardada(req) {
  const cache = await caches.open(FOTOS);
  const guardada = await cache.match(req);
  if (guardada) return guardada;
  try {
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) {
      await cache.put(req, res.clone());
      const claves = await cache.keys();
      if (claves.length > MAX_FOTOS) await cache.delete(claves[0]);
    }
    return res;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(primeroInternet(req)); return; }
  if (url.hostname === 'raw.githubusercontent.com' && url.pathname.includes('/free-exercise-db/')) { e.respondWith(fotoGuardada(req)); return; }
  // Todo lo demás (IA, perfiles en la nube, YouTube...) pasa sin tocar
});
