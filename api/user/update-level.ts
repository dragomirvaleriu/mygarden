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

// Level progression: 100 XP per level (level 1 = 0-99 XP, level 2 = 100-199, etc.)
function calculateLevel(totalExp: number): number {
  return Math.floor(totalExp / 100) + 1;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userSnap.data() || {};
    const currentExp = userData.exp || 0;
    const newLevel = calculateLevel(currentExp);

    // Only write if level changed
    if (userData.level !== newLevel) {
      await userRef.update({ level: newLevel });
    }

    res.status(200).json({ userId, exp: currentExp, level: newLevel, updated: userData.level !== newLevel });
  } catch (err: any) {
    console.error('Update level error:', err);
    res.status(500).json({ error: err.message });
  }
}
