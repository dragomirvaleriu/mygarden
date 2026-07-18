import { collection, doc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, db } from '../firebase';

export interface PublicAlert {
  id?: string;
  diseaseType: string;
  lat: number;
  lng: number;
  anonymousId: string;
  timestamp?: any;
}

const COLLECTION_NAME = 'publicAlerts';

export const alertService = {
  subscribeToRecentAlerts: (days: number, callback: (alerts: PublicAlert[]) => void) => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() - days);
    
    // We ideally need an index on timestamp to use where('timestamp', '>=', minDate) 
    // Since this is a simple mock implementation, we fetch all ordered by timestamp and filter client-side 
    // or just fetch all and rely on the client for now if index is missing.
    // For production, create a composite index in Firestore.
    const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'));
    
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PublicAlert));
      // Filter last 7 days locally to avoid complex index requirements right now
      const recent = data.filter(a => {
        if (!a.timestamp) return true; // optimistic local update
        const alertDate = a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
        return alertDate >= minDate;
      });
      callback(recent);
    });
  },

  reportAlert: async (alert: Omit<PublicAlert, 'id' | 'timestamp'>) => {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...alert,
      timestamp: serverTimestamp()
    });
  }
};
