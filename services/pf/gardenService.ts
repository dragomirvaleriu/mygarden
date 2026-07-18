import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, serverTimestamp, db } from '../firebase';

export interface GardenZone {
  id?: string;
  name: string;
  area: number;
  type: string;
  ph?: number;
  boundaryCoordinates?: { lat: number; lng: number }[];
  uid: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'pf_zones';

export const gardenService = {
  subscribeToZones: (uid: string, callback: (zones: GardenZone[]) => void) => {
    if (!uid) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GardenZone));
      callback(data);
    });
  },

  addZone: async (uid: string, zone: Omit<GardenZone, 'id' | 'uid' | 'createdAt'>) => {
    if (!uid) throw new Error('Unauthorized');
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...zone,
      uid,
      createdAt: serverTimestamp()
    });
  },

  updateZone: async (id: string, updates: Partial<GardenZone>) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, updates);
  },

  deleteZone: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  }
};
