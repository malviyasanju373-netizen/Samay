import React, { useEffect, useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { User } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

import AuthStack             from "@/navigation/AuthStack";
import RootNavigator         from "@/navigation/RootNavigator";
import ProfileSetupScreen    from "@/screens/ProfileSetupScreen";
import ProfileScreen         from "@/screens/ProfileScreen";
import PrivacyPolicyScreen   from "@/screens/PrivacyPolicyScreen";
import TermsScreen           from "@/screens/TermsScreen";
import TermsUpdateScreen     from "@/screens/TermsUpdateScreen";
import GeneralFeedbackScreen from "@/screens/GeneralFeedbackScreen";
import DeleteAccountScreen   from "@/screens/DeleteAccountScreen";
import AccountScreen         from "@/screens/AccountScreen";
import PrivacySecurityScreen from "@/screens/PrivacySecurityScreen";
import LeaderboardScreen     from "@/screens/LeaderboardScreen";
import GroupsListScreen      from "@/screens/GroupsListScreen";
import CreateGroupScreen     from "@/screens/CreateGroupScreen";
import GroupDetailScreen     from "@/screens/GroupDetailScreen";
import { ensureUserProfile } from "@/services/userProfile";

const TERMS_LAST_UPDATED = new Date("2025-05-01T00:00:00Z").getTime();
const TERMS_ACCEPTED_AT_KEY = "TERMS_ACCEPTED_AT";

export type AppNavigatorProps = {
  user: User | null;
  authLoading?: boolean;
};

const Stack = createNativeStackNavigator();

const AppNavigator: React.FC<AppNavigatorProps> = ({ user, authLoading }) => {
  const [needsTerms, setNeedsTerms] = useState(false);
  const [checkedTerms, setCheckedTerms] = useState(false);

  useEffect(() => {
    if (!user) {
      setNeedsTerms(false);
      setCheckedTerms(false);
      return;
    }
    setCheckedTerms(false);
    AsyncStorage.getItem(TERMS_ACCEPTED_AT_KEY).then((acceptedAt) => {
      const acceptedTime = acceptedAt ? new Date(acceptedAt).getTime() : 0;
      setNeedsTerms(acceptedTime < TERMS_LAST_UPDATED);
      setCheckedTerms(true);
    }).catch(() => {
      setNeedsTerms(true);
      setCheckedTerms(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user || !user.emailVerified) return;
    ensureUserProfile(user.uid, {
      displayName: user.displayName,
      email: user.email,
      photoURL: user.photoURL,
    }).catch((err) => {
      if (err?.code === "unavailable") return;
      console.error("[AppNavigator] profile backfill failed", err);
    });
  }, [user]);

  if (authLoading) return null;
  if (!user) return <AuthStack />;
  if (!checkedTerms) return null;

  if (user && (!user.displayName || !user.displayName.trim())) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="ProfileSetup"    component={ProfileSetupScreen} />
        <Stack.Screen name="Profile"         component={ProfileScreen} />
        <Stack.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} />
        <Stack.Screen name="Terms"           component={TermsScreen} />
        <Stack.Screen name="GeneralFeedback" component={GeneralFeedbackScreen} />
        <Stack.Screen name="DeleteAccount"   component={DeleteAccountScreen} />
        <Stack.Screen name="Account"         component={AccountScreen} />
        <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
        <Stack.Screen name="MainTabs"        component={RootNavigator} />
        <Stack.Screen name="GroupsList"      component={GroupsListScreen} />
        <Stack.Screen name="CreateGroup"     component={CreateGroupScreen} />
        <Stack.Screen name="GroupDetail"     component={GroupDetailScreen} />
      </Stack.Navigator>
    );
  }

  if (checkedTerms && needsTerms) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="TermsUpdate"     component={TermsUpdateScreen} />
        <Stack.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} />
        <Stack.Screen name="Terms"           component={TermsScreen} />
        <Stack.Screen name="GeneralFeedback" component={GeneralFeedbackScreen} />
        <Stack.Screen name="DeleteAccount"   component={DeleteAccountScreen} />
        <Stack.Screen name="Account"         component={AccountScreen} />
        <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
        <Stack.Screen name="MainTabs"        component={RootNavigator} />
        <Stack.Screen name="GroupsList"      component={GroupsListScreen} />
        <Stack.Screen name="CreateGroup"     component={CreateGroupScreen} />
        <Stack.Screen name="GroupDetail"     component={GroupDetailScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs"        component={RootNavigator} />
      <Stack.Screen name="Profile"         component={ProfileScreen} />
      <Stack.Screen name="ProfileSetup"    component={ProfileSetupScreen} />
      <Stack.Screen name="PrivacyPolicy"   component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms"           component={TermsScreen} />
      <Stack.Screen name="GeneralFeedback" component={GeneralFeedbackScreen} />
      <Stack.Screen name="DeleteAccount"   component={DeleteAccountScreen} />
      <Stack.Screen name="Account"         component={AccountScreen} />
      <Stack.Screen name="PrivacySecurity" component={PrivacySecurityScreen} />
      <Stack.Screen name="Leaderboard"     component={LeaderboardScreen} />
      <Stack.Screen name="GroupsList"      component={GroupsListScreen} />
      <Stack.Screen name="CreateGroup"     component={CreateGroupScreen} />
      <Stack.Screen name="GroupDetail"     component={GroupDetailScreen} />
    </Stack.Navigator>
  );
};

export default AppNavigator;
