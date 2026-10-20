/*
 * Nextcar CRM: recibe los avisos (push) y los muestra, aunque la app esté cerrada.
 *
 * Solo hace eso, a propósito: NO guarda páginas ni archivos en caché. Un service worker que cachea la app
 * es la forma más fácil de que un cliente se quede con una versión vieja del CRM.
 * Cada aviso que llega TIENE que mostrarse (iOS cancela la suscripción de quien recibe avisos sin mostrarlos).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { cuerpo: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.titulo || 'Nextcar CRM', {
    body: d.cuerpo || '',
    tag: d.etiqueta || undefined,
    renotify: !!d.etiqueta,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abiertas) {
      if ('focus' in c) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(url); } catch (e) { /* otra página: se queda donde está */ } }
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
