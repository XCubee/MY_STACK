import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Tool } from '../domain/tool';
import { appearanceForCategory } from '../domain/tool';
import { ToolLogo } from './ToolLogo';
import { useApp } from '../state/AppContext';
import { lightImpactHaptic, selectionHaptic } from '../utils/haptics';

export function ToolCard({
  tool,
  onPress,
  onToggleFavorite,
  animationIndex = 0,
}: {
  tool: Tool;
  onPress: () => void;
  onToggleFavorite: () => void;
  animationIndex?: number;
}) {
  const { theme } = useApp();
  const appearance = appearanceForCategory(tool.category);
  const entrance = useRef(new Animated.Value(0)).current;
  const borderHighlight = useRef(new Animated.Value(0.45)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 360,
      delay: Math.min(animationIndex * 45, 315),
      useNativeDriver: true,
    });
    animation.start();
    const borderAnimation = Animated.sequence([
      Animated.delay(Math.min(animationIndex * 45, 315)),
      Animated.timing(borderHighlight, {
        toValue: 1,
        duration: 420,
        useNativeDriver: true,
      }),
      Animated.timing(borderHighlight, {
        toValue: 0.78,
        duration: 620,
        useNativeDriver: true,
      }),
    ]);
    borderAnimation.start();
    return () => {
      animation.stop();
      borderAnimation.stop();
    };
  }, [animationIndex, borderHighlight, entrance]);

  const cardScale = Animated.multiply(entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [0.97, 1],
  }), pressScale);

  return (
    <Animated.View
      style={[
        styles.animatedCard,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
            { scale: cardScale },
          ],
        },
      ]}
    >
      <Animated.View
        style={[
          styles.gradientBorder,
          { opacity: borderHighlight, backgroundColor: theme.colors.border },
        ]}
      >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${tool.name}, ${tool.category}`}
            onPress={() => {
              selectionHaptic();
              onPress();
            }}
            onPressIn={() =>
              Animated.spring(pressScale, {
                toValue: 0.985,
                useNativeDriver: true,
                speed: 24,
                bounciness: 2,
              }).start()
            }
            onPressOut={() =>
              Animated.spring(pressScale, {
                toValue: 1,
                useNativeDriver: true,
                speed: 20,
                bounciness: 5,
              }).start()
            }
            style={[
              styles.card,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <ToolLogo
              name={tool.name}
              url={tool.url}
              size={50}
              accent={appearance.accent}
            />
            <View style={styles.content}>
              <Text
                numberOfLines={1}
                style={[styles.name, { color: theme.colors.text }]}
              >
                {tool.name}
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.description, { color: theme.colors.muted }]}
              >
                {tool.description}
              </Text>
              <Text style={[styles.category, { color: appearance.accent }]}>
                {tool.category}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                tool.isFavorite
                  ? `Remove ${tool.name} from favorites`
                  : `Add ${tool.name} to favorites`
              }
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                lightImpactHaptic();
                onToggleFavorite();
              }}
              style={styles.favorite}
            >
              <Text
                style={[
                  styles.favoriteText,
                  {
                    color: tool.isFavorite ? '#F5B942' : theme.colors.muted,
                  },
                ]}
              >
                {tool.isFavorite ? '★' : '☆'}
              </Text>
            </Pressable>
          </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  animatedCard: {
    marginBottom: 11,
  },
  gradientBorder: {
    borderRadius: 17,
    padding: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 17,
  },
  content: {
    flex: 1,
  },
  name: {
    fontWeight: '800',
    fontSize: 16,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  category: {
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  favorite: {
    width: 40,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  favoriteText: {
    fontSize: 27,
  },
});
