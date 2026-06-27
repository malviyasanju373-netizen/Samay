import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Clipboard, Animated, PanResponder, Pressable, LayoutChangeEvent
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { auth } from '@/firebase';
import { useGroupChat } from '@/hooks/useGroupChat';
import { useTheme } from '@/context/ThemeContext';
import { formatMessageTimestamp } from '@/utils/timeFormat';
import { ReplyTo } from '@/services/chat';

const INPUT_BAR_HEIGHT = 56;
const MENU_ITEM_HEIGHT = 50;
const MENU_BORDER_RADIUS = 16;
const SWIPE_THRESHOLD = 50;
const SIGNIFICANT_GAP_MS = 10 * 60 * 1000;

function toMillis(value: any): number {
  if (typeof value?.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  return NaN;
}

function getDateLabel(timestamp: any): string | null {
  try {
    const ms = toMillis(timestamp);
    if (!Number.isFinite(ms)) return null;
    const date = new Date(ms);
    const now = new Date();
    const dateStr = date.toLocaleDateString();
    const todayStr = now.toLocaleDateString();
    if (dateStr === todayStr) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === yesterday.toLocaleDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return null;
  }
}

interface DateSeparatorItem {
  _type: 'dateSeparator';
  id: string;
  label: string;
}

type ListItem = any | DateSeparatorItem;

function buildListData(messages: any[]): ListItem[] {
  const result: ListItem[] = [];
  let lastDateStr = '';
  for (const msg of messages) {
    const label = getDateLabel(msg.createdAt);
    if (label) {
      const dateStr = new Date(toMillis(msg.createdAt)).toLocaleDateString();
      if (dateStr !== lastDateStr) {
        lastDateStr = dateStr;
        result.push({ _type: 'dateSeparator', id: `sep-${msg.id}`, label });
      }
    }
    result.push(msg);
  }
  return result;
}

function MessageItem({
  item,
  isOwn,
  showSenderName,
  onLongPress,
  onSwipeReply,
  onReplyTap,
  onItemLayout,
  highlightedId,
  highlightAnim,
  s,
  formatTime,
  renderReplyPreview,
}: {
  item: any;
  isOwn: boolean;
  showSenderName: boolean;
  onLongPress: (item: any) => void;
  onSwipeReply: (item: any) => void;
  onReplyTap: (messageId: string) => void;
  onItemLayout?: (id: string, height: number) => void;
  highlightedId?: string | null;
  highlightAnim?: Animated.Value;
  s: any;
  formatTime: (ts: any) => string;
  renderReplyPreview: (replyTo: any, isOwn: boolean, onPress?: () => void) => React.ReactNode;
}) {
  const panX = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) {
          panX.setValue(Math.min(gesture.dx, 100));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          onSwipeReply(item);
        }
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 10,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View style={{ transform: [{ translateX: panX }] }} {...panResponder.panHandlers}>
      <TouchableOpacity
        activeOpacity={0.7}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
        style={[s.messageRow, isOwn ? s.messageRowRight : s.messageRowLeft]}
        onLayout={(e) => onItemLayout?.(item.id, e.nativeEvent.layout.height)}
      >
        {showSenderName && <Text style={s.senderName}>{item.senderName}</Text>}
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          {highlightedId === item.id && highlightAnim ? (
            <Animated.View
              style={[
                s.highlightOverlay,
                { opacity: highlightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) },
              ]}
              pointerEvents="none"
            />
          ) : null}
          {item.replyTo ? renderReplyPreview(item.replyTo, isOwn, () => onReplyTap(item.replyTo.messageId)) : null}
          <Text style={[s.messageText, isOwn ? s.messageTextOwn : s.messageTextOther]}>
            {item.text}
          </Text>
          <Text style={[s.timeText, isOwn ? s.timeTextOwn : s.timeTextOther]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function GroupChatScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const groupId = typeof route?.params?.groupId === 'string' ? route.params.groupId : '';
  const groupName = route?.params?.groupName || 'Group Chat';
  const currentUid = auth()?.currentUser?.uid ?? null;

  const { messages, loading, error, sendMessage } = useGroupChat(groupId);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyTo | null>(null);
  const [actionItem, setActionItem] = useState<any>(null);
  const [composerHeight, setComposerHeight] = useState(INPUT_BAR_HEIGHT);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const viewabilityRef = useRef({ firstVisibleIndex: 0, lastVisibleIndex: 0 });
  const heightsRef = useRef<Map<string, number>>(new Map());
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const listData = useMemo(() => buildListData(messages), [messages]);
  const s = useMemo(() => createStyles(theme), [theme]);

  const handleItemLayout = useCallback((id: string, height: number) => {
    if (height > 0) {
      heightsRef.current.set(id, height);
    }
  }, []);

  const getItemLayout = useCallback((_: any, index: number) => {
    const item = listData[index];
    if (!item) return { length: 0, offset: 0, index };
    
    let offset = 0;
    for (let i = 0; i < index; i++) {
      const prev = listData[i];
      offset += heightsRef.current.get(prev.id) ?? (prev._type === 'dateSeparator' ? 36 : 80);
    }
    
    const length = heightsRef.current.get(item.id) ?? (item._type === 'dateSeparator' ? 36 : 80);
    return { length, offset, index };
  }, [listData]);

  const actionMenuOpen = actionItem !== null;
  const isReplyScrollingRef = useRef(false);

  const openActionMenu = useCallback((item: any) => {
    setActionItem(item);
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  const closeActionMenu = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setActionItem(null));
  }, [slideAnim, fadeAnim]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || !groupId || !currentUid) return;
    setSending(true);
    try {
      await sendMessage(inputText.trim(), replyingTo);
      setInputText('');
      setReplyingTo(null);
    } catch (err) {}
    setSending(false);
  }, [inputText, groupId, currentUid, sendMessage, replyingTo]);

  const formatTime = useCallback((timestamp: any) => {
    return formatMessageTimestamp(timestamp);
  }, []);

  const startReply = useCallback((item: any) => {
    if (!item) return;
    setReplyingTo({
      messageId: item.id,
      senderId: item.senderId,
      senderName: item.senderName || 'User',
      text: item.text || '',
    });
  }, []);

  const copyMessage = useCallback((text: string) => {
    Clipboard.setString(text);
  }, []);

  const handleLongPress = useCallback((item: any) => {
    if (!item) return;
    openActionMenu(item);
  }, [openActionMenu]);

  const handleReplyAction = useCallback(() => {
    if (!actionItem) return;
    startReply(actionItem);
    closeActionMenu();
  }, [actionItem, startReply, closeActionMenu]);

  const handleCopyAction = useCallback(() => {
    if (!actionItem) return;
    copyMessage(actionItem.text || '');
    closeActionMenu();
  }, [actionItem, copyMessage, closeActionMenu]);

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, []);

  const handleComposerLayout = useCallback((event: LayoutChangeEvent) => {
    const nextHeight = event.nativeEvent.layout.height;
    setComposerHeight((currentHeight) =>
      Math.abs(currentHeight - nextHeight) > 1 ? nextHeight : currentHeight
    );
  }, []);

  const handleReplyTap = useCallback((messageId: string) => {
    console.log('[ReplyTap] Reply preview pressed with messageId:', messageId);
    console.log('[ReplyTap] listData length:', listData.length);
    console.log('[ReplyTap] FlatList ref exists:', !!flatListRef.current);
    
    const idx = listData.findIndex((item: any) => !item._type && item.id === messageId);
    console.log('[ReplyTap] Found index:', idx);
    
    if (idx >= 0) {
      const foundItem = listData[idx];
      console.log('[ReplyTap] Found item id:', foundItem?.id);
      console.log('[ReplyTap] Found item text:', foundItem?.text?.substring?.(0, 50));
      console.log('[ReplyTap] Item._type:', foundItem?._type);
      
      console.log('Target index:', idx);
      console.log('Visible first index:', viewabilityRef.current.firstVisibleIndex);
      console.log('Visible last index:', viewabilityRef.current.lastVisibleIndex);
      const alreadyVisible = idx >= viewabilityRef.current.firstVisibleIndex && idx <= viewabilityRef.current.lastVisibleIndex;
      console.log('Target already visible:', alreadyVisible);
      
      // Disable auto-scroll during reply navigation
      isReplyScrollingRef.current = true;
      setTimeout(() => { isReplyScrollingRef.current = false; }, 1000);
      
      console.log('Before reply scroll');
      try {
        // Use scrollToItem with the actual item object instead of scrollToIndex
        (flatListRef.current as any)?.scrollToItem({ item: foundItem, animated: true, viewPosition: 0.5 });
        console.log('After reply scroll');
        
        // Trigger highlight animation on the target message
        setHighlightedId(foundItem.id);
        highlightAnim.setValue(1);
        Animated.timing(highlightAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }).start(() => setHighlightedId(null));
      } catch (error) {
        console.log('[ReplyTap] scrollToItem threw error:', error);
      }
    } else {
      console.log('[ReplyTap] ID MISMATCH: Searching listData for matching ids...');
      for (let i = 0; i < Math.min(listData.length, 10); i++) {
        const item = listData[i];
        if (!item._type) {
          console.log(`[ReplyTap] listData[${i}] id="${item.id}" type="${typeof item.id}" === target="${messageId}" type="${typeof messageId}" -> ${item.id === messageId}`);
        }
      }
    }
  }, [listData]);

  const renderReplyPreview = useCallback((replyTo: ReplyTo | null, isOwn: boolean, onPress?: () => void) => {
    if (replyTo) {
      console.log('[ReplyPreview] Rendering with messageId:', replyTo.messageId, 'has onPress:', !!onPress);
    }
    if (!replyTo) return null;
    const isReplyingToOwn = replyTo.senderId === currentUid;
    const content = (
      <View style={[s.replyPreviewContainer, isOwn ? s.replyPreviewOwn : s.replyPreviewOther]}>
        <View style={s.replyPreviewBar} />
        <View style={s.replyPreviewContent}>
          <Text
            style={[s.replyPreviewSender, isOwn ? s.replyPreviewSenderOwn : s.replyPreviewSenderOther]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {isReplyingToOwn ? 'You' : replyTo.senderName}
          </Text>
          <Text
            style={[s.replyPreviewText, isOwn ? s.replyPreviewTextOwn : s.replyPreviewTextOther]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {replyTo.text}
          </Text>
        </View>
      </View>
    );
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          onStartShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          {content}
        </Pressable>
      );
    }
    return content;
  }, [currentUid, s]);

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    if (item._type === 'dateSeparator') {
      return (
        <View
          style={s.dateSeparator}
          onLayout={(e) => handleItemLayout(item.id, e.nativeEvent.layout.height)}
        >
          <View style={s.dateSeparatorLine} />
          <Text style={s.dateSeparatorText}>{item.label}</Text>
          <View style={s.dateSeparatorLine} />
        </View>
      );
    }

    const isOwn = item.senderId === currentUid;
    const prevItem = index > 0 ? listData[index - 1] : null;
    const prevIsMessage = prevItem && !prevItem._type;
    const sameSender = prevIsMessage && prevItem.senderId === item.senderId;
    let showSenderName = false;
    if (!isOwn) {
      if (!sameSender) {
        showSenderName = true;
      } else {
        const prevMs = toMillis(prevItem.createdAt);
        const currMs = toMillis(item.createdAt);
        if (Number.isFinite(prevMs) && Number.isFinite(currMs)) {
          if (currMs - prevMs > SIGNIFICANT_GAP_MS) {
            showSenderName = true;
          }
        }
      }
    }

    return (
      <MessageItem
        item={item}
        isOwn={isOwn}
        showSenderName={showSenderName}
        onLongPress={handleLongPress}
        onSwipeReply={startReply}
        onReplyTap={handleReplyTap}
        onItemLayout={handleItemLayout}
        highlightedId={highlightedId}
        highlightAnim={highlightAnim}
        s={s}
        formatTime={formatTime}
        renderReplyPreview={renderReplyPreview}
      />
    );
  }, [currentUid, s, formatTime, handleLongPress, renderReplyPreview, startReply, listData, handleReplyTap, handleItemLayout, highlightedId, highlightAnim]);

  const menuTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  const menuItems = [
    { icon: 'return-up-back', label: 'Reply', action: handleReplyAction },
    { icon: 'copy-outline', label: 'Copy', action: handleCopyAction },
  ];

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
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
    <View style={{ flex: 1 }}>
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>{groupName}</Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.keyboardAvoid}
        >
          <View style={s.chatBody}>
            <FlatList
              ref={flatListRef as any}
              data={listData}
              keyExtractor={(item: any) => item._type === 'dateSeparator' ? item.id : item.id}
              renderItem={renderItem}
              style={s.messages}
              contentContainerStyle={[s.messagesList, { paddingBottom: composerHeight }]}
              getItemLayout={getItemLayout}
              onViewableItemsChanged={({ viewableItems }) => {
                if (viewableItems.length > 0) {
                  const indices = viewableItems
                    .filter(v => v.isViewable)
                    .map(v => v.index)
                    .filter(i => i !== null && i !== undefined);
                  if (indices.length > 0) {
                    viewabilityRef.current = {
                      firstVisibleIndex: Math.min(...indices),
                      lastVisibleIndex: Math.max(...indices),
                    };
                  }
                }
              }}
              viewabilityConfig={{
                itemVisiblePercentThreshold: 50,
                minimumViewTime: 100,
              }}
              onContentSizeChange={() => {
                console.log('onContentSizeChange fired');
                if (listData.length > 0 && !isReplyScrollingRef.current) {
                  try {
                    flatListRef.current?.scrollToEnd({ animated: false });
                  } catch {}
                }
              }}
              ListEmptyComponent={() => (
                <View style={s.emptyContainer}>
                  <Text style={s.emptyText}>No messages yet. Start the conversation!</Text>
                </View>
              )}
            />

            <View style={s.composer} onLayout={handleComposerLayout}>
              {replyingTo && (
                <View style={[s.replyBar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
                  <View style={s.replyBarIndicator} />
                  <View style={s.replyBarContent}>
                    <Text style={[s.replyBarSender, { color: theme.colors.primary }]} numberOfLines={1}>
                      Replying to {replyingTo.senderId === currentUid ? 'You' : replyingTo.senderName}
                    </Text>
                    <Text style={[s.replyBarText, { color: theme.colors.textTertiary }]} numberOfLines={1}>
                      {replyingTo.text}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={cancelReply} style={s.replyBarClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={20} color={theme.colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}

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
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {actionMenuOpen && (
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]} pointerEvents="box-none">
          <TouchableOpacity style={s.backdropTouchable} activeOpacity={1} onPress={closeActionMenu}>
            <View style={{ flex: 1 }} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {actionMenuOpen && (
        <Animated.View
          style={[
            s.menuContainer,
            { transform: [{ translateY: menuTranslateY }], paddingBottom: insets.bottom + 8 },
          ]}
        >
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                s.menuItem,
                index === 0 && { borderTopLeftRadius: MENU_BORDER_RADIUS, borderTopRightRadius: MENU_BORDER_RADIUS },
                index === menuItems.length - 1 && { borderBottomLeftRadius: MENU_BORDER_RADIUS, borderBottomRightRadius: MENU_BORDER_RADIUS },
                index < menuItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
              ]}
              activeOpacity={0.6}
              onPress={item.action}
            >
              <Ionicons name={item.icon as any} size={22} color={theme.colors.text} style={{ marginRight: 14 }} />
              <Text style={[s.menuItemLabel, { color: theme.colors.text }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  keyboardAvoid: { flex: 1 },
  chatBody: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: theme.colors.card },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  messages: { flex: 1 },
  messagesList: { paddingHorizontal: 8, paddingTop: 2 },
  messageRow: { marginBottom: 2, maxWidth: '80%' },
  messageRowLeft: { alignSelf: 'flex-start' },
  messageRowRight: { alignSelf: 'flex-end' },
  senderName: { fontSize: 11, color: theme.colors.primary, marginBottom: 1, fontWeight: '600' },
  bubble: { borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, maxWidth: '100%', overflow: 'hidden' },
  bubbleOwn: { backgroundColor: theme.colors.primary },
  bubbleOther: { backgroundColor: theme.colors.card },
  messageText: { fontSize: 15, lineHeight: 19 },
  messageTextOwn: { color: '#fff' },
  messageTextOther: { color: theme.colors.text },
  timeText: { fontSize: 10, marginTop: 1, alignSelf: 'flex-end', letterSpacing: 0.2 },
  timeTextOwn: { color: 'rgba(255,255,255,0.5)' },
  timeTextOther: { color: theme.colors.textTertiary, opacity: 0.7 },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    paddingHorizontal: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  dateSeparatorText: {
    fontSize: 11,
    color: theme.colors.textTertiary,
    marginHorizontal: 12,
    fontWeight: '500',
  },

  // Reply preview inside bubble
  replyPreviewContainer: {
    flexDirection: 'row',
  },
  replyPreviewOwn: {},
  replyPreviewOther: {},
  replyPreviewBar: {
    width: 2,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
    marginRight: 4,
    flexShrink: 0,
    opacity: 0.7,
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewSender: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 0,
  },
  replyPreviewSenderOwn: { color: 'rgba(255,255,255,0.85)' },
  replyPreviewSenderOther: { color: theme.colors.primary },
  replyPreviewText: {
    fontSize: 11,
    lineHeight: 13,
  },
  replyPreviewTextOwn: { color: 'rgba(255,255,255,0.55)' },
  replyPreviewTextOther: { color: theme.colors.textTertiary, opacity: 0.7 },

  // Reply bar above input
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBarIndicator: {
    width: 2,
    height: 20,
    backgroundColor: theme.colors.primary,
    borderRadius: 1,
    marginRight: 8,
    opacity: 0.7,
  },
  replyBarContent: {
    flex: 1,
  },
  replyBarSender: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 0,
  },
  replyBarText: {
    fontSize: 11,
    lineHeight: 13,
  },
  replyBarClose: {
    padding: 4,
    marginLeft: 8,
  },

  composer: {
    backgroundColor: theme.colors.background,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: theme.colors.background,
    alignItems: 'flex-end',
  },
  textInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 6, maxHeight: 80, fontSize: 15, backgroundColor: theme.colors.surface },
  sendBtn: { marginLeft: 8, backgroundColor: theme.colors.primary, borderRadius: 18, width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: theme.colors.textTertiary, fontSize: 14 },

  // Action menu styles
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 100,
  },
  backdropTouchable: {
    flex: 1,
  },
  menuContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    backgroundColor: theme.colors.card,
    borderRadius: MENU_BORDER_RADIUS,
    zIndex: 101,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    height: MENU_ITEM_HEIGHT,
  },
  menuItemLabel: {
    fontSize: 16,
  },
  highlightOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFE082',
    borderRadius: 16,
  },
});
