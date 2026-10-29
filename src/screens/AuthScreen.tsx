import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackMark } from '../components/StackMark';
import { ActionButton, FormField } from '../components/ui';
import { useApp } from '../state/AppContext';

export function AuthScreen() {
  const {
    theme,
    signInWithEmail,
    signUpWithEmail,
    signInWithProvider,
  } = useApp();
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitEmail = async () => {
    setError(null);
    setMessage(null);
    if (!email.trim() || !password) {
      setError('Enter your email and password to continue.');
      return;
    }
    if (creatingAccount && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      if (creatingAccount) {
        const sessionStarted = await signUpWithEmail(email, password);
        if (!sessionStarted) {
          setMessage('Check your email to confirm your account, then sign in.');
        }
      } else {
        await signInWithEmail(email, password);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Email sign-in failed. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const submitProvider = async (provider: 'google' | 'apple') => {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await signInWithProvider(provider);
    } catch (providerError) {
      setError(
        providerError instanceof Error
          ? providerError.message
          : `${provider} sign-in failed. Please try again.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
     
          <Text style={[styles.brandName, { color: theme.colors.primary, fontSize: 32 }]}>
          My-Stack
          </Text>

          <Text style={[styles.title, { color: theme.colors.text },]}>
            Workspace
          </Text>
          {/* <Text style={[styles.titleAccent, { color: theme.colors.primary }]}>
            all in one place.
          </Text> */}
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>
            Sign in to keep your library private and in sync across your devices.
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.muted }]}>Sign in with Google is available for limited users use email </Text>

          <View style={styles.providers}>
            <ActionButton
              label="Continue with Google"
              secondary
              onPress={() => void submitProvider('google')}
              style={styles.providerButton}
            />
            {/* <ActionButton
              label="Continue with Apple"
              secondary
              onPress={() => void submitProvider('apple')}
              style={styles.providerButton}
            /> */}
          </View>

          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
            <Text style={[styles.dividerText, { color: theme.colors.muted }]}>
              or use email
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
          </View>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!busy}
            placeholder="you@example.com"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoComplete={creatingAccount ? 'new-password' : 'current-password'}
            textContentType={creatingAccount ? 'newPassword' : 'password'}
            secureTextEntry
            editable={!busy}
            placeholder={creatingAccount ? 'At least 8 characters' : 'Your password'}
          />

          {error ? (
            <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.colors.danger }]}>
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text accessibilityRole="alert" style={[styles.feedback, { color: theme.colors.primary }]}>
              {message}
            </Text>
          ) : null}

          <ActionButton
            label={
              busy
                ? 'Please wait…'
                : creatingAccount
                  ? 'Create account'
                  : 'Sign in'
            }
            onPress={() => void submitEmail()}
            style={styles.submitButton}
          />
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => {
              setCreatingAccount((value) => !value);
              setError(null);
              setMessage(null);
            }}
            style={styles.switchMode}
          >
            <Text style={{ color: theme.colors.muted }}>
              {creatingAccount ? 'Already have an account? ' : 'New to My Stack? '}
              <Text style={{ color: theme.colors.primary, fontWeight: '800' }}>
                {creatingAccount ? 'Sign in' : 'Create an account'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 26,
  },
  brandName: { fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 11, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  titleAccent: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, marginTop: 1 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 9, marginBottom: 22 },
  providers: { gap: 9 },
  providerButton: { minHeight: 47 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  feedback: { fontSize: 12, lineHeight: 18, marginBottom: 11 },
  submitButton: { marginTop: 2 },
  switchMode: { alignItems: 'center', padding: 15 },
});
