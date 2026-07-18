import { db, OperationType, handleFirestoreError, doc, getDoc, setDoc, updateDoc } from './firebase';

export interface UserSettings {
  userId: string;
  themeDesktop: string;
  themeMobile: string;
  accentColorDesktop?: string;
  accentColorMobile?: string;
  galleryViewMode?: 'grid' | 'masonry';
}

export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const path = `user_settings/${userId}`;
  try {
    const docRef = doc(db, 'user_settings', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserSettings;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const updateUserSettings = async (userId: string, settings: Partial<UserSettings>) => {
  const path = `user_settings/${userId}`;
  try {
    const docRef = doc(db, 'user_settings', userId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      await updateDoc(docRef, settings);
    } else {
      await setDoc(docRef, { userId, ...settings });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};
