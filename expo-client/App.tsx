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
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ToolDetailScreen } from './src/screens/ToolDetailScreen';
import { ToolFormScreen } from './src/screens/ToolFormScreen';
import type {
  MainTabParamList,
  RootStackParamList,
} from './src/navigation/types';
import { AppProvider, useApp } from './src/state/AppContext';
import { selectionHaptic } from './src/utils/haptics';

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

  const iconColor =
    name === 'Favorites' && focused ? '#F5B942' : color;
  const icon = name === 'Library' ? '⌂' : name === 'Favorites' ? '★' : '⚙';
  return (
    <Animated.Text
      style={{
        color: iconColor,
        fontSize: 21,
        lineHeight: 24,
        transform: [{ scale }],
      }}
    >
      {icon}
    </Animated.Text>
  );
}

function MainTabs() {
  const { theme } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenListeners={{
        tabPress: () => {
          if (Platform.OS === 'ios') selectionHaptic();
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 56 + insets.bottom,
          paddingTop: 4,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
        tabBarIcon: ({ color, focused }) => (
          <AnimatedTabIcon
            color={color}
            focused={focused}
            name={route.name}
          />
        ),
      })}
    >
      <Tabs.Screen name="Library" component={LibraryScreen} />
      <Tabs.Screen name="Favorites" component={FavoritesScreen} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

function AppNavigation() {
  const { theme, ready, fatalError } = useApp();
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
        <Stack.Screen name="ToolDetail" component={ToolDetailScreen} />
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
        <AppNavigation />
      </AppProvider>
    </SafeAreaProvider>
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
});
