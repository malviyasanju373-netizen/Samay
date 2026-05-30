/**
 * React Native Firebase Initialization
 * 
 * IMPORTANT: Uses ONLY @react-native-firebase packages.
 * Auto-initializes from native Android config (google-services.json).
 * No web SDK, no manual initialization needed.
 * Single app instance guaranteed.
 */

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

console.log('[RNFirebase] Initializing...');

/**
 * Get current authenticated user UID
 */
export function getCurrentUserUid(): string | null {
  const user = auth().currentUser;
  const uid = user?.uid || null;
  
  if (uid) {
    console.log('[RNFirebase] Current user UID:', uid);
  } else {
    console.log('[RNFirebase] No authenticated user');
  }
  
  return uid;
}

/**
 * Safe Firestore listener with error handling
 * Returns unsubscribe function
 */
export function subscribeToDocument(
  collectionPath: string,
  docId: string,
  onSuccess: (data: any) => void,
  onError?: (error: Error) => void
): (() => void) | null {
  try {
    const uid = getCurrentUserUid();
    if (!uid) {
      const err = new Error('User must be authenticated to read Firestore');
      console.error('[RNFirebase] Document subscription failed:', err.message);
      onError?.(err);
      return null;
    }

    console.log(`[RNFirebase] Subscribing to ${collectionPath}/${docId}`);

    const unsubscribe = firestore()
      .collection(collectionPath)
      .doc(docId)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot.exists) {
            console.warn(`[RNFirebase] Document does not exist: ${collectionPath}/${docId}`);
            onSuccess(null);
            return;
          }

          console.log(`[RNFirebase] Snapshot received: ${collectionPath}/${docId}`, snapshot.data());
          onSuccess(snapshot.data());
        },
        (error) => {
          console.error(
            `[RNFirebase] Firestore error for ${collectionPath}/${docId}:`,
            (error as any).code,
            error.message
          );
          onError?.(error as Error);
        }
      );

    return unsubscribe;
  } catch (err: any) {
    console.error('[RNFirebase] Failed to subscribe to document:', err?.message);
    onError?.(err);
    return null;
  }
}

/**
 * Safe Firestore collection listener with error handling
 * Returns unsubscribe function
 */
export function subscribeToCollection(
  collectionPath: string,
  onSuccess: (docs: any[]) => void,
  onError?: (error: Error) => void
): (() => void) | null {
  try {
    const uid = getCurrentUserUid();
    if (!uid) {
      const err = new Error('User must be authenticated to read Firestore');
      console.error('[RNFirebase] Collection subscription failed:', err.message);
      onError?.(err);
      return null;
    }

    console.log(`[RNFirebase] Subscribing to collection: ${collectionPath}`);

    const unsubscribe = firestore()
      .collection(collectionPath)
      .onSnapshot(
        (snapshot) => {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          console.log(`[RNFirebase] Collection snapshot received: ${collectionPath}`, docs.length, 'docs');
          onSuccess(docs);
        },
        (error) => {
          console.error(
            `[RNFirebase] Firestore error for collection ${collectionPath}:`,
            (error as any).code,
            error.message
          );
          onError?.(error as Error);
        }
      );

    return unsubscribe;
  } catch (err: any) {
    console.error('[RNFirebase] Failed to subscribe to collection:', err?.message);
    onError?.(err);
    return null;
  }
}

/**
 * Safe Firestore sub-collection listener
 * Returns unsubscribe function
 */
export function subscribeToSubCollection(
  collectionPath: string,
  docId: string,
  subCollectionPath: string,
  onSuccess: (docs: any[]) => void,
  onError?: (error: Error) => void
): (() => void) | null {
  try {
    const uid = getCurrentUserUid();
    if (!uid) {
      const err = new Error('User must be authenticated to read Firestore');
      console.error('[RNFirebase] Sub-collection subscription failed:', err.message);
      onError?.(err);
      return null;
    }

    const fullPath = `${collectionPath}/${docId}/${subCollectionPath}`;
    console.log(`[RNFirebase] Subscribing to sub-collection: ${fullPath}`);

    const unsubscribe = firestore()
      .collection(collectionPath)
      .doc(docId)
      .collection(subCollectionPath)
      .onSnapshot(
        (snapshot) => {
          const docs = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

          console.log(`[RNFirebase] Sub-collection snapshot received: ${fullPath}`, docs.length, 'docs');
          onSuccess(docs);
        },
        (error) => {
          console.error(
            `[RNFirebase] Firestore error for sub-collection ${fullPath}:`,
            (error as any).code,
            error.message
          );
          onError?.(error as Error);
        }
      );

    return unsubscribe;
  } catch (err: any) {
    console.error('[RNFirebase] Failed to subscribe to sub-collection:', err?.message);
    onError?.(err);
    return null;
  }
}

export function requireFirestore() {
  return firestore();
}

export { auth, firestore };
