import * as Haptics from 'expo-haptics';

export function selectionHaptic() {
  void Haptics.selectionAsync();
}

export function lightImpactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function mediumImpactHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}
