// Service worker: a app abre sem rede, mas vai SEMPRE buscar a versão mais recente quando há rede.
// Código (html/js/css/json): rede primeiro (ignora a cache do servidor), cache só se falhar.
// Fontes e imagens: cache primeiro. Subir V em cada publicação (e js/version.js + version.json).
const V = '2.0.1';
const CACHE = `jjr-gasoleo-${V}`;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'version.json', 'css/fonts.css', 'css/app.css',
  'js/app.js', 'js/version.js', 'js/store.js', 'js/db.js', 'js/sync.js', 'js/calc.js', 'js/demo.js', 'js/ui.js',
  'js/views/header.js', 'js/views/hoje.js', 'js/views/maquinas.js', 'js/views/mes.js', 'js/views/registo.js', 'js/views/definicoes.js', 'js/views/onboarding.js',
  'fonts/Barlow-400.woff2', 'fonts/Barlow-500.woff2', 'fonts/Barlow-600.woff2', 'fonts/Barlow-700.woff2',
  'fonts/BarlowCondensed-600.woff2', 'fonts/BarlowCondensed-700.woff2', 'fonts/BarlowCondensed-800.woff2',
  'img/jjr-mark.png', 'img/icon-192.png', 'img/icon-512.png', 'img/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // pedidos à folha Google passam direto
  const asset = /\.(woff2|png|jpg|svg|ico)$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (asset) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    try {
      const res = await withTimeout(fetch(req, { cache: 'no-cache' }), asset ? 15000 : 3500);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return (await cache.match('index.html')) || (await cache.match('./'));
      return new Response('', { status: 504 });
    }
  })());
});
