import { Pressable, Text } from 'react-native';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export const Chip = ({ label, selected, onPress }: Props) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: !!selected }}
    accessibilityLabel={label}
    onPress={onPress}
    className={`rounded-full border px-3 py-1.5 ${selected ? 'border-brand bg-brand' : 'border-line bg-surface'}`}
  >
    <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-ink'}`}>{label}</Text>
  </Pressable>
);
