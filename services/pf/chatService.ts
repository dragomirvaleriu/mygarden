import { collection, doc, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, db } from '../firebase';

export interface ChatMessage {
  id?: string;
  marketItemId: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'messages';

export const chatService = {
  subscribeToMessages: (marketItemId: string, callback: (msgs: ChatMessage[]) => void) => {
    if (!marketItemId) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('marketItemId', '==', marketItemId), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      callback(data);
    });
  },

  sendMessage: async (message: Omit<ChatMessage, 'id' | 'createdAt'>) => {
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...message,
      createdAt: serverTimestamp()
    });
  }
};
