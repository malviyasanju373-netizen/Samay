import { initializeApp, FirebaseApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Auth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

console.log('[firebase] config keys present:', {
  apiKey:            !!firebaseConfig.apiKey,
  authDomain:        !!firebaseConfig.authDomain,
  projectId:         !!firebaseConfig.projectId,
  storageBucket:     !!firebaseConfig.storageBucket,
  messagingSenderId: !!firebaseConfig.messagingSenderId,
  appId:             !!firebaseConfig.appId,
});

let _app: FirebaseApp;
let _auth: Auth;
let _db: Firestore;

try {
  console.log('[firebase] calling initializeApp');
  _app = initializeApp(firebaseConfig as any);
  console.log('[firebase] initializeApp OK');
  _auth = initializeAuth(_app, { persistence: getReactNativePersistence(AsyncStorage) });
  console.log('[firebase] initializeAuth OK');
  _db = getFirestore(_app);
  console.log('[firebase] getFirestore OK');
} catch (e: any) {
  console.error('[firebase] INIT FAILED — app will run in degraded mode:', e?.message);
  // Do not re-throw: let the app mount so logs and the ErrorBoundary can show the error.
}

export const auth = _auth!;
export const db   = _db!;
