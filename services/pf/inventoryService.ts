import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, getDocs, onSnapshot, serverTimestamp, db } from '../firebase';

export interface InventoryItem {
  id?: string;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  price: number;
  npk?: { n: number; p: number; k: number };
  uid: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'pf_products';

export const inventoryService = {
  subscribeToInventory: (uid: string, callback: (items: InventoryItem[]) => void) => {
    if (!uid) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
      callback(data);
    });
  },

  addProduct: async (uid: string, item: Omit<InventoryItem, 'id' | 'uid' | 'createdAt'>) => {
    if (!uid) throw new Error('Unauthorized');
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...item,
      uid,
      createdAt: serverTimestamp()
    });
  },

  updateProduct: async (id: string, updates: Partial<InventoryItem>) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, updates);
  },

  deleteProduct: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  }
};
