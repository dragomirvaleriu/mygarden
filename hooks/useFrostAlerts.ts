import { useEffect, useState } from 'react';
import { auth } from '../services/firebase';

interface FrostAlert {
  plantName: string;
  emoji: string;
  forecastLow: number;
  hardiness: number;
  message: string;
}

export function useFrostAlerts(latitude?: number, longitude?: number) {
  const [alerts, setAlerts] = useState<FrostAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid || !latitude || !longitude) return;

    const checkAlerts = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/weather/check-frost-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            latitude,
            longitude,
          }),
        });
        const data = await response.json();
        setAlerts(data.alerts || []);
      } catch (err) {
        console.error('Error fetching frost alerts:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAlerts();
  }, [latitude, longitude]);

  return { alerts, loading };
}
