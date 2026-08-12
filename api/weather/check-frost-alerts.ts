import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const FIREBASE_PROJECT_ID = 'mygarden-hq';

function getAdminApp() {
  if (getApps().length) return getApps()[0];
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (key) {
    return initializeApp({ credential: cert(JSON.parse(key)), projectId: FIREBASE_PROJECT_ID });
  }
  return initializeApp({ projectId: FIREBASE_PROJECT_ID });
}

const db = getFirestore(getAdminApp());

// Parse frostHardiness string like "-5°C" into numeric value
function parseFrostHardiness(hardiness: string | undefined): number | null {
  if (!hardiness) return null;
  const match = hardiness.match(/(-?\d+)°C/);
  return match ? parseInt(match[1], 10) : null;
}

// Call external weather API (OpenWeatherMap or similar) to get forecast
// For demo: return mock data. In prod, fetch real forecast.
async function getForecastTemperature(latitude: number, longitude: number): Promise<{ low: number; high: number } | null> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,temperature_2m_max&timezone=auto`,
      { headers: { 'User-Agent': 'mygarden/1.0' } }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const tomorrow = data.daily;
    return {
      low: tomorrow.temperature_2m_min?.[1] || 10,
      high: tomorrow.temperature_2m_max?.[1] || 20,
    };
  } catch (err) {
    console.error('Forecast fetch error:', err);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, latitude, longitude } = req.body;
  if (!userId || latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'userId, latitude, longitude required' });
  }

  try {
    // 1. Get user's garden plants
    const gardenSnap = await db.collection('user_plants').where('userId', '==', userId).get();

    if (gardenSnap.empty) {
      return res.status(200).json({ alerts: [] });
    }

    // 2. Fetch plant manifest to get frostHardiness
    let plantLookup: { [key: string]: any } = {};
    try {
      const manifest = require('../../../content/garden/plant-manifest.json');
      plantLookup = manifest.reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});
    } catch {
      return res.status(200).json({ alerts: [], message: 'Plant manifest not available' });
    }

    // 3. Get weather forecast
    const forecast = await getForecastTemperature(latitude, longitude);
    if (!forecast) {
      return res.status(200).json({ alerts: [], message: 'Weather forecast unavailable' });
    }

    // 4. Check each plant for frost risk
    const alerts: any[] = [];

    gardenSnap.forEach(doc => {
      const { catalogId, plantName, emoji } = doc.data();
      const plantMeta = plantLookup[catalogId];

      if (!plantMeta?.frostHardiness) return;

      const minHardiness = parseFrostHardiness(plantMeta.frostHardiness);
      if (minHardiness === null) return;

      // Alert if forecast low is below plant's frost hardiness
      if (forecast.low < minHardiness) {
        alerts.push({
          plantName,
          emoji,
          catalogId,
          forecastLow: forecast.low,
          hardiness: minHardiness,
          message: `⚠️ Vine ${forecast.low}°C — ${plantName} tău rezistă doar la ${minHardiness}°C, adăpostește-l!`,
        });
      }
    });

    // 5. Optionally: write alerts to database for notification system
    if (alerts.length > 0) {
      try {
        await db.collection('frost_alerts').add({
          userId,
          alerts,
          forecastLow: forecast.low,
          timestamp: new Date(),
          sent: false, // mark for notification system to process
        });
      } catch (err) {
        console.error('Error saving frost alert:', err);
      }
    }

    res.status(200).json({ alerts, forecastLow: forecast.low, forecastHigh: forecast.high });
  } catch (err: any) {
    console.error('Check frost alerts error:', err);
    res.status(500).json({ error: err.message });
  }
}
