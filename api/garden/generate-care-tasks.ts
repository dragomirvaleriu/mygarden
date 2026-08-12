import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    // 1. Get all plants in user's garden
    const gardenSnap = await db.collection('user_plants').where('userId', '==', userId).get();

    if (gardenSnap.empty) {
      return res.status(200).json({ generated: 0, message: 'No plants in garden' });
    }

    // 2. Fetch plant manifest (catalog metadata) from disk
    let plantLookup: { [key: string]: any } = {};
    try {
      const manifest = require('../../../content/garden/plant-manifest.json');
      plantLookup = manifest.reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});
    } catch {
      // Manifest not yet built, skip task generation for now
      return res.status(200).json({ generated: 0, message: 'Plant manifest not available' });
    }

    // 3. For each plant, generate care tasks
    const plantsToAdd = new Map<string, any>();

    gardenSnap.forEach(gardenDoc => {
      const { catalogId, name, emoji } = gardenDoc.data();
      const plantMeta = plantLookup[catalogId];

      if (!plantMeta) return;

      // Generate watering task (weekly for plants that need water)
      if (plantMeta.watering) {
        const waterKey = `water_${catalogId}`;
        if (!plantsToAdd.has(waterKey)) {
          plantsToAdd.set(waterKey, {
            userId,
            catalogId,
            plantName: name,
            emoji,
            taskType: 'watering',
            description: `Udă ${name}`,
            frequency: 'weekly',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }

      // Generate pruning task (seasonal spring)
      if (plantMeta.pruningTime) {
        const pruneKey = `prune_${catalogId}`;
        if (!plantsToAdd.has(pruneKey)) {
          plantsToAdd.set(pruneKey, {
            userId,
            catalogId,
            plantName: name,
            emoji,
            taskType: 'pruning',
            description: `Taie ${name}`,
            frequency: 'seasonal',
            season: 'spring',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });

    // 4. Write to garden_tasks collection
    let written = 0;
    const tasksRef = db.collection('garden_tasks');

    for (const task of plantsToAdd.values()) {
      try {
        await tasksRef.add(task);
        written++;
      } catch (err) {
        console.error('Error adding task:', err);
      }
    }

    res.status(200).json({ generated: written, total: plantsToAdd.size });
  } catch (err: any) {
    console.error('Generate tasks error:', err);
    res.status(500).json({ error: err.message });
  }
}
