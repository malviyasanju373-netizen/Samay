import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import { auth } from '@/firebase';

export interface ReplyTo {
  messageId: string;
  senderId: string;
  senderName: string;
  text: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string | null;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  replyTo?: ReplyTo | null;
}

export async function sendMessage(
  groupId: string,
  text: string,
  replyTo?: ReplyTo | null
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

  const data: Record<string, any> = {
    text: trimmedText,
    senderId: currentUser.uid,
    senderName: currentUser.displayName || 'User',
    senderPhotoURL: currentUser.photoURL || null,
    createdAt: firestore.FieldValue.serverTimestamp(),
  };

  if (replyTo) {
    data.replyTo = {
      messageId: replyTo.messageId,
      senderId: replyTo.senderId,
      senderName: replyTo.senderName,
      text: replyTo.text,
    };
  }

  await messageRef.set(data);
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