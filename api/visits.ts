import { visitSchema } from '../utils/validation';
import { verifyAuthentication } from '../utils/auth';
import admin from 'firebase-admin';

// Inițializare Firebase Admin dacă nu a fost deja inițializat
const apps = (admin as any).apps || [];
if (!apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'landscapeos-c3701'
  });
}
const db = admin.firestore();

export default async function handler(req: any, res: any) {
  // Permitem metodele POST (creare), PUT (actualizare/upsert) și DELETE (ștergere)
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Verificăm autentificarea utilizatorului și obținem profilul acestuia
    let user;
    try {
      user = await verifyAuthentication(req);
    } catch (authErr: any) {
      return res.status(401).json({ error: 'Unauthenticated', message: authErr.message });
    }

    const visitId = req.query.id || req.body.id;

    // --- TRATARE METODĂ DELETE ---
    if (req.method === 'DELETE') {
      if (!visitId) {
        return res.status(400).json({ error: 'Visit ID is required for deletion' });
      }

      const docRef = db.collection('visits').doc(visitId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        return res.status(404).json({ error: 'Visit not found' });
      }

      const data = docSnap.data();
      // Verificare multi-tenancy: utilizatorul trebuie să fie Super Admin sau să aparțină aceleiași organizații
      if (!user.isSuperAdmin && data?.organizationId !== user.organizationId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete this document' });
      }

      await docRef.delete();
      return res.status(200).json({ success: true, id: visitId });
    }

    // --- TRATARE METODE POST ȘI PUT (necesită validare de schemă) ---
    if (req.method === 'POST') {
      const validatedData = visitSchema.parse(req.body);

      // Verificarea securității multi-tenancy la scriere
      if (!user.isSuperAdmin && user.organizationId !== validatedData.organizationId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this organization\'s data' });
      }

      // Creare vizită nouă cu ID generat automat
      const payload: any = { ...validatedData };
      if (typeof payload.scheduledDate === 'string') {
        payload.scheduledDate = admin.firestore.Timestamp.fromDate(new Date(payload.scheduledDate));
      }
      if (typeof payload.currentSessionStart === 'string') {
        payload.currentSessionStart = admin.firestore.Timestamp.fromDate(new Date(payload.currentSessionStart));
      }
      if (typeof payload.completedAt === 'string') {
        payload.completedAt = admin.firestore.Timestamp.fromDate(new Date(payload.completedAt));
      }

      const docRef = await db.collection('visits').add({
        ...payload,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(201).json({ success: true, id: docRef.id });
    } else {
      // Metoda PUT (Actualizare sau Upsert prin setDoc)
      if (!visitId) {
        return res.status(400).json({ error: 'Visit ID is required for update/set' });
      }

      const docRef = db.collection('visits').doc(visitId);
      const docSnap = await docRef.get();

      if (!docSnap.exists) {
        // Logica UPSERT: Dacă documentul nu există (setDoc pentru creare), îl creăm cu ID-ul cerut
        const validatedData = visitSchema.parse(req.body);
        if (!user.isSuperAdmin && user.organizationId !== validatedData.organizationId) {
          return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this organization\'s data' });
        }
        const payload: any = { ...validatedData };
        if (typeof payload.scheduledDate === 'string') {
          payload.scheduledDate = admin.firestore.Timestamp.fromDate(new Date(payload.scheduledDate));
        }
        if (typeof payload.currentSessionStart === 'string') {
          payload.currentSessionStart = admin.firestore.Timestamp.fromDate(new Date(payload.currentSessionStart));
        }
        if (typeof payload.completedAt === 'string') {
          payload.completedAt = admin.firestore.Timestamp.fromDate(new Date(payload.completedAt));
        }
        await docRef.set({
          ...payload,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return res.status(201).json({ success: true, id: visitId, type: 'upsert_create' });
      }

      // Verificăm permisiunea pe documentul existent înainte de actualizare
      const existingData = docSnap.data();
      if (!user.isSuperAdmin && existingData?.organizationId !== user.organizationId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to modify this document' });
      }

      // Pentru documente existente, permitem actualizare parțială (ex: pornire/finalizare vizită)
      // Validăm/permitem orele de start/end exclusiv dacă vizita are statusul 'Finalizat' (scenariul de editare istoric)
      const isPastVisitEdit = req.body.status === 'Finalizat' || existingData?.status === 'Finalizat';
      let bodyToValidate = { ...req.body };
      if (!isPastVisitEdit) {
        delete bodyToValidate.oraInceput;
        delete bodyToValidate.oraSfarsit;
      }

      const validatedData = visitSchema.partial().parse(bodyToValidate);

      // Dacă se încearcă schimbarea organizației, verificăm accesul
      if (!user.isSuperAdmin && validatedData.organizationId && validatedData.organizationId !== user.organizationId) {
        return res.status(403).json({ error: 'Forbidden', message: 'You do not have access to this organization\'s data' });
      }

      const payload: any = { ...validatedData };
      if (typeof payload.scheduledDate === 'string') {
        payload.scheduledDate = admin.firestore.Timestamp.fromDate(new Date(payload.scheduledDate));
      }
      if (typeof payload.currentSessionStart === 'string') {
        payload.currentSessionStart = admin.firestore.Timestamp.fromDate(new Date(payload.currentSessionStart));
      }
      if (typeof payload.completedAt === 'string') {
        payload.completedAt = admin.firestore.Timestamp.fromDate(new Date(payload.completedAt));
      }

      await docRef.update({
        ...payload,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return res.status(200).json({ success: true, id: visitId, type: 'update' });
    }

  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    console.error("Visits API Error:", err);
    res.status(500).json({ error: err.message });
  }
}
