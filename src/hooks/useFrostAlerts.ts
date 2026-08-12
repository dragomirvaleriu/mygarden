import { useEffect, useState } from 'react';
import { useData } from '../context/DataContext';
import { sendFrostAlert, requestNotificationPermission } from '../services/notificationService';

interface FrostAlert {
  zone: string;
  minTemp: number;
  affectedPlants: string[];
}

export function useFrostAlerts() {
  const [alerts, setAlerts] = useState<FrostAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { properties } = useData();

  useEffect(() => {
    if (properties.length === 0) return;

    const checkFrostAlerts = async () => {
      setLoading(true);
      try {
        // Request permission on first check
        await requestNotificationPermission();

        // Call frost alert API
        const response = await fetch('/api/weather/check-frost-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            propertyIds: properties.map(p => p.id),
          }),
        });

        if (!response.ok) throw new Error('Frost alert check failed');

        const data = await response.json();
        if (data.alerts && data.alerts.length > 0) {
          setAlerts(data.alerts);

          // Send notifications for each alert
          for (const alert of data.alerts) {
            await sendFrostAlert(alert.zone, alert.minTemp, alert.affectedPlants);
          }
        }
      } catch (err) {
        console.error('Error checking frost alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    // Check on mount
    checkFrostAlerts();

    // Check every 6 hours
    const interval = setInterval(checkFrostAlerts, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [properties]);

  return { alerts, loading };
}
