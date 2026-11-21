import type { GeoSuggestion } from '@wayfinder/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/Input';
import { SuggestionList } from '../../src/features/geo/SuggestionList';
import { toSuggestUiState } from '../../src/features/geo/suggest-ui-state';
import { useGeoSuggest } from '../../src/features/geo/useGeoSuggest';
import { supabase } from '../../src/lib/supabase';

export default function Home() {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<GeoSuggestion | null>(null);
  const query = useGeoSuggest(text);
  const state = toSuggestUiState({
    text,
    isFetching: query.isFetching,
    error: query.error,
    data: query.data,
  });

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="gap-3 px-gutter pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-brand">Wayfinder</Text>
          <Pressable onPress={() => void supabase.auth.signOut()}>
            <Text className="text-brand">Sign out</Text>
          </Pressable>
        </View>
        <Input
          label="Where from?"
          value={text}
          onChangeText={(value) => {
            setText(value);
            setSelected(null);
          }}
          placeholder="City or airport"
        />
        {selected ? (
          <Text className="rounded-card bg-brand-soft p-3 text-ink">
            Selected: {selected.code} · {selected.name}
          </Text>
        ) : null}
      </View>
      <SuggestionList state={state} onSelect={setSelected} />
    </SafeAreaView>
  );
}
