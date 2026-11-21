import { Pressable, Text, View } from 'react-native';

type SuggestionRowProps = {
  code: string;
  name: string;
  city: string;
  onPress: () => void;
};

export const SuggestionRow = ({ code, name, city, onPress }: SuggestionRowProps) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${name}, ${city}, ${code}`}
    className="flex-row items-center gap-3 border-b border-line px-gutter py-3 active:bg-brand-soft"
  >
    <View className="w-14 items-center rounded-card bg-brand-soft py-1">
      <Text className="text-base font-bold text-brand-dark">{code}</Text>
    </View>
    <View className="flex-1">
      <Text className="text-base text-ink" numberOfLines={1}>
        {name}
      </Text>
      <Text className="text-sm text-ink-muted" numberOfLines={1}>
        {city}
      </Text>
    </View>
  </Pressable>
);
