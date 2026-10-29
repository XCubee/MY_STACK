import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { normalizeWebUrl } from '../domain/tool';

export function ToolLogo({
  name,
  url,
  size,
  accent,
}: {
  name: string;
  url: string;
  size: number;
  accent: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const validUrl = normalizeWebUrl(url);
  const hostname = validUrl ? new URL(validUrl).hostname : null;
  const imageUrl = validUrl
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname ?? '')}&sz=128`
    : null;
  const showImage = Boolean(imageUrl && imageUrl !== failedUrl);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size * 0.31,
          backgroundColor: '#FFFFFF',
          borderColor: accent,
        },
      ]}
    >
      {showImage && imageUrl ? (
        <Image
          accessibilityLabel={`${name} logo`}
          source={{ uri: imageUrl }}
          resizeMode="contain"
          fadeDuration={0}
          onError={() => setFailedUrl(imageUrl)}
          style={{
            width: size * 0.82,
            height: size * 0.82,
            borderRadius: size * 0.15,
          }}
        />
      ) : (
        <Text
          accessibilityLabel={`${name} icon`}
          style={[styles.fallback, { color: accent, fontSize: size * 0.44 }]}
        >
          {name.trim().slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 13,
    borderWidth: 2,
  },
  fallback: {
    fontWeight: '900',
  },
});
