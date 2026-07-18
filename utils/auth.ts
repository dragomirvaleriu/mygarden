import admin from 'firebase-admin';

// Inițializare Firebase Admin dacă nu a fost deja inițializat
const apps = (admin as any).apps || [];
if (!apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'landscapeos-c3701'
  });
}
const db = admin.firestore();

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  organizationId?: string;
  role?: string;
  isSuperAdmin: boolean;
}

/**
 * Validează Firebase ID Token-ul primit în header-ul Authorization (Bearer token)
 * și returnează datele de profil ale utilizatorului autentificat, inclusiv tenancy-ul (organizationId).
 */
export async function verifyAuthentication(req: any): Promise<AuthenticatedUser> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Mising or invalid Authorization header');
  }

  const token = authHeader.split('Bearer ')[1];
  
  // 1. Verificăm validitatea tokenului în Firebase Auth
  const decodedToken = await admin.auth().verifyIdToken(token);
  const uid = decodedToken.uid;
  const email = decodedToken.email;

  // Verificăm dacă este Super Admin după adresa de email specificată
  const isSuperAdmin = email === 'dragomirvaleriu@gmail.com';

  // 2. Extragem datele de profil din Firestore pentru a afla tenancy-ul (organizationId) și rolul
  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists && !isSuperAdmin) {
    throw new Error('User profile does not exist in database');
  }

  const userData = userDoc.data() || {};
  return {
    uid,
    email,
    organizationId: userData.organizationId || undefined,
    role: userData.role || 'employee',
    isSuperAdmin
  };
}
