// Service worker : sert les PDFs bordereaux via une vraie URL HTTPS
// → AirPrint peut fetcher /print-pdf/{id} et imprimer le vrai contenu PDF

const pdfStore = {};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(clients.claim()));

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'STORE_PDF') {
    pdfStore[event.data.id] = event.data.base64;
    if (event.ports[0]) event.ports[0].postMessage({ ok: true });
  }
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/print-pdf/')) {
    const id = url.pathname.slice('/print-pdf/'.length);
    const base64 = pdfStore[id];
    if (base64) {
      event.respondWith((async () => {
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': String(bytes.length),
            'Content-Disposition': 'inline; filename="bordereau.pdf"',
          },
        });
      })());
    }
  }
});
