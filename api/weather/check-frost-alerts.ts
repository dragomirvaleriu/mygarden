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

/** How many days ahead to look for a frost event. */
const FORECAST_DAYS = 3;
/** Assumed hardiness when a plant has none recorded — cold enough that we
 *  stay quiet rather than crying wolf about a plant we know nothing about. */
const DEFAULT_HARDINESS_C = -15;

interface FrostAlert {
  zone: string;
  date: string;
  minTemp: number;
  affectedPlants: string[];
}

/**
 * Frost-risk check for a user's properties.
 *
 * Was previously written against `@netlify/functions` with the *client*
 * Firebase SDK — on Vercel that meant the route never ran at all, so frost
 * alerts silently never fired. Rewritten to the Vercel handler signature
 * with firebase-admin, matching api/user/update-level.ts.
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { propertyIds } = body;

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'propertyIds array required' });
    }

    const alerts: FrostAlert[] = [];

    for (const propId of propertyIds) {
      const propSnap = await db.collection('properties').doc(String(propId)).get();
      if (!propSnap.exists) continue;

      const prop = propSnap.data() || {};
      const { latitude, longitude } = prop;
      if (latitude == null || longitude == null) continue;

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&daily=temperature_2m_min&forecast_days=${FORECAST_DAYS}&timezone=auto`
      );
      if (!weatherRes.ok) continue;

      const weather = await weatherRes.json();
      const mins: number[] = weather?.daily?.temperature_2m_min ?? [];
      const dates: string[] = weather?.daily?.time ?? [];
      if (mins.length === 0) continue;

      // Only load the property's plants if some day actually drops below zero —
      // saves a Firestore read per property on every non-frost day, which is
      // the overwhelmingly common case.
      const coldestAhead = Math.min(...mins);
      if (coldestAhead >= 0) continue;

      const plantSnap = await db
        .collection('user_plants')
        .where('propertyId', '==', propId)
        .get();
      const plants = plantSnap.docs.map(d => d.data());

      for (let i = 0; i < mins.length; i++) {
        const minTemp = mins[i];
        if (minTemp >= 0) continue;

        // A plant is at risk when the forecast dips below what it tolerates.
        const affected = plants
          .filter(p => (p.frostHardiness ?? DEFAULT_HARDINESS_C) > minTemp)
          .map(p => p.name)
          .filter(Boolean);

        if (affected.length > 0) {
          alerts.push({
            zone: prop.name || `Proprietate ${propId}`,
            date: dates[i],
            minTemp: Math.round(minTemp * 10) / 10,
            affectedPlants: affected,
          });
        }
      }
    }

    return res.status(200).json({ alerts });
  } catch (err) {
    console.error('Frost alert check error:', err);
    return res.status(500).json({ error: 'Frost alert check failed' });
  }
}
