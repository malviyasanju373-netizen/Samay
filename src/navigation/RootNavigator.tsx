import React, { useState, useEffect } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Dimensions } from "react-native";
import { useTheme } from "@/context/ThemeContext";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen     from "@/screens/HomeScreen";
import TimerScreen    from "@/screens/TimerScreen";
import SessionsScreen from "@/screens/SessionsScreen";
import StatsScreen    from "@/screens/StatsScreen";
import ProfileScreen  from "@/screens/ProfileScreen";
import LeaderboardScreen    from "@/screens/LeaderboardScreen";
import GroupsListScreen     from "@/screens/GroupsListScreen";
import CreateGroupScreen    from "@/screens/CreateGroupScreen";
import GroupDetailScreen    from "@/screens/GroupDetailScreen";
import AccountScreen        from "@/screens/AccountScreen";
import DeleteAccountScreen  from "@/screens/DeleteAccountScreen";
import PrivacyPolicyScreen  from "@/screens/PrivacyPolicyScreen";
import TermsScreen          from "@/screens/TermsScreen";
import PrivacySecurityScreen from "@/screens/PrivacySecurityScreen";
import GeneralFeedbackScreen from "@/screens/GeneralFeedbackScreen";
import GroupChatScreen      from "@/screens/GroupChatScreen";
import CamStudyComingSoonScreen from "@/screens/CamStudyComingSoonScreen";
import TodoScreen           from "@/screens/TodoScreen";

const Tab   = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabNavigator() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [landscape, setLandscape] = useState(false);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setLandscape(window.width > window.height);
    });
    return () => sub?.remove();
  }, []);

  const bottomInset = Math.max(insets.bottom, landscape ? 8 : 10);
  const tabBarHeight = (landscape ? 48 : 56) + bottomInset;

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: landscape ? 3 : 6,
          elevation: theme.isDark ? 0 : 12,
          shadowColor: "#000",
          shadowOpacity: theme.isDark ? 0 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarItemStyle: { borderRadius: 18, marginHorizontal: 4 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: "700", paddingTop: 1 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: "Home",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Timer"
        component={TimerScreen}
        options={{
          tabBarLabel: "Focus",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "timer" : "timer-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Sessions"
        component={SessionsScreen}
        options={{
          tabBarLabel: "Sessions",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "list" : "list-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Stats"
        component={StatsScreen}
        options={{
          tabBarLabel: "Stats",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Groups"
        component={GroupsListScreen}
        options={{
          tabBarLabel: "Groups",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: "Profile",
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={focused ? 25 : 22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={TabNavigator} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="GroupsList" component={GroupsListScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} />
      <Stack.Screen name="Profile"     component={ProfileScreen} options={{ presentation: "modal" }} />
      <Stack.Screen name="Account"     component={AccountScreen} />
      <Stack.Screen name="DeleteAccount"    component={DeleteAccountScreen} />
      <Stack.Screen name="PrivacyPolicy"    component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms"            component={TermsScreen} />
      <Stack.Screen name="PrivacySecurity"  component={PrivacySecurityScreen} />
      <Stack.Screen name="GeneralFeedback"  component={GeneralFeedbackScreen} />
      <Stack.Screen name="GroupChat"        component={GroupChatScreen} />
      <Stack.Screen name="CamStudyComingSoon" component={CamStudyComingSoonScreen} />
      <Stack.Screen name="TodoScreen" component={TodoScreen} />
    </Stack.Navigator>
  );
}
