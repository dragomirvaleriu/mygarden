import { Handler } from '@netlify/functions';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';

const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { propertyIds } = JSON.parse(event.body || '{}');
    if (!propertyIds || !Array.isArray(propertyIds)) {
      return { statusCode: 400, body: 'propertyIds array required' };
    }

    // Get coordinates for each property to fetch weather
    const alerts: any[] = [];

    for (const propId of propertyIds) {
      const propRef = doc(db, 'properties', propId);
      const propSnap = await getDoc(propRef);
      if (!propSnap.exists()) continue;

      const prop = propSnap.data();
      const { latitude, longitude } = prop;
      if (!latitude || !longitude) continue;

      // Fetch weather forecast (open-meteo API)
      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_min,precipitation_sum&timezone=auto`
      );
      const weather = await weatherRes.json();

      if (!weather.daily) continue;

      // Check next 3 days for frost (temp < 0°C)
      for (let i = 0; i < Math.min(3, weather.daily.time.length); i++) {
        const minTemp = weather.daily.temperature_2m_min[i];
        if (minTemp < 0) {
          // Get plants in this property to find frost-sensitive ones
          const plantsQ = query(
            collection(db, 'user_plants'),
            where('propertyId', '==', propId)
          );
          const plantSnap = await getDocs(plantsQ);
          const plants = plantSnap.docs.map(d => d.data());

          // Filter plants with low frost hardiness
          const affected = plants
            .filter(p => {
              const hardiness = p.frostHardiness || -15; // Default safe
              return hardiness > minTemp; // Plant will freeze
            })
            .map(p => p.name);

          if (affected.length > 0) {
            alerts.push({
              zone: prop.name || `Proprietate ${propId}`,
              date: weather.daily.time[i],
              minTemp: Math.round(minTemp * 10) / 10,
              affectedPlants: affected,
            });
          }
        }
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ alerts }),
    };
  } catch (err) {
    console.error('Frost alert check error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err) }),
    };
  }
};

export { handler };
