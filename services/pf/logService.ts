import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, db } from '../firebase';

export interface TreatmentLog {
  id?: string;
  date: string; // ISO string
  zone: string;
  product: string;
  quantity: number;
  unit: string;
  cost: number;
  notes?: string;
  uid: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'pf_treatments';

export const logService = {
  subscribeToLogs: (uid: string, callback: (logs: TreatmentLog[]) => void) => {
    if (!uid) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TreatmentLog));
      callback(data);
    });
  },

  addLog: async (uid: string, log: Omit<TreatmentLog, 'id' | 'uid' | 'createdAt'>) => {
    if (!uid) throw new Error('Unauthorized');
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...log,
      uid,
      createdAt: serverTimestamp()
    });
  },

  deleteLog: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  }
};
