import { StyleSheet, View } from 'react-native';
import { useApp } from '../state/AppContext';

export function StackMark({ size = 54 }: { size?: number }) {
  const { theme } = useApp();
  const scale = size / 54;
  const nodeSize = 9 * scale;
  return (
    <View
      accessible
      accessibilityLabel="My Stack data structure logo"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: 18 * scale,
          backgroundColor: theme.colors.primary,
        },
      ]}
    >
      <View
        style={[
          styles.vertical,
          {
            height: 17 * scale,
            top: 15 * scale,
            left: size / 2 - scale,
            backgroundColor: theme.colors.onPrimary,
          },
        ]}
      />
      <View
        style={[
          styles.horizontal,
          {
            width: 22 * scale,
            top: 30 * scale,
            left: size / 2 - 11 * scale,
            backgroundColor: theme.colors.onPrimary,
          },
        ]}
      />
      <View
        style={[
          styles.branch,
          {
            width: 13 * scale,
            top: 25 * scale,
            left: size / 2 - 12 * scale,
            transform: [{ rotate: '-45deg' }],
            backgroundColor: theme.colors.onPrimary,
          },
        ]}
      />
      <View
        style={[
          styles.branch,
          {
            width: 13 * scale,
            top: 25 * scale,
            left: size / 2 - scale,
            transform: [{ rotate: '45deg' }],
            backgroundColor: theme.colors.onPrimary,
          },
        ]}
      />
      {[
        { left: size / 2 - nodeSize / 2, top: 8 * scale },
        { left: size / 2 - 15 * scale, top: 27 * scale },
        { left: size / 2 + 6 * scale, top: 27 * scale },
      ].map((position, index) => (
        <View
          key={index}
          style={[
            styles.node,
            {
              width: nodeSize,
              height: nodeSize,
              borderRadius: 3 * scale,
              backgroundColor: theme.colors.onPrimary,
              borderColor: theme.colors.surface,
              ...position,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    borderWidth: 1,
  },
  vertical: {
    position: 'absolute',
    width: 2,
  },
  horizontal: {
    position: 'absolute',
    height: 2,
  },
  branch: {
    position: 'absolute',
    height: 2,
  },
});
