import { ActivityIndicator, Pressable, Text } from 'react-native';

type Props = { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; variant?: 'primary' | 'secondary' };

export const Button = ({ label, onPress, disabled, busy, variant = 'primary' }: Props) => {
  const off = disabled || busy;
  const bg = off ? 'bg-line' : variant === 'primary' ? 'bg-brand' : 'border border-brand bg-surface';
  const fg = variant === 'primary' || off ? 'text-white' : 'text-brand';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off} onPress={onPress} className={`items-center rounded-card py-3 ${bg}`}>
      {busy ? <ActivityIndicator color="#fff" /> : <Text className={`text-base font-semibold ${fg}`}>{label}</Text>}
    </Pressable>
  );
};
