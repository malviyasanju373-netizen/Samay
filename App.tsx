import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { View, ActivityIndicator, StatusBar, Text, ScrollView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuth } from "@/auth/useAuth";
import AppNavigator from "@/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    console.error('[ErrorBoundary] caught render error:', error?.message, error?.stack);
    return { error };
  }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#111', padding: 20 }}>
          <Text style={{ color: 'red', fontSize: 16, fontWeight: 'bold', marginTop: 60 }}>
            CRASH — check Metro/logcat logs
          </Text>
          <Text style={{ color: '#fff', marginTop: 12, fontSize: 13 }}>{err.message}</Text>
          <Text style={{ color: '#aaa', marginTop: 12, fontSize: 11 }}>{err.stack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

console.log('[App] module loaded');

function AppContent() {
  console.log('[AppContent] rendering');
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  console.log('[AppContent] auth state — loading:', loading, 'user:', user?.uid ?? 'null');

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: theme.colors.background }}>
        <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.isDark ? "light-content" : "dark-content"} backgroundColor={theme.colors.background} />
      <NavigationContainer>
        <AppNavigator user={user} authLoading={loading} />
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  console.log('[App] rendering root');
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
