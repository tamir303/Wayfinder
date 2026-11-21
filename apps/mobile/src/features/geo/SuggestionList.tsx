import type { GeoSuggestion } from '@wayfinder/shared';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SuggestionRow } from '../../components/SuggestionRow';
import type { SuggestUiState } from './suggest-ui-state';

type Props = { state: SuggestUiState; onSelect: (item: GeoSuggestion) => void };

export const SuggestionList = ({ state, onSelect }: Props) => {
  switch (state.kind) {
    case 'idle':
      return (
        <Text className="px-gutter py-4 text-ink-muted">Type a city or airport to search.</Text>
      );
    case 'loading':
      return (
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      );
    case 'empty':
      return <Text className="px-gutter py-4 text-ink-muted">No airports found.</Text>;
    case 'error':
      return <Text className="px-gutter py-4 text-danger">{state.message}</Text>;
    case 'results':
      return (
        <FlatList
          data={state.items}
          keyExtractor={(item) => item.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <SuggestionRow code={item.code} name={item.name} city={item.city} onPress={() => onSelect(item)} />
          )}
        />
      );
  }
};
