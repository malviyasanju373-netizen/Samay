import React from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, TouchableWithoutFeedback,
} from "react-native";
import { useTheme } from "@/context/ThemeContext";

export type AppDialogButton = {
  text: string;
  onPress?: () => void;
  style?: "default" | "cancel" | "destructive";
};

type Props = {
  visible: boolean;
  title: string;
  message: string;
  buttons?: AppDialogButton[];
  onDismiss?: () => void;
};

export default function AppDialog({ visible, title, message, buttons = [{ text: "OK", style: "default" }], onDismiss }: Props) {
  const { theme } = useTheme();
  const s = styles(theme);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <TouchableWithoutFeedback onPress={onDismiss}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback>
            <View style={s.card}>
              <Text style={s.title}>{title}</Text>
              <Text style={s.message}>{message}</Text>
              <View style={s.buttonRow}>
                {buttons.map((btn, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.buttonBase, s.buttonFlex,
                      btn.style === "default" && s.buttonPrimary,
                      (btn.style === "cancel" || btn.style === "destructive") && s.buttonCancel,
                    ]}
                    onPress={btn.onPress}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.buttonText,
                      btn.style === "default" && s.buttonTextPrimary,
                      btn.style === "cancel" && s.buttonTextCancel,
                      btn.style === "destructive" && s.buttonTextDestructive,
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function styles(theme: any) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", paddingHorizontal: theme.spacing["2xl"] },
    card: { width: "100%", backgroundColor: theme.colors.surface, borderRadius: theme.radius.xl, padding: theme.spacing["2xl"], borderWidth: 1, borderColor: theme.colors.border },
    title: { fontSize: theme.typography.fontSize.lg, fontWeight: theme.typography.fontWeight.bold, color: theme.colors.text, marginBottom: theme.spacing.sm, textAlign: "center" },
    message: { fontSize: theme.typography.fontSize.base, color: theme.colors.textSecondary, lineHeight: 20, textAlign: "center", marginBottom: theme.spacing["2xl"] },
    buttonRow: { flexDirection: "row", gap: theme.spacing.sm, justifyContent: "center" },
    buttonBase: { borderRadius: theme.radius.md, paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, alignItems: "center", justifyContent: "center", minHeight: 44 },
    buttonFlex: { flex: 1 },
    buttonPrimary: { backgroundColor: theme.colors.primary },
    buttonCancel: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.colors.border },
    buttonText: { fontSize: theme.typography.fontSize.base, fontWeight: theme.typography.fontWeight.semibold },
    buttonTextPrimary: { color: theme.colors.textInverse },
    buttonTextCancel: { color: theme.colors.textSecondary },
    buttonTextDestructive: { color: theme.colors.error },
  });
}
