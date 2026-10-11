import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useApp } from '../state/AppContext';
import { lightImpactHaptic, selectionHaptic } from '../utils/haptics';

export function ScreenTitle({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  const { theme } = useApp();
  return (
    <View style={styles.titleRow}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => {
            selectionHaptic();
            onBack();
          }}
          style={styles.backButton}
        >
          <Text style={[styles.backText, { color: theme.colors.primary }]}>
            ‹
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.titleCopy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  secondary = false,
  danger = false,
  style,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
  style?: ViewStyle;
}) {
  const { theme } = useApp();
  const backgroundColor = secondary
    ? theme.colors.surfaceRaised
    : danger
      ? theme.colors.danger
      : theme.colors.primary;
  const color = secondary
    ? danger
      ? theme.colors.danger
      : theme.colors.text
    : theme.colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        if (secondary) selectionHaptic();
        else lightImpactHaptic();
        onPress();
      }}
      style={[
        styles.actionButton,
        {
          backgroundColor,
          borderColor: secondary ? theme.colors.border : backgroundColor,
        },
        style,
      ]}
    >
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

export function FormField({
  label,
  error,
  multiline,
  style,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { theme } = useApp();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={theme.colors.muted}
        style={[
          styles.input,
          multiline ? styles.multiline : null,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surface,
            borderColor: error ? theme.colors.danger : theme.colors.border,
          },
          style,
        ]}
      />
      {error ? (
        <Text style={[styles.fieldError, { color: theme.colors.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function Notice({
  children,
  warning = false,
}: {
  children: string;
  warning?: boolean;
}) {
  const { theme } = useApp();
  return (
    <View
      style={[
        styles.notice,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderColor: warning ? theme.colors.danger : theme.colors.border,
        },
      ]}
    >
      <Text style={{ color: warning ? theme.colors.danger : theme.colors.muted }}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    minHeight: 52,
  },
  backButton: {
    width: 42,
    height: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 36,
    lineHeight: 40,
  },
  titleCopy: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  actionButton: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontWeight: '700',
    fontSize: 15,
  },
  fieldWrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 7,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
  },
  multiline: {
    minHeight: 104,
    textAlignVertical: 'top',
  },
  fieldError: {
    marginTop: 5,
    fontSize: 12,
  },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 14,
    lineHeight: 20,
  },
});
