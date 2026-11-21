import { Text, TextInput, View, type TextInputProps } from 'react-native';

type InputProps = TextInputProps & { label?: string };

export const Input = ({ label, className, ...rest }: InputProps) => (
  <View className="gap-1">
    {label ? <Text className="text-sm font-medium text-ink-muted">{label}</Text> : null}
    <TextInput
      className={`rounded-card border border-line bg-surface px-gutter py-3 text-base text-ink ${className ?? ''}`}
      placeholderTextColor="#5B6B7B"
      autoCapitalize="none"
      autoCorrect={false}
      {...rest}
    />
  </View>
);
