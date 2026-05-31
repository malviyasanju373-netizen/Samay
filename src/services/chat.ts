import firestore from '@react-native-firebase/firestore';
import { auth } from '@/firebase';

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  createdAt: firestore.Timestamp;
}

export async function sendMessage(
  groupId: string,
  text: string
): Promise<void> {
  const currentUser = auth()?.currentUser;
  if (!currentUser?.uid) {
    throw new Error('User must be authenticated to send messages');
  }

  const trimmedText = text.trim();
  if (!trimmedText) {
    throw new Error('Message cannot be empty');
  }

  const db = firestore();
  const messageRef = db
    .collection('groups')
    .doc(groupId)
    .collection('messages')
    .doc();

  await messageRef.set({
    text: trimmedText,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'User',
    senderPhotoURL: currentUser.photoURL || null,
    createdAt: firestore.FieldValue.serverTimestamp(),
  });
}

export function subscribeToMessages(
  groupId: string,
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!groupId) {
    onUpdate([]);
    return () => {};
  }

  try {
    const unsubscribe = firestore()
      .collection('groups')
      .doc(groupId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .onSnapshot(
        (snapshot) => {
          const messages = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ChatMessage[];
          onUpdate(messages);
        },
        (error) => {
          onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      );

    return unsubscribe;
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return () => {};
  }
}