/*
  Service Worker do Melina.

  O que ele faz:
  1) Guarda o app em cache para abrir mesmo sem internet (necessário também
     para o navegador considerar o app "instalável").
  2) Recebe o pedido de notificação vindo da página (via registration.showNotification)
     e mostra a notificação do sistema — isso tende a ser entregue de forma mais
     confiável do que "new Notification()" direto na página, inclusive com o app
     em 2º plano (mas com o processo ainda vivo — ver observação abaixo).
  3) Ao tocar na notificação, foca ou abre o app.

  Limitação importante (sem servidor de push):
  Sem um back-end enviando Web Push, o disparo do alarme continua dependendo do
  relógio da própria página (setTimeout/setInterval). Isso funciona com o app
  aberto, minimizado ou em segundo plano — mas não sobrevive ao app sendo
  totalmente fechado/encerrado pelo sistema. Não incluímos Periodic Background
  Sync aqui porque, na prática (principalmente fora do Android/Chrome), o
  navegador controla o intervalo mínimo de execução (geralmente muitas horas),
  o que não seria preciso o suficiente para um alarme de soneca.
*/

const CACHE_NAME = 'melina-cache-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // não bloqueia a instalação se algum recurso não puder ser cacheado
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./index.html');
    })
  );
});
