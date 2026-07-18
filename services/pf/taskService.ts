import { collection, doc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp, db } from '../firebase';

export interface MaintenanceTask {
  id?: string;
  title: string;
  month: string;
  isCompleted: boolean;
  uid: string;
  createdAt?: any;
}

const COLLECTION_NAME = 'pf_tasks';

export const taskService = {
  subscribeToTasks: (uid: string, callback: (tasks: MaintenanceTask[]) => void) => {
    if (!uid) return () => {};
    const q = query(collection(db, COLLECTION_NAME), where('uid', '==', uid));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTask));
      callback(data);
    });
  },

  addTask: async (uid: string, task: Omit<MaintenanceTask, 'id' | 'uid' | 'createdAt'>) => {
    if (!uid) throw new Error('Unauthorized');
    return await addDoc(collection(db, COLLECTION_NAME), {
      ...task,
      uid,
      createdAt: serverTimestamp()
    });
  },

  toggleTaskStatus: async (id: string, isCompleted: boolean) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await updateDoc(docRef, { isCompleted });
  },

  deleteTask: async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    return await deleteDoc(docRef);
  }
};
