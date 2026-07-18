
import { initializeApp } from "firebase/app";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc as originalUpdateDoc, 
  addDoc as originalAddDoc, 
  query, 
  getDocs,
  getDocsFromServer,
  where,
  orderBy,
  limit,
  writeBatch as originalWriteBatch,
  deleteDoc as originalDeleteDoc,
  deleteField,
  setDoc as originalSetDoc,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  arrayUnion,
  Timestamp,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager
} from "firebase/firestore";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
} from "firebase/auth";
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL,
  deleteObject,
  listAll
} from "firebase/storage";
import { logger } from './logger';
import firebaseConfig from '../firebase-applet-config.json';

console.log("Firebase: Initializing with config", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
import { Capacitor } from '@capacitor/core';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Initialize Firestore with modern, robust multi-tab offline persistence (fixes HMR b815 / ca9 assertions)
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: (Capacitor.isNativePlatform() || isMobile) ? persistentSingleTabManager({ forceOwnership: false }) : persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId);

const auth = getAuth(app);
const storage = getStorage(app);
console.log("Firebase: Services initialized");

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
    // Skip logging for other errors, as this is simply a connection test.
  }
}
testConnection();

const logout = async () => {
  localStorage.removeItem('ls_pass');
  // We keep ls_email if the user wants to be remembered, but ls_pass must go to stop auto-login
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error during signOut:", error);
  }
};

// Helper functions to clean undefined values recursively, preserving Firestore/custom instances
function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function cleanUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (isPlainObject(obj)) {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanUndefined(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// No API proxy interceptors needed; export original Firestore functions directly for instant updates.
const addDoc = originalAddDoc;
const updateDoc = originalUpdateDoc;
const setDoc = originalSetDoc;
const deleteDoc = originalDeleteDoc;
const writeBatch = originalWriteBatch;

export { 
  db, 
  auth,
  storage,
  logout,
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc, 
  query, 
  getDocs, 
  where, 
  orderBy, 
  limit, 
  writeBatch, 
  deleteDoc, 
  deleteField,
  setDoc, 
  getDoc, 
  getDocFromServer,
  serverTimestamp, 
  arrayUnion,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  Timestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
};
