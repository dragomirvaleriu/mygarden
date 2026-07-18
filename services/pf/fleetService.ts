import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, db } from '../firebase';

export interface EquipmentItem {
  id?: string;
  name: string;
  lastServiceDate: string; // ISO string
  hoursOfUse: number;
  serviceIntervalHours: number;
  uid: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'pf_equipment';

export const fleetService = {
  subscribeToEquipment: (uid: string, callback: (items: EquipmentItem[]) => void) => {
    if (!uid) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EquipmentItem));
      callback(data);
    });
  },

  addEquipment: async (uid: string, item: Omit<EquipmentItem, 'id' | 'uid' | 'createdAt'>) => {
    if (!uid) throw new Error('Unauthorized');
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...item,
      uid,
      createdAt: serverTimestamp()
    });
  },

  updateEquipment: async (id: string, updates: Partial<EquipmentItem>) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, updates);
  },

  deleteEquipment: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  }
};
