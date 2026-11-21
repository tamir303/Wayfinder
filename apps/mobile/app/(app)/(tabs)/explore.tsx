import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AttractionCard } from '../../../src/components/cards';
import { Chip } from '../../../src/components/Chip';
import { QueryState } from '../../../src/components/QueryState';
import { Screen } from '../../../src/components/Screen';
import { useAttractions } from '../../../src/features/travel/hooks';

export default function Explore() {
  const result = useAttractions();
  const [category, setCategory] = useState('All');
  return (
    <Screen title="Explore" subtitle="Things to do and places to eat">
      <QueryState query={result}>
        {({ attractions }) => {
          const categories = ['All', ...new Set(attractions.map((a) => a.category))];
          const shown = category === 'All' ? attractions : attractions.filter((a) => a.category === category);
          return (
            <View className="gap-3">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                {categories.map((c) => <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />)}
              </ScrollView>
              {shown.length === 0 ? <Text className="text-ink-muted">Nothing here yet.</Text> : null}
              {shown.map((a) => <AttractionCard key={a.id} item={a} />)}
            </View>
          );
        }}
      </QueryState>
    </Screen>
  );
}
