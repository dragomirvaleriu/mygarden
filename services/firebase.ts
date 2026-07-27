
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
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager
} from "firebase/firestore";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type Auth
} from "firebase/auth";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from "firebase/storage";
import {
  getFunctions,
  httpsCallable
} from "firebase/functions";
import { logger } from './logger';
import firebaseConfig from '../firebase-applet-config.json';

console.log("Firebase: Initializing with config", firebaseConfig.projectId);
const app = initializeApp(firebaseConfig);
import { Capacitor } from '@capacitor/core';

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// ─────────────────────────────────────────────────────────────
// Firestore cache selection
//
// With persistence enabled every write is committed to IndexedDB *before* it
// is sent, so a broken IndexedDB doesn't merely cost us the offline cache — it
// fails the write itself:
//   "Failed to persist write: IndexedDbTransactionError [code=unavailable]:
//    IndexedDB transaction 'Locally write mutations' failed: AbortError"
// iOS Safari aborts IndexedDB transactions under memory pressure (many open
// tabs, low battery), in Private Browsing, and inside the in-app WKWebView
// browsers (WhatsApp, Instagram, Facebook). Offline caching is a nice-to-have;
// being able to save is not. So: skip persistence where it can't be trusted,
// remember that decision across reloads, and recover if it fails anyway.
// ─────────────────────────────────────────────────────────────
const MEMORY_CACHE_KEY = 'mg_firestore_memory_cache';
const RECOVERY_ATTEMPT_KEY = 'mg_firestore_cache_recovery';

function indexedDbAvailable(): boolean {
  try {
    // Sandboxed iframes and locked-down WebViews throw on property access
    // rather than reporting the API as undefined.
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function memoryCacheForced(): boolean {
  try {
    return localStorage.getItem(MEMORY_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Firestore errors that mean "the local IndexedDB cache is unusable". */
export function isPersistenceError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase();
  return message.includes('indexeddbtransactionerror')
    || message.includes('failed to persist write')
    || message.includes('indexeddb transaction')
    || message.includes('exclusive access to the persistence layer');
}

/**
 * Drop back to the in-memory cache and tell the caller to reload. Returns
 * false if we already tried this in the current session, so a device that
 * keeps failing can never be caught in a reload loop.
 */
export function recoverFromPersistenceError(): boolean {
  try {
    if (sessionStorage.getItem(RECOVERY_ATTEMPT_KEY) === '1') return false;
    sessionStorage.setItem(RECOVERY_ATTEMPT_KEY, '1');
    localStorage.setItem(MEMORY_CACHE_KEY, '1');
  } catch {
    // No storage at all (hard Private Browsing) — a reload would just repeat
    // the same failure, so don't promise the caller a recovery.
    return false;
  }
  // Best effort: drop the corrupted cache so the next boot starts clean. The
  // request may stay blocked behind our own open connection, and the exact
  // internal name has shifted across SDK versions, so we try the known
  // patterns and swallow failures either way — we reload regardless, and the
  // memory-cache flag means we never touch IndexedDB again after that.
  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  for (const name of [
    `firestore/[DEFAULT]/${firebaseConfig.projectId}.${dbId}/main`,
    `firestore/[DEFAULT]/${firebaseConfig.projectId}/main`
  ]) {
    try { indexedDB.deleteDatabase(name); } catch { /* nothing we can do */ }
  }
  return true;
}

const usePersistentCache = !import.meta.env.DEV && indexedDbAvailable() && !memoryCacheForced();

// In dev, Vite HMR re-runs this module without releasing the previous IndexedDB
// persistence lock, which is what causes the b815/ca9 internal assertion crashes.
// Persistent cache is only safe to enable in production builds.
const db = usePersistentCache
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        // forceOwnership on mobile: a phone with a stale duplicate tab of the
        // app would otherwise never get the lease, and every write would fail
        // with "failed to obtain exclusive access".
        tabManager: (Capacitor.isNativePlatform() || isMobile)
          ? persistentSingleTabManager({ forceOwnership: true })
          : persistentMultipleTabManager()
      })
    }, firebaseConfig.firestoreDatabaseId)
  : initializeFirestore(app, { localCache: memoryLocalCache() }, firebaseConfig.firestoreDatabaseId);

console.log(`Firebase: Firestore cache = ${usePersistentCache ? 'persistent (IndexedDB)' : 'memory'}`);

// Safety net for writes anywhere else in the app (journal, calendar, settings…):
// if the cache blows up we switch to memory mode and reload once.
if (typeof window !== 'undefined' && usePersistentCache) {
  window.addEventListener('unhandledrejection', (event) => {
    if (!isPersistenceError(event.reason)) return;
    console.warn('Firestore: local cache unusable, switching to in-memory cache', event.reason);
    if (recoverFromPersistenceError()) window.location.reload();
  });
}

// Auth session storage: localStorage first. iOS Safari evicts IndexedDB far
// more readily than localStorage, and a session lost mid-onboarding is what
// makes people report "login is broken".
let auth: Auth;
try {
  auth = initializeAuth(app, {
    persistence: [browserLocalPersistence, indexedDBLocalPersistence, inMemoryPersistence],
    popupRedirectResolver: browserPopupRedirectResolver
  });
} catch {
  // Already initialised (HMR, or a duplicate import) — reuse that instance.
  auth = getAuth(app);
}
const storage = getStorage(app);
const functionsInstance = getFunctions(app);
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
  functionsInstance as functions,
  httpsCallable,
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
  sendPasswordResetEmail,
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
