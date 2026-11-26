// Dołączane do Service Workera: dotknięcie powiadomienia o kontroli ciśnienia otwiera aplikację na module ODO.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate?.(self.registration.scope + '#/odo')
          return c.focus()
        }
      }
      return self.clients.openWindow(self.registration.scope + '#/odo')
    }),
  )
})
