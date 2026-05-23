import { getApp, getApps, initializeApp, FirebaseApp } from "firebase/app";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type Auth, getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const requiredConfigKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "storageBucket",
  "messagingSenderId",
  "appId",
] as const;

export const missingFirebaseConfigKeys = requiredConfigKeys.filter((key) => !firebaseConfig[key]);
export const isFirebaseConfigured = missingFirebaseConfigKeys.length === 0;

console.log("[firebase] config keys present:", {
  apiKey: !!firebaseConfig.apiKey,
  authDomain: !!firebaseConfig.authDomain,
  projectId: !!firebaseConfig.projectId,
  storageBucket: !!firebaseConfig.storageBucket,
  messagingSenderId: !!firebaseConfig.messagingSenderId,
  appId: !!firebaseConfig.appId,
});

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;
let _initError: string | null = null;

try {
  if (!isFirebaseConfigured) {
    _initError = `Missing Firebase config: ${missingFirebaseConfigKeys.join(", ")}`;
    console.warn(`[firebase] ${_initError}. App will run in signed-out mode.`);
  } else {
    _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    try {
      _auth = initializeAuth(_app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch (authError: any) {
      if (authError?.code !== "auth/already-initialized") throw authError;
      _auth = getAuth(_app);
    }
    _db = getFirestore(_app);
    console.log("[firebase] initialized");
  }
} catch (e: any) {
  _initError = e?.message ?? "Firebase initialization failed";
  console.error("[firebase] init failed; app will run in signed-out mode:", _initError);
}

export const firebaseInitError = _initError;
export const app = _app;
export const auth = _auth;
export const db = _db;

export function requireFirebaseAuth(): Auth {
  if (!_auth) throw new Error(firebaseInitError ?? "Firebase Auth is unavailable.");
  return _auth;
}

export function requireFirestore(): Firestore {
  if (!_db) throw new Error(firebaseInitError ?? "Firestore is unavailable.");
  return _db;
}
