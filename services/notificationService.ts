// Push notification service — sends browser notifications for frost alerts,
// watering reminders, and other garden events. Requires user permission +
// service worker for background delivery.

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function sendFrostAlert(alert: {
  plantName: string;
  emoji: string;
  forecastLow: number;
  hardiness: number;
  message: string;
}): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // `actions` is valid for service-worker notifications but missing from
    // the DOM lib's NotificationOptions, hence the cast.
    registration.showNotification(`${alert.emoji} ${alert.plantName}`, {
      body: `⚠️ Vine ${alert.forecastLow}°C — rezistă doar la ${alert.hardiness}°C`,
      tag: `frost-${alert.plantName}`,
      requireInteraction: true,
      actions: [
        { action: 'snooze', title: 'Mâine' },
        { action: 'dismiss', title: 'OK' },
      ],
    } as NotificationOptions);
  } catch (err) {
    console.error('Error sending frost alert:', err);
    // Fallback to simple notification
    new Notification(`${alert.emoji} ${alert.plantName}`, { body: alert.message });
  }
}

export async function sendWateringReminder(plant: {
  name: string;
  emoji: string;
  frequency: string;
}): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(`${plant.emoji} ${plant.name}`, {
      body: `E ora să uzi — ${plant.frequency}`,
      tag: `water-${plant.name}`,
      actions: [
        { action: 'mark-done', title: 'Udată' },
        { action: 'snooze', title: 'Peste 2h' },
      ],
    } as NotificationOptions);
  } catch (err) {
    console.error('Error sending watering reminder:', err);
    new Notification(`${plant.emoji} ${plant.name}`, { body: `E ora să uzi — ${plant.frequency}` });
  }
}

export async function sendGenericAlert(title: string, options?: NotificationOptions): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification(title, options);
  } catch (err) {
    console.error('Error sending notification:', err);
    new Notification(title, options);
  }
}
