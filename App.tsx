import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
  useNavigation,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationBar } from 'expo-navigation-bar';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { CategoriesScreen } from './src/screens/CategoriesScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProjectsScreen } from './src/screens/ProjectsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ToolDetailScreen } from './src/screens/ToolDetailScreen';
import { ToolFormScreen } from './src/screens/ToolFormScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SubscriptionsScreen } from './src/screens/SubscriptionsScreen';
import { SubscriptionFormScreen } from './src/screens/SubscriptionFormScreen';
import { LearningScreen } from './src/screens/LearningScreen';
import { LearningDetailScreen } from './src/screens/LearningDetailScreen';
import { LearningFormScreen } from './src/screens/LearningFormScreen';
import { LearningSectionFormScreen } from './src/screens/LearningSectionFormScreen';
import { ReferralsScreen } from './src/screens/ReferralsScreen';
import { ReferralDetailScreen } from './src/screens/ReferralDetailScreen';
import { ReferralFormScreen } from './src/screens/ReferralFormScreen';
import { TasksScreen } from './src/screens/TasksScreen';
import { TaskFormScreen } from './src/screens/TaskFormScreen';
import { ActivityScreen } from './src/screens/ActivityScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import type {
  MainTabParamList,
  RootStackParamList,
} from './src/navigation/types';
import { AppProvider, useApp } from './src/state/AppContext';
import { LearningProvider } from './src/state/LearningContext';
import { ReferralProvider } from './src/state/ReferralContext';
import { TaskProvider } from './src/state/TaskContext';
import { ActivityProvider } from './src/state/ActivityContext';
import { selectionHaptic } from './src/utils/haptics';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function LoadingMark() {
  const first = useRef(new Animated.Value(0.55)).current;
  const second = useRef(new Animated.Value(0.55)).current;
  const third = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const pulse = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.55,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
    const animations = [pulse(first, 0), pulse(second, 180), pulse(third, 360)];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [first, second, third]);

  return (
    <View style={styles.loadingMark}>
      {[first, second, third].map((opacity, index) => (
        <Animated.View
          key={index}
          style={[
            styles.loadingBar,
            {
              width: 48 + index * 12,
              opacity,
              backgroundColor: index === 1 ? '#39E58C' : '#89A596',
              transform: [{ scaleX: opacity }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function AnimatedTabIcon({
  color,
  focused,
  name,
}: {
  color: string;
  focused: boolean;
  name: keyof MainTabParamList;
}) {
  const { theme } = useApp();
  const scale = useRef(new Animated.Value(focused ? 1 : 0.85)).current;

  useEffect(() => {
    const animation = Animated.spring(scale, {
      toValue: focused ? 1 : 0.85,
      damping: 12,
      stiffness: 180,
      mass: 0.7,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focused, scale]);

  const iconColor = color;
  const icon =
    name === 'Dashboard'
      ? '⌂'
      : name === 'Library'
        ? '▦'
        : name === 'Projects'
          ? '▣'
          : name === 'Add'
            ? '+'
            : '⚙';
  if (name === 'Add') {
    return (
      <Animated.View
        style={[
          styles.addTabIcon,
          {
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.surfaceRaised,
            transform: [{ scale }],
          },
        ]}
      >
        <Text style={[styles.addTabGlyph, { color: theme.colors.onPrimary }]}>
          {icon}
        </Text>
      </Animated.View>
    );
  }
  return (
    <Animated.Text
      style={{
        color: iconColor,
        fontSize: 24,
        lineHeight: 28,
        transform: [{ scale }],
      }}
    >
      {icon}
    </Animated.Text>
  );
}

function MainTabs() {
  const { theme } = useApp();
  const rootNavigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenListeners={({ route }) => ({
        tabPress: (event) => {
          if (route.name === 'Add') {
            event.preventDefault();
            rootNavigation.navigate('ToolForm', undefined);
          }
          if (Platform.OS === 'ios') selectionHaptic();
        },
      })}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surfaceRaised,
          borderTopColor: theme.colors.border,
          height: 64 + insets.bottom,
          paddingTop: 7,
          paddingBottom: Math.max(insets.bottom, 8),
          borderTopWidth: 1,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontWeight: '800',
          fontSize: 9,
          marginTop: 1,
        },
        tabBarIcon: ({ color, focused }) => (
          <AnimatedTabIcon
            color={color}
            focused={focused}
            name={route.name}
          />
        ),
      })}
    >
      <Tabs.Screen
        name="Dashboard"
        component={HomeScreen}
        options={{ title: 'Home' }}
      />
      <Tabs.Screen
        name="Library"
        component={CategoriesScreen}
        options={{ title: 'Library' }}
      />
      <Tabs.Screen
        name="Add"
        component={HomeScreen}
        options={{ title: '', tabBarAccessibilityLabel: 'Add a tool' }}
      />
      <Tabs.Screen name="Projects" component={ProjectsScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

function AppNavigation() {
  const { theme, ready, fatalError, authStatus } = useApp();
  const navigationTheme = useMemo(
    () => ({
      ...(theme.dark ? DarkTheme : DefaultTheme),
      dark: theme.dark,
      colors: {
        ...(theme.dark ? DarkTheme.colors : DefaultTheme.colors),
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
    }),
    [theme],
  );

  if (!ready) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <LoadingMark />
        <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>
          Preparing your stack
        </Text>
        <Text style={{ color: theme.colors.muted, marginTop: 6 }}>
          Getting everything in place…
        </Text>
      </View>
    );
  }

  if (fatalError) {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Text style={[styles.errorTitle, { color: theme.colors.text }]}>
          My Stack could not start
        </Text>
        <Text style={{ color: theme.colors.muted, textAlign: 'center' }}>
          {fatalError}
        </Text>
      </View>
    );
  }

  if (!ready || authStatus === 'loading') {
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <LoadingMark />
        <Text style={[styles.loadingTitle, { color: theme.colors.text }]}>
          Preparing your stack
        </Text>
        <Text style={{ color: theme.colors.muted, marginTop: 6 }}>
          Getting everything in place…
        </Text>
      </View>
    );
  }

  if (authStatus === 'signedOut') return <AuthScreen />;
  if (authStatus === 'onboarding') return <OnboardingScreen />;

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: Platform.OS === 'ios' ? 'slide_from_right' : 'default',
          gestureEnabled: Platform.OS === 'ios',
        }}
      >
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="Activity" component={ActivityScreen} />
        <Stack.Screen name="ToolDetail" component={ToolDetailScreen} />
        <Stack.Screen name="Learning" component={LearningScreen} />
        <Stack.Screen
          name="LearningDetail"
          component={LearningDetailScreen}
        />
        <Stack.Screen
          name="LearningForm"
          component={LearningFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
        <Stack.Screen
          name="LearningSectionForm"
          component={LearningSectionFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
        <Stack.Screen name="Referrals" component={ReferralsScreen} />
        <Stack.Screen
          name="ReferralDetail"
          component={ReferralDetailScreen}
        />
        <Stack.Screen
          name="ReferralForm"
          component={ReferralFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
        <Stack.Screen name="Tasks" component={TasksScreen} />
        <Stack.Screen
          name="TaskForm"
          component={TaskFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
        <Stack.Screen name="Favorites" component={FavoritesScreen} />
        <Stack.Screen name="Renewals" component={SubscriptionsScreen} />
        <Stack.Screen
          name="SubscriptionForm"
          component={SubscriptionFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
        <Stack.Screen
          name="ToolForm"
          component={ToolFormScreen}
          options={{
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
            animation:
              Platform.OS === 'ios' ? 'slide_from_bottom' : 'default',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ActivityProvider>
          <LearningProvider>
            <ReferralProvider>
              <TaskProvider>
                <AppContent />
              </TaskProvider>
            </ReferralProvider>
          </LearningProvider>
        </ActivityProvider>
      </AppProvider>
    </SafeAreaProvider>
  );
}

function AppContent() {
  const { theme } = useApp();
  return (
    <>
      <NavigationBar style={theme.dark ? 'light' : 'dark'} />
      <AppNavigation />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMark: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    marginBottom: 17,
  },
  loadingBar: {
    height: 5,
    borderRadius: 3,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  errorTitle: { fontSize: 20, fontWeight: '800', marginBottom: 8 },
  addTabIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -11,
    borderWidth: 3,
  },
  addTabGlyph: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '500',
  },
});
