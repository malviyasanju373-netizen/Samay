import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Ionicons from "@react-native-vector-icons/ionicons";
import { Alert, ActivityIndicator } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import { auth } from "@/firebase";
import { deleteGroup } from "@/services/groups";
import { useGroup } from "@/hooks/useGroup";
import { useGroupMembers } from "@/hooks/useGroupMembers";
import { Group, GroupLeaderboardEntry, GroupMember } from "@/types/group";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const dummyChat = [
  { id: "1", sender: "Member 1", text: "Hey team, ready for today?", time: "09:02" },
  { id: "2", sender: "Member 2", text: "Yes, let's focus on chapter 4.", time: "09:05" },
  { id: "3", sender: "Member 3", text: "I'm in!", time: "09:07" },
];

type GroupRoomTabProps = {
  navigation: any;
  route?: any;
  group: Group | null;
  members: GroupMember[];
  leaderboard: GroupLeaderboardEntry[];
  loading: boolean;
  error: string | null;
};

const formatStudyTime = (minutes: number) => {
  const safeMinutes = Math.max(0, Math.floor(minutes ?? 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins.toString().padStart(2, "0")}m`;
};

function SectionHeader({ title, theme }: { title: string; theme: any }) {
  return <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>;
}

function GroupRoomHomeScreen({ navigation, group, members, loading }: GroupRoomTabProps) {
  const { theme } = useTheme();
  const title = group?.name ?? "Study Group";
  const subtitle = members.length > 0 ? "Live studying members" : "No members yet";
  const [isDeleting, setIsDeleting] = useState(false);
  const currentUid = auth.currentUser?.uid;
  const isAdmin = group?.adminId === currentUid;

  console.log("GROUP DATA:", group);
  console.log("ADMIN ID:", group?.adminId);
  console.log("CURRENT UID:", currentUid);
  console.log("IS ADMIN:", isAdmin);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>      
      <View style={[styles.pageHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>        
        <View>
          <Text style={[styles.pageTitle, { color: theme.colors.text }]}>{title}</Text>
          <Text style={[styles.pageSubtitle, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
          {/* Temporary debug text visible on screen */}
          <Text style={[styles.smallLabel, { color: theme.colors.textSecondary, marginTop: 6 }]}>AdminId: {String(group?.adminId)}</Text>
          <Text style={[styles.smallLabel, { color: theme.colors.textSecondary } ]}>CurrentUid: {String(currentUid)}</Text>
          <Text style={[styles.smallLabel, { color: theme.colors.textSecondary } ]}>IsAdmin: {String(isAdmin)}</Text>
        </View>
        {/* Admin-only delete button + Chat */}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: "red", borderColor: "red", marginTop: 0 }]}
              onPress={() => {
                Alert.alert("Delete Group", "Are you sure you want to delete this group?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      if (!group?.id) {
                        Alert.alert("Error", "Group id is missing");
                        return;
                      }
                      try {
                        setIsDeleting(true);
                        await deleteGroup(group.id);
                        if (navigation?.canGoBack?.()) navigation.goBack();
                        else navigation?.navigate?.("GroupsList");
                      } catch (err: any) {
                        console.error("[GroupRoom] delete error:", err);
                        Alert.alert("Error", err?.message || "Failed to delete group");
                      } finally {
                        setIsDeleting(false);
                      }
                    },
                  },
                ]);
              }}
              disabled={isDeleting}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>
                Delete
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.chatButton, { borderColor: theme.colors.border, marginLeft: isAdmin ? 10 : 0 }]} onPress={() => navigation.navigate("GroupChat")}>          
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
            <Text style={[styles.chatButtonText, { color: theme.colors.primary }]}>Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Member Timers" theme={theme} />
        {loading ? (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Loading members…</Text>
        ) : members.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>            
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No members yet</Text>
          </View>
        ) : (
          members.map((member) => {
            const username = member.name || member.displayName || "Unknown";
            const timer = formatStudyTime(member.studyTime || member.totalFocusMinutes || 0);
            return (
              <View key={member.uid} style={[styles.memberCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>                
                <View>
                  <Text style={[styles.memberName, { color: theme.colors.text }]}>{username}</Text>
                  <Text style={[styles.memberTimer, { color: theme.colors.textSecondary }]}>{timer}</Text>
                </View>
                <View style={[styles.statusDot, { backgroundColor: member.isOnline ? theme.colors.primary : theme.colors.textSecondary }]} />
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AttendanceScreen({ members, group, loading }: GroupRoomTabProps) {
  const { theme } = useTheme();
  const averageAttendance = members.length > 0
    ? Math.round(members.reduce((sum, member) => sum + (member.attendance ?? 0), 0) / members.length)
    : null;

  const attendanceRows = [...members].sort((a, b) => (b.attendance || 0) - (a.attendance || 0));
  const attendanceLabel = typeof group?.attendancePercentage === "number" ? group.attendancePercentage : averageAttendance;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>      
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Attendance" theme={theme} />
        <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>          
          <Text style={[styles.metricLabel, { color: theme.colors.textSecondary }]}>Current attendance</Text>
          <Text style={[styles.metricValue, { color: theme.colors.text }]}>
            {attendanceLabel !== null ? `${attendanceLabel}%` : "No attendance yet"}
          </Text>
        </View>
        <Text style={[styles.smallLabel, { color: theme.colors.textSecondary }]}>Weekly attendance ranking</Text>
        {loading ? (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Loading attendance…</Text>
        ) : attendanceRows.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>            
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No members yet</Text>
          </View>
        ) : (
          attendanceRows.map((member, index) => (
            <View key={member.uid} style={[styles.listRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>              
              <Text style={[styles.rankTextSmall, { color: theme.colors.primary }]}>{index + 1}</Text>
              <Text style={[styles.listText, { color: theme.colors.text }]}>{member.name || member.displayName || "Unknown"}</Text>
              <Text style={[styles.listText, { color: theme.colors.textSecondary }]}>{member.attendance ?? 0}%</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RankingsScreen({ leaderboard, loading }: GroupRoomTabProps) {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>      
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Rankings" theme={theme} />
        {loading ? (
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>Loading rankings…</Text>
        ) : leaderboard.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>            
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>No members yet</Text>
          </View>
        ) : (
          leaderboard.map((member) => (
            <View key={member.uid} style={[styles.listRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>              
              <Text style={[styles.rankText, { color: theme.colors.primary }]}>{member.rank || 0}</Text>
              <View style={styles.rankDetails}>
                <Text style={[styles.listText, { color: theme.colors.text }]}>{member.name || member.displayName || "Unknown"}</Text>
                <Text style={[styles.smallLabel, { color: theme.colors.textSecondary }]}>Study time</Text>
              </View>
              <Text style={[styles.listText, { color: theme.colors.textSecondary }]}>{formatStudyTime(member.studyTime || member.totalFocusMinutes || 0)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InviteScreen({ group }: GroupRoomTabProps) {
  const { theme } = useTheme();
  const inviteLink = group?.id ? `https://study.app/group/${group.id}` : "https://study.app/group/unknown";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>      
      <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
        <SectionHeader title="Invite" theme={theme} />
        <View style={[styles.qrPlaceholder, { borderColor: theme.colors.border }]}>          
          <Text style={[styles.qrText, { color: theme.colors.textSecondary }]}>QR Code Placeholder</Text>
        </View>
        <View style={[styles.linkCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>          
          <Text style={[styles.linkLabel, { color: theme.colors.textSecondary }]}>Invite link</Text>
          <Text style={[styles.linkText, { color: theme.colors.text }]}>{inviteLink}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}>            
            <Text style={styles.actionButtonText}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: (theme.colors as any).secondary || theme.colors.primaryLight }]}>            
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function GroupChatScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState(dummyChat);
  const [text, setText] = useState("");

  const handleSend = () => {
    if (!text.trim()) return;
    const newMessage = {
      id: `${messages.length + 1}`,
      sender: "You",
      text: text.trim(),
      time: "09:22",
    };
    setMessages((prev) => [...prev, newMessage]);
    setText("");
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.background }]}>      
      <View style={[styles.chatHeader, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>        
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.chatBackButton}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Group Chat</Text>
      </View>
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.chatList}
        renderItem={({ item }) => (
          <View style={[styles.chatMessage, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>            
            <View style={styles.chatMessageHeader}>
              <Text style={[styles.chatSender, { color: theme.colors.text }]}>{item.sender}</Text>
              <Text style={[styles.chatTime, { color: theme.colors.textSecondary }]}>{item.time}</Text>
            </View>
            <Text style={[styles.chatText, { color: theme.colors.textSecondary }]}>{item.text}</Text>
          </View>
        )}
      />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        <View style={[styles.chatInputRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>          
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Type a message"
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.chatInput, { color: theme.colors.text }]}
          />
          <TouchableOpacity onPress={handleSend} style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}>            
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import { useRoute } from "@react-navigation/native";

function GroupRoomTabs({ route: navigationRoute }: any) {
  const { theme } = useTheme();
  const route = useRoute<any>();
  const groupFromParams = route.params?.group;
  const groupId = groupFromParams?.id ?? navigationRoute?.params?.groupId ?? null;
  
  const { group: groupFromHook, loading: groupLoading, error: groupError } = useGroup(groupId);
  const { members, leaderboard, loading: membersLoading, error: membersError } = useGroupMembers(groupId);
  
  const group = groupFromParams || groupFromHook;
  const loading = groupLoading || membersLoading;
  const error = groupError || membersError;

  console.log("GROUP DATA:", group);

  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({        
        headerShown: false,
        tabBarStyle: { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
        tabBarIcon: ({ focused, color }) => {
          let iconName = "home-outline";
          if (route.name === "Home") iconName = focused ? "home" : "home-outline";
          if (route.name === "Attendance") iconName = focused ? "checkmark-circle" : "checkmark-circle-outline";
          if (route.name === "Rankings") iconName = focused ? "trophy" : "trophy-outline";
          if (route.name === "Invite") iconName = focused ? "share-social" : "share-social-outline";
          return <Ionicons name={iconName as any} size={20} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home">
        {(props) => (
          <GroupRoomHomeScreen
            {...props}
            group={group}
            members={members}
            leaderboard={leaderboard}
            loading={loading}
            error={error}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Attendance">
        {(props) => (
          <AttendanceScreen
            {...props}
            group={group}
            members={members}
            leaderboard={leaderboard}
            loading={loading}
            error={error}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Rankings">
        {(props) => (
          <RankingsScreen
            {...props}
            group={group}
            members={members}
            leaderboard={leaderboard}
            loading={loading}
            error={error}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Invite">
        {(props) => (
          <InviteScreen
            {...props}
            group={group}
            members={members}
            leaderboard={leaderboard}
            loading={loading}
            error={error}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function GroupDetailScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GroupRoomTabs" component={GroupRoomTabs} />
      <Stack.Screen name="GroupChat" component={GroupChatScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pageHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  pageTitle: { fontSize: 20, fontWeight: "800" },
  pageSubtitle: { fontSize: 14, marginTop: 4 },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chatButtonText: { fontSize: 14, fontWeight: "700", marginLeft: 8 },
  emptyBox: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  tabContent: { padding: 16, paddingBottom: 24 },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  memberName: { fontSize: 16, fontWeight: "700" },
  memberTimer: { fontSize: 14, marginTop: 4 },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14, marginTop: 8 },
  metricCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  metricLabel: { fontSize: 14, marginBottom: 8 },
  metricValue: { fontSize: 32, fontWeight: "800" },
  smallLabel: { fontSize: 13, marginBottom: 8 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  rankText: { fontSize: 16, fontWeight: "800", width: 28 },
  rankTextSmall: { fontSize: 14, fontWeight: "700", width: 24 },
  listText: { fontSize: 15 },
  rankDetails: { flex: 1, marginLeft: 8 },
  qrPlaceholder: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  qrText: { fontSize: 14 },
  linkCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  linkLabel: { fontSize: 12, marginBottom: 6 },
  linkText: { fontSize: 14, fontWeight: "700" },
  buttonRow: { flexDirection: "row" },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginRight: 12,
  },
  actionButtonText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  chatHeader: {
    padding: 16,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  chatBackButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  chatList: { padding: 16, paddingBottom: 0 },
  chatMessage: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  chatMessageHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  chatSender: { fontSize: 14, fontWeight: "700" },
  chatTime: { fontSize: 12 },
  chatText: { fontSize: 15, lineHeight: 20 },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    marginLeft: 12,
  },
  chatInput: {
    flex: 1,
    height: 45,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  sendButtonText: { fontWeight: "700", color: "#fff" },
});
