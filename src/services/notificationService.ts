// Send push notification using service worker
export async function sendPushNotification(title: string, options?: NotificationOptions) {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      badge: '/icon.png',
      icon: '/icon.png',
      ...options,
    });
  } catch (err) {
    console.error('Error showing notification:', err);
  }
}

// Request permission for notifications (usually called on first login or settings)
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

// Frost alert notification
export async function sendFrostAlert(zone: string, minTemp: number, plantNames: string[]) {
  await sendPushNotification('⚠️ Alerta de Ger', {
    body: `Zona ${zone}: Temperaturi sub 0°C (min ${minTemp}°C). Plantele în pericol: ${plantNames.slice(0, 3).join(', ')}${plantNames.length > 3 ? '...' : ''}`,
    tag: 'frost-alert',
    requireInteraction: true,
    actions: [
      { action: 'open-garden', title: 'Deschide grădina' },
      { action: 'dismiss', title: 'OK' },
    ],
  } as any); // Cast to any because service-worker extensions aren't in TS
}

// Watering reminder notification
export async function sendWateringReminder(plantName: string, zone: string) {
  await sendPushNotification('💧 Reamintire de udare', {
    body: `${plantName} în zona ${zone} necesită apă astazi.`,
    tag: 'watering-reminder',
  });
}
