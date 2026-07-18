import { collection, doc, addDoc, query, where, onSnapshot, serverTimestamp, db, updateDoc, deleteDoc } from '../firebase';
import { InventoryItem } from './inventoryService';

export interface MarketItem {
  id?: string;
  sellerId: string;
  inventoryItemId: string;
  productDetails: InventoryItem;
  lat: number;
  lng: number;
  tradeType: 'sale' | 'trade';
  status: 'active' | 'sold' | 'withdrawn';
  createdAt?: any;
}

const COLLECTION_NAME = 'marketplace_items';

export const marketService = {
  subscribeToMarket: (callback: (items: MarketItem[]) => void) => {
    const q = query(collection(db, COLLECTION_NAME), where('status', '==', 'active'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MarketItem));
      callback(data);
    });
  },

  listItem: async (item: Omit<MarketItem, 'id' | 'createdAt'>) => {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...item,
      createdAt: serverTimestamp()
    });
  },
  
  updateItemStatus: async (id: string, status: MarketItem['status']) => {
    return await updateDoc(doc(db, COLLECTION_NAME, id), { status });
  }
};
