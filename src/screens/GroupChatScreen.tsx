import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { auth } from '@/firebase';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useTheme } from '@/context/ThemeContext';
import { timestampToMillis } from '@/services/groups';

const INPUT_BAR_HEIGHT = 56;

export default function GroupChatScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const groupId = typeof route?.params?.groupId === 'string' ? route.params.groupId : '';
  const groupName = route?.params?.groupName || 'Group Chat';
  const currentUid = auth()?.currentUser?.uid ?? null;

  const { messages, loading, error, sendMessage } = useGroupChat(groupId);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const s = useMemo(() => createStyles(theme, insets), [theme, insets]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !groupId || !currentUid) return;
    setSending(true);
    try {
      await sendMessage(inputText.trim());
      setInputText('');
    } catch (err) {}
    setSending(false);
  }, [inputText, groupId, currentUid, sendMessage]);

  const formatTime = useCallback((timestamp: any) => {
    try {
      const date = timestampToMillis(timestamp);
      return new Date(date).toLocaleTimeString([], {
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return '';
    }
  }, []);

  const renderItem = useCallback(({ item }: any) => {
    const isOwn = item.senderId === currentUid;
    return (
      <View style={[s.messageRow, isOwn ? s.messageRowRight : s.messageRowLeft]}>
        {!isOwn && <Text style={s.senderName}>{item.senderName}</Text>}
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          <Text style={[s.messageText, isOwn ? s.messageTextOwn : s.messageTextOther]}>
            {item.text}
          </Text>
          <Text style={[s.timeText, isOwn ? s.timeTextOwn : s.timeTextOther]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  }, [currentUid, s, formatTime]);

  if (loading) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{groupName}</Text>
          <View style={{ width: 44 }} />
        </View>
        <ActivityIndicator color={theme.colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{groupName}</Text>
        <View style={{ width: 44 }} />
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={s.keyboardAvoid}
      >
        <FlatList
          ref={flatListRef as any}
          data={messages}
          keyExtractor={(item: any) => item.id}
          renderItem={renderItem}
          contentContainerStyle={s.messagesList}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              try {
                flatListRef.current?.scrollToIndex({
                  index: messages.length - 1,
                  animated: false
                });
              } catch {}
            }
          }}
          ListEmptyComponent={() => (
            <View style={s.emptyContainer}>
              <Text style={s.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          )}
        />

        <View style={s.inputContainer}>
          <TextInput
            style={[s.textInput, { backgroundColor: theme.colors.surface, color: theme.colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textTertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || sending) && s.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, insets: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardAvoid: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.card },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messagesList: { padding: 16, paddingBottom: INPUT_BAR_HEIGHT + 16 },
  messageRow: { marginBottom: 12, maxWidth: '80%' },
  messageRowLeft: { alignSelf: 'flex-start' },
  messageRowRight: { alignSelf: 'flex-end' },
  senderName: { fontSize: 12, color: theme.colors.textTertiary, marginBottom: 4 },
  bubble: { borderRadius: 12, padding: 12, maxWidth: '100%' },
  bubbleOwn: { backgroundColor: theme.colors.primary },
  bubbleOther: { backgroundColor: theme.colors.card },
  messageText: { fontSize: 16, lineHeight: 20 },
  messageTextOwn: { color: '#fff' },
  messageTextOther: { color: theme.colors.text },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeTextOwn: { color: 'rgba(255,255,255,0.7)' },
  timeTextOther: { color: theme.colors.textTertiary },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12 + insets.bottom,
    backgroundColor: theme.colors.background,
    alignItems: 'flex-end',
  },
  textInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 100, fontSize: 16 },
  sendBtn: { marginLeft: 8, backgroundColor: theme.colors.primary, borderRadius: 20, width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14 },
});