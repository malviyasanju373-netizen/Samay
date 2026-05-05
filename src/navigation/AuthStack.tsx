import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AuthChoiceScreen from "@/screens/AuthChoiceScreen";

const Stack = createNativeStackNavigator();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AuthChoice" component={AuthChoiceScreen} />
    </Stack.Navigator>
  );
}
